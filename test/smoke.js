// End-to-end smoke test on a local Hyperswarm testnet (no internet, no real DHT).
// Covers: short-code pairing, two-way messaging, three-member rooms via any-member
// invites, group broadcast, and offline catch-up relayed through a friend's log.
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import createTestnet from 'hyperdht/testnet.js'
import { Store } from '../src/store.js'
import { Together } from '../src/transport.js'

function tmpdir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `ct-${label}-`))
}

function waitFor (emitter, event, pred = () => true, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs)
    const onEvent = v => {
      if (!pred(v)) return
      clearTimeout(t)
      emitter.off(event, onEvent)
      resolve(v)
    }
    emitter.on(event, onEvent)
  })
}

const testnet = await createTestnet(3)
const bootstrap = testnet.bootstrap

const aliceDir = tmpdir('alice')
const bobDir = tmpdir('bob')
const carolDir = tmpdir('carol')

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

await Promise.all([waitFor(alice, 'peer-joined'), waitFor(bob, 'peer-joined')])

console.log('3. Two-way messaging…')
const gotByAlice = waitFor(alice, 'message')
bob.sendMessage('test-room', 'hello from bob')
assert.equal((await gotByAlice).text, 'hello from bob')

const gotByBob = waitFor(bob, 'message')
alice.sendMessage('test-room', 'hey bob, ship it')
assert.equal((await gotByBob).from, 'alice')
console.log('   both directions ok')

console.log('4. Carol joins the SAME room via an invite from Bob (not Alice)…')
const carol = new Together({ store: new Store(carolDir), bootstrap })
carol.store.setName('carol')
await carol.start()
const inv2 = bob.createInvite('test-room')
const joined2 = await carol.joinWithCode(inv2.code)
assert.equal(joined2.roomName, 'test-room')
// Carol should hear about at least one member; catch-up history should flow too.
await waitFor(carol, 'peer-joined')
console.log('   carol is in, connected to the mesh')

console.log('5. Group broadcast: Alice sends, Bob AND Carol receive…')
const bobGot = waitFor(bob, 'message', m => m.text === 'group ping')
const carolGot = waitFor(carol, 'message', m => m.text === 'group ping')
alice.sendMessage('test-room', 'group ping')
await Promise.all([bobGot, carolGot])
console.log('   both received the broadcast')

console.log('6. Offline relay: Carol goes offline, Alice sends, Alice goes offline,')
console.log('   Carol returns and catches up through BOB (store-and-forward via friend)…')
await carol.stop()
const bobRelay = waitFor(bob, 'message', m => m.text === 'relay me')
alice.sendMessage('test-room', 'relay me')
await bobRelay
await alice.stop()

const carol2 = new Together({ store: new Store(carolDir), bootstrap })
const carolCaughtUp = waitFor(carol2, 'message', m => m.text === 'relay me', 60_000)
await carol2.start()
const relayed = await carolCaughtUp
assert.equal(relayed.from, 'alice')
console.log('   carol received alice\'s message from bob\'s log — sender was offline')

console.log('7. Dedup: exactly one copy in carol\'s inbox…')
const inbox = carol2.store.drainInbound()
assert.equal(inbox.filter(m => m.text === 'relay me').length, 1)

await bob.stop()
await carol2.stop()
await testnet.destroy()

console.log('\nAll smoke tests passed.')
process.exit(0)
