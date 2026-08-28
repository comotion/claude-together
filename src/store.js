import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import b4a from 'b4a'

const MAX_SEEN = 5000

// Flat-file persistence: identity + rooms + seen-ids in state.json,
// undelivered outbound messages in outbox.json, unread inbound in inbox.json.
export class Store {
  constructor (dir) {
    this.dir = dir || process.env.CLAUDE_TOGETHER_DIR || path.join(os.homedir(), '.claude-together')
    fs.mkdirSync(this.dir, { recursive: true })
    this.state = this._read('state.json', { name: null, seed: null, rooms: {}, seen: [] })
    this.outbox = this._read('outbox.json', [])
    this.inbox = this._read('inbox.json', [])
    this._seenSet = new Set(this.state.seen)
  }

  _file (name) { return path.join(this.dir, name) }

  _read (name, fallback) {
    try {
      return JSON.parse(fs.readFileSync(this._file(name), 'utf8'))
    } catch {
      return fallback
    }
  }

  _write (name, value) {
    const tmp = this._file(name + '.tmp')
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
    fs.renameSync(tmp, this._file(name))
  }

  saveState () {
    this.state.seen = [...this._seenSet].slice(-MAX_SEEN)
    this._write('state.json', this.state)
  }

  saveOutbox () { this._write('outbox.json', this.outbox) }
  saveInbox () { this._write('inbox.json', this.inbox) }

  // --- identity ---
  getSeed () {
    if (!this.state.seed) return null
    return b4a.from(this.state.seed, 'base64')
  }

  setSeed (seedBuf) {
    this.state.seed = b4a.toString(seedBuf, 'base64')
    this.saveState()
  }

  getName () { return this.state.name }
  setName (name) { this.state.name = name; this.saveState() }

  // --- rooms ---
  addRoom (id, name, keyBuf) {
    this.state.rooms[id] = { name, key: b4a.toString(keyBuf, 'base64') }
    this.saveState()
  }

  removeRoom (id) {
    delete this.state.rooms[id]
    this.outbox = this.outbox.filter(m => m.roomId !== id)
    this.saveState(); this.saveOutbox()
  }

  rooms () {
    return Object.entries(this.state.rooms).map(([id, r]) => ({
      id, name: r.name, key: b4a.from(r.key, 'base64')
    }))
  }

  roomByName (name) {
    const matches = this.rooms().filter(r => r.name.toLowerCase() === name.toLowerCase())
    return matches[0] || null
  }

  // --- dedup ---
  hasSeen (id) { return this._seenSet.has(id) }
  markSeen (id) { this._seenSet.add(id); this.saveState() }

  // --- queues ---
  enqueueOutbound (msg) { this.outbox.push(msg); this.saveOutbox() }
  ackOutbound (id) {
    const before = this.outbox.length
    this.outbox = this.outbox.filter(m => m.id !== id)
    if (this.outbox.length !== before) this.saveOutbox()
  }

  outboundFor (roomId) { return this.outbox.filter(m => m.roomId === roomId) }

  pushInbound (msg) { this.inbox.push(msg); this.saveInbox() }
  drainInbound () {
    const msgs = this.inbox
    this.inbox = []
    this.saveInbox()
    return msgs
  }
}
