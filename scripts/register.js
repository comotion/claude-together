// Registers this MCP server with Claude Code: `npm run register`
// Uses the exact node binary running this script, so it works with any Node install.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installHooks } from './install-hooks.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = path.join(root, 'src', 'server.js')

try {
  installHooks()
  console.log('Delivery hooks installed (interrupt mid-turn / normal at turn end / passive inbox).')
} catch (err) {
  console.error(`Could not install delivery hooks: ${err.message}`)
  console.error('Messages will still arrive, but only via /together-inbox.')
}

// Install the /together-* slash commands user-wide.
const cmdSrc = path.join(root, 'commands')
const cmdDst = path.join(os.homedir(), '.claude', 'commands')
fs.mkdirSync(cmdDst, { recursive: true })
for (const f of fs.readdirSync(cmdSrc).filter(f => f.endsWith('.md'))) {
  fs.copyFileSync(path.join(cmdSrc, f), path.join(cmdDst, f))
}
console.log(`Installed slash commands to ${cmdDst}: ${fs.readdirSync(cmdSrc).filter(f => f.endsWith('.md')).map(f => '/' + f.replace(/\.md$/, '')).join(', ')}`)
const args = ['mcp', 'add', '--scope', 'user', 'claude-together', '--', process.execPath, server]

const isWin = process.platform === 'win32'
const res = spawnSync(isWin ? 'claude.cmd' : 'claude', args, { stdio: 'inherit', shell: isWin })

if (res.error || res.status !== 0) {
  console.error('\nCould not run the `claude` CLI automatically. Register manually with:\n')
  console.error(`  claude mcp add --scope user claude-together -- "${process.execPath}" "${server}"\n`)
  process.exit(1)
}
console.log('\nRegistered. Restart your Claude Code session, then say: "create an invite for room <name>".')
