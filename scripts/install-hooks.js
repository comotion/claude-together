// Merges the Claude Together delivery hooks into ~/.claude/settings.json.
// Idempotent: existing claude-together hook entries are replaced, everything else
// in the file is left untouched. Run directly or via `npm run register`.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// Recognize our own hook entries regardless of how the repo folder is spelled
// (claude-together, ClaudeTogether, …): normalize case and hyphens, and require
// the hook script name so unrelated commands can't match.
function isOurs (command) {
  const c = String(command || '').toLowerCase().replace(/-/g, '')
  return c.includes('claudetogether') && c.includes('hook.js')
}

export function installHooks () {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const hookScript = path.join(root, 'scripts', 'hook.js')
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    } catch (err) {
      throw new Error(`${settingsPath} exists but is not valid JSON — fix it first (${err.message})`)
    }
  }

  const cmd = mode => `"${process.execPath}" "${hookScript}" ${mode}`
  const wanted = {
    PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: cmd('posttool') }] }],
    Stop: [{ hooks: [{ type: 'command', command: cmd('stop') }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd('prompt') }] }]
  }

  settings.hooks = settings.hooks || {}
  for (const [event, entries] of Object.entries(wanted)) {
    const existing = settings.hooks[event] || []
    const others = existing.filter(e =>
      !(e.hooks || []).some(h => isOurs(h.command)))
    settings.hooks[event] = [...others, ...entries]
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  return settingsPath
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const where = installHooks()
  console.log(`Delivery hooks installed in ${where}`)
  console.log('Messages now flow into live sessions: "interrupt" mid-turn, "normal" at turn end, "passive" stays in the inbox.')
}
