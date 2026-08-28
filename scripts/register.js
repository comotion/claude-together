// Registers this MCP server with Claude Code: `npm run register`
// Uses the exact node binary running this script, so it works with any Node install.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = path.join(root, 'src', 'server.js')
const args = ['mcp', 'add', '--scope', 'user', 'claude-together', '--', process.execPath, server]

const isWin = process.platform === 'win32'
const res = spawnSync(isWin ? 'claude.cmd' : 'claude', args, { stdio: 'inherit', shell: isWin })

if (res.error || res.status !== 0) {
  console.error('\nCould not run the `claude` CLI automatically. Register manually with:\n')
  console.error(`  claude mcp add --scope user claude-together -- "${process.execPath}" "${server}"\n`)
  process.exit(1)
}
console.log('\nRegistered. Restart your Claude Code session, then say: "create an invite for room <name>".')
