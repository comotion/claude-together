// Live diagnostic against the REAL public DHT (needs internet): two local nodes
// pair with a short code and exchange messages. Run with: npm run test:live
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Store } from '../src/store.js'
import { Together } from '../src/transport.js'

const t0 = Date.now()
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(1)}s]`

function tmpdir (label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `ct-live-${label}-`))
}

function waitFor (emitter, event, pred = () => true, timeoutMs = 90_000) {
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

const a = new Together({ store: new Store(tmpdir('a')) })
const b = new Together({ store: new Store(tmpdir('b')) })
a.store.setName('node-a')
b.store.setName('node-b')

console.log(stamp(), 'starting both nodes against the public DHT…')
await a.start()
await b.start()

console.log(stamp(), 'creating invite…')
const inv = a.createInvite('live-test')
console.log(stamp(), 'code:', inv.code, '— joining from second node…')

const joined = await b.joinWithCode(inv.code)
console.log(stamp(), 'PAIRED over public DHT — room:', joined.roomName)
assert.equal(joined.roomName, 'live-test')

await Promise.all([waitFor(a, 'peer-joined'), waitFor(b, 'peer-joined')])
console.log(stamp(), 'room mesh connected')

const got = waitFor(a, 'message', m => m.text === 'live ping')
b.sendMessage('live-test', 'live ping')
const m = await got
console.log(stamp(), `message delivered: "${m.text}" from ${m.from}`)

await a.stop()
await b.stop()
console.log(stamp(), '\nLIVE TEST PASSED — pairing and messaging work on the real DHT.')
process.exit(0)
