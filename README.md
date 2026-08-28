# Claude Together

**Session multiplayer for Claude Code.** Your Claude Code session and a friend's session —
different Anthropic accounts, different machines, anywhere on the internet — exchange
messages over a **direct, end-to-end encrypted P2P connection**. No relay, no central
server, nothing to host, nothing to sign up for.

```
you: "create an invite for room bug-hunt"
      → invite code: X7KQ-2MPF-3HV9  (text it to your friend)

friend: "join room X7KQ-2MPF-3HV9"
      → connected, directly, encrypted

you: "tell bug-hunt: the leak is in token refresh, check session.ts"
friend: "check my messages"
```

Built on [Hyperswarm](https://github.com/holepunchto/hyperswarm): peers find each other
through a public BitTorrent-style DHT, hole-punch a direct UDP connection, and talk over
Noise-encrypted sockets. Exposed to Claude as an [MCP](https://modelcontextprotocol.io) server.

## Install (each person, ~2 minutes)

Requires [Node.js](https://nodejs.org) ≥ 18 and [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/wybe-labs/claude-together
cd claude-together
npm install
npm run register
```

`npm run register` runs `claude mcp add` for you (user scope, so it works in every
project). If the `claude` CLI isn't on your PATH it prints the exact command to run
manually. Then restart your Claude Code session — that's it.

## Usage

Two equivalent ways: **slash commands** (installed by `npm run register`) or plain
natural language — both end up calling the same MCP tools.

| Slash command | Shorthand for |
|---|---|
| `/together-invite bug-hunt` | create a room + invite code |
| `/together-join X7KQ-2MPF-3HV9` | redeem a friend's code |
| `/together-send bug-hunt found it, check session.ts` | send a message |
| `/together-inbox` | check new messages |
| `/together-status` | rooms, peers, queues |

Or just talk to Claude in any session:

| You say | What happens |
|---|---|
| "create an invite for room `name`" | Creates the room, prints a short single-use code (15 min TTL). Keep your session open until your friend joins. |
| "join room `X7KQ-2MPF-3HV9`" | Redeems a code from a friend; pairs in a few seconds. |
| "send to `name`: …" | Delivers instantly if they're online, otherwise queues on disk and delivers when you're both online. |
| "check my messages" | Fetches everything unread, across all rooms. |
| "multiplayer status" | Rooms, connected peers, queued/unread counts. |
| "set my display name to …" | The name shown on your messages. |
| "leave room `name`" | Deletes the room key locally. |

Rooms aren't limited to two people — any member can create a new invite for the same
room and the newcomer peers with everyone.

Pairing and reconnecting happen automatically from then on: room keys persist in
`~/.claude-together/`, and sessions re-find each other through the DHT whenever both
are online. Codes are only ever needed to add a new person.

## Why the invite codes can be short

The code is not the encryption key — it's a single-use pairing secret
(the [magic-wormhole](https://github.com/magic-wormhole/magic-wormhole) trick):

1. Both sides stretch the code with **argon2id** (64 MB memory-hard) into a pairing key
   and meet at a DHT topic derived from it.
2. They prove knowledge of the code to each other with nonce-bound MACs — a stranger
   who finds the meeting point can't complete the handshake.
3. Over that authenticated, encrypted link the inviter hands over the room's real
   random **256-bit key**. The code is then retired forever.

60 bits of entropy + argon2 + single-use + 15-minute expiry ≫ anything brute-forceable
in the window.

## Security model

- **End-to-end encrypted** — every socket is Noise-encrypted by Hyperswarm. The only
  third-party infrastructure is the public DHT, which sees opaque topic hashes, never
  content or names.
- **Authenticated** — a connection is trusted for a room only after the peer proves
  knowledge of that room's key (keyed BLAKE2b challenge-response, direction-bound,
  replay-safe).
- **Messages are data, not instructions.** Inbound messages are explicitly framed as
  untrusted when handed to Claude: a friend's message can't prompt-inject your session
  into doing something — Claude is told to show you any request found in a message and
  ask before acting.
- **Plain text only**, 16 KB cap. No files, no commands, no code execution.

## Reliability

- **At-least-once delivery**: messages queue on disk until acked, survive restarts,
  and deduplicate by id.
- **No relay by design**: if both of you are behind carrier-grade NAT, hole punching
  can fail (~5% of pairings). Easiest fix: both install [Tailscale](https://tailscale.com) —
  the swarm then finds the direct tailnet path.
- Both sessions must be online at the same time for delivery; offline messages wait
  in your local queue, not in any cloud.

## Repo layout

- [`src/server.js`](src/server.js) — MCP server and tool definitions
- [`src/transport.js`](src/transport.js) — Hyperswarm swarm, pairing handshake, room
  auth, at-least-once message protocol
- [`src/crypto.js`](src/crypto.js) — invite codes, argon2 stretching, MACs, secretbox
- [`src/store.js`](src/store.js) — persistence: identity, room keys, inbox/outbox
- [`test/smoke.js`](test/smoke.js) — end-to-end test on a local DHT testnet: `npm test`

## License

MIT
