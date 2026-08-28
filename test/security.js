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

fs.rmSync(canary, { force: true })
fs.rmSync(dir, { recursive: true, force: true })
console.log('\nSecurity tests passed.')
process.exit(0)
