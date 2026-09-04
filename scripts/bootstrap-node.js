// Runs a DHT bootstrap node on your own network: `npm run bootstrap-node -- --host <lan ip>`
//
// Use this when the peers that should meet are behind one restrictive NAT. The public
// hyperdht nodes are reachable from there, but they introduce peers by public address
// and the hole-punch back into the LAN is what fails. A bootstrap node on the LAN keeps
// discovery and the punch entirely inside the network.
//
// Leave this running on one machine, then point every session at it:
//   CLAUDE_TOGETHER_BOOTSTRAP=<lan ip>:49737
// Sessions on different bootstraps form separate DHTs and cannot see each other.
import DHT from 'hyperdht'

function arg (name, fallback = null) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1 || i === process.argv.length - 1) return fallback
  return process.argv[i + 1]
}

const host = arg('host')
const port = Number(arg('port', '49737'))

if (!host) {
  console.error('Usage: npm run bootstrap-node -- --host <lan ip> [--port 49737]')
  console.error('The host must be an address your peers can reach, not 127.0.0.1.')
  process.exit(1)
}

const node = DHT.bootstrapper(port, host)
await node.ready()

console.log(`Bootstrap node listening on ${host}:${port}`)
console.log('Point every session at it, then restart them:')
console.log(`  CLAUDE_TOGETHER_BOOTSTRAP=${host}:${port}`)

process.once('SIGINT', () => node.destroy())
