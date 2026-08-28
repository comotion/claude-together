import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import Hyperswarm from 'hyperswarm'
import hypercoreCrypto from 'hypercore-crypto'
import b4a from 'b4a'
import {
  generateInviteCode, deriveCodeKey, derive, topicFor,
  randomBytes, mac, seal, open, timingSafeEqual, hash
} from './crypto.js'

const AUTH_TIMEOUT_MS = 30_000
const PAIR_TIMEOUT_MS = 90_000
const INVITE_TTL_MS = 15 * 60_000

function roomIdFor (roomKey) {
  return b4a.toString(derive(roomKey, 'claude-together-roomid').subarray(0, 8), 'hex')
}

// A human-readable tag for THIS session, sent along with join announcements so
// peers can tell which of your sessions joined. Claude Code launches MCP servers
// in the project directory, so the folder name is a good default; override with
// CLAUDE_TOGETHER_LABEL.
function sessionLabel () {
  if (process.env.CLAUDE_TOGETHER_LABEL) return process.env.CLAUDE_TOGETHER_LABEL.slice(0, 64)
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  return path.basename(dir).slice(0, 64)
}

// P2P layer. One Hyperswarm instance; every room is a DHT topic derived from its
// 256-bit room key; pairing happens on a short-lived topic derived from the invite code.
// Hyperswarm gives us ONE E2E Noise-encrypted socket per peer (connections are per-peer,
// not per-topic), so a single connection can carry several authenticated contexts:
// each side proves knowledge of its keys with nonce-bound MACs, and re-proves whenever
// it learns a new key (e.g. right after a pairing grant hands over the room key).
export class Together extends EventEmitter {
  constructor ({ store, bootstrap = undefined } = {}) {
    super()
    this.store = store
    this.bootstrap = bootstrap
    this.swarm = null
    this.conns = new Set()               // all sockets, authed or not
    this.roomConns = new Map()           // roomId -> Set<conn>
    this.discoveries = new Map()         // topicHex -> discovery session
    this.pendingInvites = new Map()      // pairing topicHex -> { roomId, codeKey, timer, topic }
    this.pendingJoins = new Map()        // pairing topicHex -> { codeKey, resolve, reject, timer, topic, retry }
  }

  async start () {
    if (!this.store.getName()) this.store.setName(os.userInfo().username)

    // Ephemeral keypair per process: several sessions on one machine (or several of
    // your machines) each show up as their own peer in the room mesh. Trust comes
    // from room keys, not from this connection identity.
    this.swarm = new Hyperswarm({
      keyPair: hypercoreCrypto.keyPair(),
      bootstrap: this.bootstrap
    })
    this.swarm.on('connection', conn => this._onConnection(conn))

    for (const room of this.store.rooms()) this._joinTopic(topicFor(room.key, 'room'))

    // Hyperswarm's own DHT re-query cadence is ~10 minutes; that's too slow for
    // "my friend just came online". Nudge lookups for rooms with no live peers,
    // and pick up rooms another local session joined since we started.
    this._maintenance = setInterval(() => {
      for (const room of this.store.rooms()) {
        const hex = b4a.toString(topicFor(room.key, 'room'), 'hex')
        if (!this.discoveries.has(hex)) {
          this._joinTopic(topicFor(room.key, 'room'))
          this._reproveAll()
          continue
        }
        if (this.roomConns.get(room.id)?.size) continue
        this.discoveries.get(hex)?.refresh().catch(() => {})
      }
    }, 30_000)
    if (this._maintenance.unref) this._maintenance.unref()
  }

  async stop () {
    clearInterval(this._maintenance)
    for (const { timer } of this.pendingInvites.values()) clearTimeout(timer)
    for (const { timer, reject, retry } of this.pendingJoins.values()) {
      clearTimeout(timer)
      clearInterval(retry)
      reject(new Error('shutting down'))
    }
    this.pendingJoins.clear()
    await this.swarm?.destroy()
  }

  // --- topics ---

  _joinTopic (topic) {
    const hex = b4a.toString(topic, 'hex')
    if (this.discoveries.has(hex)) return
    this.discoveries.set(hex, this.swarm.join(topic, { server: true, client: true }))
  }

  async _leaveTopic (topic) {
    const hex = b4a.toString(topic, 'hex')
    if (!this.discoveries.has(hex)) return
    this.discoveries.delete(hex)
    try { await this.swarm.leave(topic) } catch {}
  }

  // --- rooms / invites ---

  createRoom (name) {
    const key = randomBytes(32)
    const id = roomIdFor(key)
    this.store.addRoom(id, name, key)
    this._joinTopic(topicFor(key, 'room'))
    return { id, name }
  }

  // Returns a short single-use code. Anyone who redeems it within its TTL gets this
  // room's key over a code-authenticated channel; then the code is dead.
  createInvite (roomName) {
    let room = this.store.roomByName(roomName)
    if (!room) {
      this.createRoom(roomName)
      room = this.store.roomByName(roomName)
    }
    const code = generateInviteCode()
    const codeKey = deriveCodeKey(code)
    const topic = topicFor(codeKey, 'pairing')
    const hex = b4a.toString(topic, 'hex')

    const timer = setTimeout(() => this._expireInvite(hex), INVITE_TTL_MS)
    if (timer.unref) timer.unref()
    this.pendingInvites.set(hex, { roomId: room.id, codeKey, timer, topic })
    this._joinTopic(topic)
    this._reproveAll()
    return { code, roomName: room.name, expiresInMinutes: INVITE_TTL_MS / 60000 }
  }

  _expireInvite (hex) {
    const inv = this.pendingInvites.get(hex)
    if (!inv) return
    clearTimeout(inv.timer)
    this.pendingInvites.delete(hex)
    this._leaveTopic(inv.topic)
  }

  joinWithCode (code) {
    const codeKey = deriveCodeKey(code)
    const topic = topicFor(codeKey, 'pairing')
    const hex = b4a.toString(topic, 'hex')

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const join = this.pendingJoins.get(hex)
        clearInterval(join?.retry)
        this.pendingJoins.delete(hex)
        this._leaveTopic(topic)
        reject(new Error('Timed out waiting for the inviter. Make sure their session is open and the code is fresh.'))
      }, PAIR_TIMEOUT_MS)
      // Re-run the DHT lookup every few seconds — the inviter's announce may land
      // after our first query, and hyperswarm's own refresh cadence is minutes.
      const retry = setInterval(() => {
        this.discoveries.get(hex)?.refresh().catch(() => {})
      }, 4_000)
      if (retry.unref) retry.unref()
      this.pendingJoins.set(hex, { codeKey, resolve, reject, timer, topic, retry })
      this._joinTopic(topic)
      this._reproveAll()
    })
  }

  // --- connections & handshake ---

  _candidates () {
    const out = []
    for (const room of this.store.rooms()) {
      out.push({ kind: 'room', id: room.id, key: room.key })
    }
    for (const [hex, inv] of this.pendingInvites) {
      out.push({ kind: 'pair', id: hex, key: inv.codeKey })
    }
    for (const [hex, join] of this.pendingJoins) {
      out.push({ kind: 'pair', id: hex, key: join.codeKey })
    }
    return out
  }

  _onConnection (conn) {
    this.conns.add(conn)
    const state = {
      nonce: randomBytes(24),
      peerNonce: null,
      rooms: new Set(),        // roomIds proven by the peer
      pairs: new Set(),        // pairing topicHexes proven by the peer
      grantsSent: new Set(),
      peerName: null,
      buf: ''
    }
    conn._ct = state

    // A peer that never proves any shared key gets dropped.
    state.authTimer = setTimeout(() => conn.destroy(), AUTH_TIMEOUT_MS)

    conn.on('data', data => {
      state.buf += b4a.toString(data)
      let idx
      while ((idx = state.buf.indexOf('\n')) !== -1) {
        const line = state.buf.slice(0, idx)
        state.buf = state.buf.slice(idx + 1)
        if (!line.trim()) continue
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        try { this._onMessage(conn, state, msg) } catch (err) {
          this.emit('warning', err)
        }
      }
    })

    const cleanup = () => {
      clearTimeout(state.authTimer)
      this.conns.delete(conn)
      for (const roomId of state.rooms) {
        this.roomConns.get(roomId)?.delete(conn)
        if (state.peerName) this.store.touchMember(roomId, state.peerName, Date.now())
        this.emit('peer-left', { roomId, name: state.peerName })
      }
      state.rooms.clear()
    }
    conn.on('close', cleanup)
    conn.on('error', cleanup)

    this._send(conn, { t: 'auth1', nonce: b4a.toString(state.nonce, 'base64') })
  }

  _send (conn, obj) {
    try { conn.write(JSON.stringify(obj) + '\n') } catch {}
  }

  // Send MAC proofs for every key we hold. Safe to repeat: MACs are bound to this
  // connection's nonce pair and to direction, so they can't be replayed elsewhere.
  _sendProofs (conn, state) {
    if (!state.peerNonce) return
    const proofs = this._candidates().map(c => ({
      id: c.id,
      kind: c.kind,
      mac: b4a.toString(mac(derive(c.key, 'auth'), state.peerNonce, state.nonce), 'base64')
    }))
    this._send(conn, { t: 'auth2', proofs })
  }

  // Called when our candidate set changes (new room key learned, invite/join started)
  // so live connections can pick up the new context.
  _reproveAll () {
    for (const conn of this.conns) {
      const state = conn._ct
      if (state?.peerNonce) this._sendProofs(conn, state)
    }
  }

  _onMessage (conn, state, msg) {
    switch (msg.t) {
      case 'auth1': {
        if (state.peerNonce) return
        state.peerNonce = b4a.from(msg.nonce, 'base64')
        this._sendProofs(conn, state)
        break
      }

      case 'auth2': {
        if (!state.peerNonce) return
        let matchedNew = false
        for (const proof of msg.proofs || []) {
          const cand = this._candidates().find(c => c.id === proof.id && c.kind === proof.kind)
          if (!cand) continue
          const already = cand.kind === 'room' ? state.rooms.has(cand.id) : state.pairs.has(cand.id)
          if (already) continue
          const expected = mac(derive(cand.key, 'auth'), state.nonce, state.peerNonce)
          if (!timingSafeEqual(b4a.from(proof.mac, 'base64'), expected)) continue

          matchedNew = true
          clearTimeout(state.authTimer)
          if (cand.kind === 'room') {
            state.rooms.add(cand.id)
            if (!this.roomConns.has(cand.id)) this.roomConns.set(cand.id, new Set())
            this.roomConns.get(cand.id).add(conn)
            this._send(conn, { t: 'hello', roomId: cand.id, name: this.store.getName() })
            // At-least-once delivery: replay everything not yet acked for this room,
            // then gossip recent room history. The peer dedups by message id, so this
            // is how someone who was offline catches up through ANY member who was
            // around — store-and-forward through friends, no server.
            const replayed = new Set()
            for (const m of this.store.outboundFor(cand.id)) {
              replayed.add(m.id)
              this._send(conn, { t: 'msg', ...m })
            }
            for (const m of this.store.logTail(cand.id)) {
              if (!replayed.has(m.id)) this._send(conn, { t: 'msg', ...m })
            }
          } else {
            state.pairs.add(cand.id)
            const inv = this.pendingInvites.get(cand.id)
            if (inv && !state.grantsSent.has(cand.id)) {
              const room = this.store.rooms().find(r => r.id === inv.roomId)
              if (room) {
                state.grantsSent.add(cand.id)
                const grant = JSON.stringify({
                  roomKey: b4a.toString(room.key, 'base64'),
                  roomName: room.name
                })
                this._send(conn, {
                  t: 'grant',
                  id: cand.id,
                  box: b4a.toString(seal(inv.codeKey, b4a.from(grant)), 'base64')
                })
              }
            }
          }
        }
        // The peer proved something new — answer with our proofs so both sides
        // converge on the same contexts (at most one extra round).
        if (matchedNew) this._sendProofs(conn, state)
        break
      }

      case 'hello': {
        const roomId = String(msg.roomId || '')
        if (!state.rooms.has(roomId)) return
        state.peerName = String(msg.name || 'unknown').slice(0, 64)
        this.store.touchMember(roomId, state.peerName, Date.now())
        this.emit('peer-joined', { roomId, name: state.peerName })
        break
      }

      case 'grant': {
        // Joiner side of pairing: the inviter is handing us the room key.
        const hex = String(msg.id || '')
        if (!state.pairs.has(hex)) return
        const join = this.pendingJoins.get(hex)
        if (!join) return
        const plain = open(join.codeKey, b4a.from(msg.box, 'base64'))
        if (!plain) return
        const grant = JSON.parse(b4a.toString(plain))
        const roomKey = b4a.from(grant.roomKey, 'base64')
        const roomId = roomIdFor(roomKey)
        const alreadyMember = this.store.rooms().some(r => r.id === roomId)
        this.store.addRoom(roomId, grant.roomName, roomKey)
        this._joinTopic(topicFor(roomKey, 'room'))
        this._send(conn, { t: 'grant-ack', id: hex })
        clearTimeout(join.timer)
        clearInterval(join.retry)
        this.pendingJoins.delete(hex)
        this._leaveTopic(join.topic)
        // Prove the new room key on all live connections — including this one,
        // which hyperswarm will reuse for the room (one socket per peer).
        this._reproveAll()
        // Announce ourselves to the room through the normal message path: it sits
        // in the outbox now and replays as soon as the room context is proven, and
        // it queues/gossips for members who are currently offline.
        if (!alreadyMember) {
          this._broadcast(roomId, {
            text: 'joined the room',
            priority: 'normal',
            kind: 'presence',
            host: os.hostname().slice(0, 64),
            label: sessionLabel()
          })
        }
        join.resolve({ roomId, roomName: grant.roomName })
        break
      }

      case 'grant-ack': {
        // Inviter side: pairing succeeded, retire the code.
        const hex = String(msg.id || '')
        if (!state.pairs.has(hex)) return
        const inv = this.pendingInvites.get(hex)
        if (!inv) return
        this._expireInvite(hex)
        this.emit('invite-redeemed', { roomId: inv.roomId })
        break
      }

      case 'msg': {
        const roomId = String(msg.roomId || '')
        if (!state.rooms.has(roomId)) return
        const id = String(msg.id || '')
        if (!id) return
        this._send(conn, { t: 'ack', id })
        if (this.store.hasSeen(id)) return
        this.store.markSeen(id)
        const room = this.store.rooms().find(r => r.id === roomId)
        const ts = Number(msg.ts) || Date.now()
        let priority = ['interrupt', 'normal', 'passive'].includes(msg.priority) ? msg.priority : 'normal'
        // A gossiped/replayed "interrupt" from hours ago shouldn't barge into a
        // session now — urgency expires.
        if (priority === 'interrupt' && Date.now() - ts > 5 * 60_000) priority = 'normal'
        const inbound = {
          id,
          roomId,
          roomName: room?.name || roomId,
          from: String(msg.from || state.peerName || 'unknown').slice(0, 64),
          text: String(msg.text || '').slice(0, 16384),
          ts,
          priority,
          kind: msg.kind === 'presence' ? 'presence' : 'chat',
          ...(msg.host ? { host: String(msg.host).slice(0, 64) } : {}),
          ...(msg.label ? { label: String(msg.label).slice(0, 64) } : {})
        }
        this.store.touchMember(roomId, inbound.from, ts)
        this.store.pushInbound(inbound)
        this.store.appendLog(inbound)
        // Forward to other live peers in the room — heals meshes where two members
        // can't reach each other directly but both reach us. Dedup stops loops.
        for (const other of this.roomConns.get(roomId) || []) {
          if (other !== conn) this._send(other, { t: 'msg', ...inbound })
        }
        this.emit('message', inbound)
        break
      }

      case 'ack': {
        if (state.rooms.size === 0) return
        this.store.ackOutbound(String(msg.id || ''))
        break
      }
    }
  }

  // --- messaging ---

  sendMessage (roomName, text, priority = 'normal') {
    const room = this.store.roomByName(roomName)
    if (!room) throw new Error(`No room named "${roomName}". Rooms: ${this.store.rooms().map(r => r.name).join(', ') || '(none)'}`)
    if (!['interrupt', 'normal', 'passive'].includes(priority)) priority = 'normal'
    return this._broadcast(room.id, { text, priority, kind: 'chat' })
  }

  // Shared send path for chat and presence: outbox until acked, room log for
  // offline catch-up through friends, immediate fan-out to live peers.
  _broadcast (roomId, { text, priority, kind, host, label }) {
    const msgId = b4a.toString(hash(randomBytes(16)).subarray(0, 12), 'hex')
    const msg = {
      id: msgId,
      roomId,
      from: this.store.getName(),
      text: String(text).slice(0, 16384),
      ts: Date.now(),
      priority,
      kind,
      ...(host ? { host } : {}),
      ...(label ? { label } : {})
    }
    this.store.markSeen(msgId) // never re-ingest our own message if echoed
    this.store.enqueueOutbound(msg)
    this.store.appendLog(msg)
    const conns = this.roomConns.get(roomId) || new Set()
    for (const conn of conns) this._send(conn, { t: 'msg', ...msg })
    return { id: msgId, deliveredToPeers: conns.size, queued: conns.size === 0 }
  }

  // --- introspection ---

  status () {
    const rooms = this.store.rooms().map(r => {
      const conns = [...(this.roomConns.get(r.id) || [])]
      const connectedPeers = conns.map(c => c._ct?.peerName || 'connecting…')
      const members = Object.entries(this.store.membersFor(r.id))
        .map(([name, m]) => ({
          name,
          online: connectedPeers.includes(name),
          lastSeen: new Date(m.lastSeen).toISOString()
        }))
        .sort((a, b) => (b.online - a.online) || (b.lastSeen < a.lastSeen ? -1 : 1))
      return {
        name: r.name,
        id: r.id,
        connectedPeers,
        members,
        pendingOutbound: this.store.outboundFor(r.id).length
      }
    })
    return {
      displayName: this.store.getName(),
      rooms,
      pendingInvites: this.pendingInvites.size,
      unreadMessages: this.store.unreadCount()
    }
  }
}
