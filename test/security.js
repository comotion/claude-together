// Security regression tests. Run: npm run test:security
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Store } from '../src/store.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-sec-'))
const store = new Store(dir)

// A canary the store must never be tricked into overwriting.
const canary = path.join(path.dirname(dir), 'ct-canary.txt')
fs.writeFileSync(canary, 'ORIGINAL')

console.log('1. Path traversal via msg.id is rejected by the store…')
const evilIds = [
  '../../ct-canary',
  '../' + path.basename(canary).replace(/\.txt$/, ''),
  '..\\..\\ct-canary',
  '../config',
  'a/../../escape',
  'NOTHEX',
  ''
]
for (const id of evilIds) {
  store.pushInbound({ id, roomId: 'deadbeef', text: 'x', ts: Date.now() })
  store.appendLog({ id, roomId: id, text: 'x', ts: Date.now() })
  store.enqueueOutbound({ id, roomId: 'deadbeef', text: 'x' })
  store.markSeen(id)
}
assert.equal(fs.readFileSync(canary, 'utf8'), 'ORIGINAL', 'canary was modified — traversal not blocked!')
// Nothing should have been written outside the store dir.
const strays = fs.readdirSync(path.dirname(dir)).filter(f => f.startsWith('ct-canary') && f !== path.basename(canary))
assert.equal(strays.length, 0, `stray files created: ${strays.join(', ')}`)
console.log('   canary intact, no files escaped the store dir')

console.log('2. A well-formed id is still accepted…')
const goodId = 'a1b2c3d4e5f6a1b2c3d4e5f6'
store.pushInbound({ id: goodId, roomId: 'deadbeef', roomName: 'r', from: 'x', text: 'hi', ts: Date.now() })
const drained = store.drainInbound()
assert.ok(drained.some(m => m.id === goodId), 'valid message was dropped')
console.log('   valid message stored and drained')

console.log('3. seen.jsonl stays bounded under a flood…')
// Import the constants indirectly by flooding well past the cap and checking the set
// and file both stay bounded (compaction fires).
let hx = 0
const hexId = () => (hx++).toString(16).padStart(12, '0')
const floodDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-flood-'))
const s2 = new Store(floodDir)
let lastId
for (let i = 0; i < 70_000; i++) { lastId = hexId(); s2.markSeen(lastId) }
const seenLines = fs.readFileSync(path.join(floodDir, 'seen.jsonl'), 'utf8').split('\n').filter(Boolean).length
assert.ok(s2._seen.size <= 20_000, `in-memory seen set unbounded: ${s2._seen.size}`)
assert.ok(seenLines <= 60_000, `seen.jsonl not compacted: ${seenLines} lines`)
assert.equal(s2.hasSeen(lastId), true, 'recently-seen id was forgotten')       // recent kept
assert.equal(s2.hasSeen('000000000000'), false, 'oldest id should have been evicted') // oldest gone
console.log(`   set=${s2._seen.size} (≤20k), file=${seenLines} lines (≤60k)`)

console.log('4. Oversized peer frame is rejected, not buffered…')
// A minimal fake connection: capture writes, feed a giant newline-less chunk.
const { Together } = await import('../src/transport.js')
const t = new Together({ store: new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-buf-'))) })
let destroyed = false
const fakeConn = {
  _handlers: {},
  on (ev, fn) { this._handlers[ev] = fn },
  write () {},
  destroy () { destroyed = true }
}
t._onConnection(fakeConn)
fakeConn._handlers.data(Buffer.from('x'.repeat(300 * 1024))) // > MAX_LINE_BYTES, no newline
assert.equal(destroyed, true, 'connection not dropped on oversized frame')
console.log('   connection dropped on 300 KB newline-less flood')

fs.rmSync(canary, { force: true })
fs.rmSync(dir, { recursive: true, force: true })
fs.rmSync(floodDir, { recursive: true, force: true })
console.log('\nSecurity tests passed.')
process.exit(0)
