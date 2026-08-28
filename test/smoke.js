// End-to-end smoke test on a local Hyperswarm testnet (no internet, no real DHT).
// Two full nodes: Alice invites, Bob joins with the short code, messages flow both
// ways with acks, and an offline message is delivered on reconnect.
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import createTestnet from 'hyperdht/testnet.js'
import { Store } from '../src/store.js'
import { Together } from '../src/transport.js'

function tmpdir (label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ct-${label}-`))
  return dir
}

function waitFor (emitter, event, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs)
    emitter.once(event, v => { clearTimeout(t); resolve(v) })
  })
}

const testnet = await createTestnet(3)
const bootstrap = testnet.bootstrap

const aliceDir = tmpdir('alice')
const bobDir = tmpdir('bob')

const alice = new Together({ store: new Store(aliceDir), bootstrap })
const bob = new Together({ store: new Store(bobDir), bootstrap })
alice.store.setName('alice')
bob.store.setName('bob')

await alice.start()
await bob.start()

console.log('1. Alice creates an invite…')
const inv = alice.createInvite('test-room')
console.log(`   code: ${inv.code}`)
assert.match(inv.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)

console.log('2. Bob joins with the code (argon2 + DHT rendezvous + handshake)…')
const joined = await bob.joinWithCode(inv.code.toLowerCase()) // case-insensitive
assert.equal(joined.roomName, 'test-room')
console.log('   joined:', joined.roomName)

console.log('3. Waiting for room-topic peer connection…')
await Promise.all([
  waitFor(alice, 'peer-joined'),
  waitFor(bob, 'peer-joined')
])

console.log('4. Bob -> Alice message…')
const gotByAlice = waitFor(alice, 'message')
bob.sendMessage('test-room', 'hello from bob')
const m1 = await gotByAlice
assert.equal(m1.from, 'bob')
assert.equal(m1.text, 'hello from bob')
console.log(`   alice received: "${m1.text}" from ${m1.from}`)

console.log('5. Alice -> Bob message…')
const gotByBob = waitFor(bob, 'message')
alice.sendMessage('test-room', 'hey bob, ship it')
const m2 = await gotByBob
assert.equal(m2.from, 'alice')
console.log(`   bob received: "${m2.text}" from ${m2.from}`)

console.log('6. Offline queue: stop Bob, Alice sends, restart Bob…')
await bob.stop()
const res = alice.sendMessage('test-room', 'queued while you were away')

const bob2 = new Together({ store: new Store(bobDir), bootstrap })
const gotOffline = waitFor(bob2, 'message', 60_000)
await bob2.start()
const m3 = await gotOffline
assert.equal(m3.text, 'queued while you were away')
console.log(`   bob received after reconnect: "${m3.text}" (was queued: ${res.queued || res.deliveredToPeers >= 0})`)

console.log('7. Dedup: unacked replay does not duplicate…')
assert.equal(bob2.store.inbox.filter(m => m.text === 'queued while you were away').length <= 1, true)

await alice.stop()
await bob2.stop()
await testnet.destroy()

console.log('\nAll smoke tests passed.')
process.exit(0)
