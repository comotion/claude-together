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

### ▶ 30-second explainer

![Claude Together explainer](docs/explainer.gif)

*[Full-quality MP4](https://github.com/wybe-labs/claude-together/blob/main/docs/explainer.mp4)*

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
| `/together-send bug-hunt found it, check session.ts` | send a message (lands when their turn ends) |
| `/together-send bug-hunt to alice: here's that stack trace` | address specific people — only they get active delivery |
| `/together-interrupt bug-hunt stop, merging a fix now` | barge into their running session |
| `/together-inbox` | check new + passive messages |
| `/together-status` | rooms, peers, members + last seen, queues |

Or just talk to Claude in any session:

| You say | What happens |
|---|---|
| "create an invite for room `name`" | Creates the room, prints a short single-use code (15 min TTL). Keep your session open until your friend joins. |
| "join room `X7KQ-2MPF-3HV9`" | Redeems a code from a friend; pairs in a few seconds. Everyone already in the room automatically gets a "`name` joined the room (`hostname` · `session label`)" notice — even members who are offline see it when they reconnect. The label defaults to your project folder name; set `CLAUDE_TOGETHER_LABEL` to override it. |
| "send to `name`: …" | Delivers instantly if they're online, otherwise queues on disk and delivers when you're both online. |
| "check my messages" | Fetches everything unread, across all rooms. |
| "multiplayer status" | Rooms, connected peers, known members with last-seen times, queued/unread counts. |
| "set my display name to …" | The name shown on your messages. |
| "leave room `name`" | Deletes the room key locally. |

### Delivery modes — messages land like a teammate tapping your shoulder

Messages don't sit in a mailbox waiting to be polled. `npm run register` installs
Claude Code hooks that deliver them into live sessions the same way Claude Code
surfaces your own mid-turn messages:

| Priority | How it lands on the other side |
|---|---|
| `interrupt` (`/together-interrupt`) | Injected **mid-turn** at their Claude's next tool boundary — barges into running work. For "stop, don't merge that". |
| `normal` (`/together-send`, default) | Delivered the moment their Claude **finishes its current turn** (or when they next prompt, if idle). |
| `passive` | Never injected. Waits quietly for `/together-inbox`. |

**Addressing specific people.** Any message can carry a "to" list of display names
(`/together-send bug-hunt to alice: …`, or just "tell alice …"). Every member still
gets the message in the shared room chat log, but only the named recipients receive
it at the active priority — everyone else gets it passively, with no interruption.
So sharing a log meant for one person doesn't barge into three other sessions.
Without a "to" list, the whole room gets the message at the send priority.
Addressing is best-effort, not an access control: display names are self-chosen
and not unique, and everyone in the room can read every message — "to" only
decides whose session is actively notified.

Every injected message is framed as untrusted data with an explicit instruction to
relay it to the human and ask before acting on anything it requests — a friend's
message can inform your Claude, never command it.

### Groups, not just co-op

Rooms are N-way meshes, not 1:1 links:

- **Any member can invite** — `/together-invite` on an existing room mints a new code,
  and the newcomer peers directly with everyone.
- **Messages relay through friends.** Each member keeps a recent room log (last 200
  messages / 7 days) and replays it to peers who reconnect. If Alice sends while
  Carol is offline and then leaves, Carol still gets it from Bob the next time either
  is online — store-and-forward through the group, no server.
- **Every session is a peer.** Your laptop, your desktop, a second account, three
  Claude Code sessions on one machine — each just joins the mesh. Sessions on the
  same machine share one identity, room list, and inbox.

Pairing and reconnecting happen automatically from then on: room keys persist in
`~/.claude-together/`, and sessions re-find each other through the DHT. Codes are
only ever needed to add a new person.

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
  untrusted when handed to Claude, which is told to relay any request to you and ask
  before acting on it. This is a *mitigation*, not a guarantee — see the limitations below.
- **Plain text only**, 16 KB cap. No files, no commands, no code execution. Peer-supplied
  message ids are validated as hex before they touch the filesystem (no path traversal).

### What the perimeter is

Discovery topics are derived from secret keys, so **only key-holders can even connect
to you** — random internet peers can't reach a room they don't have the key for. The
trust boundary is therefore *the people you invite*, not the whole internet. A room key
is a **shared symmetric secret**: everyone in the room holds the same key and is equally
trusted.

### Limitations — know these before trusting it with anything sensitive

- **A room key is permanent and unrevocable.** Anyone who ever holds it — an invited
  member, or anyone a code leaks to within its 15-minute window — keeps read/write
  access forever. `leave_room` only deletes *your own* copy; it can't evict anyone else.
  **You cannot kick a member.** The only way to exclude someone is for everyone else to
  start a fresh room. There is no forward secrecy: a leaked key exposes past logged
  history and all future messages.
- **Sender names are not authenticated.** `from`, `host`, and `label` are self-asserted;
  any room member can post under another member's name. Treat displayed identity as a
  hint, not proof.
- **Any member can invite anyone.** There is no admin role or approval step.
- **Prompt-injection risk is real.** Messages are injected into your live Claude session
  (mid-turn for `interrupt` priority, when the agent has tool access). The untrusted-data
  framing reduces but does not eliminate the risk that a crafted message manipulates the
  receiving agent. Don't run Claude Together in a session with dangerous auto-approved
  tools while in a room with people you don't trust, and prefer `normal`/`passive` over
  `interrupt` from untrusted senders.
- **Joining leaks your hostname and project-folder name** to the room (so members can
  tell your sessions apart). Set `CLAUDE_TOGETHER_LABEL` to override the folder name;
  your machine hostname is still sent.

**Bottom line:** safe for the intended use — *friends you trust, collaborating*. It is
**not** a zero-trust or anonymous messenger, and a room key should be treated like a
password you can never rotate: share it only with people you'd trust with write access
to your inbox, and start a new room if it might have leaked.

## Reliability

- **At-least-once delivery**: messages queue on disk until acked, survive restarts,
  and deduplicate by id. Live messages also forward through mutual peers, healing
  meshes where two members can't reach each other directly.
- **Offline catch-up through the group**: any member who saw a message replays it to
  whoever reconnects. A message is only stuck if literally no one who has it is
  online at the same time as you.
- **No central relay by design**: if two peers are both behind carrier-grade NAT,
  hole punching can fail (~5% of pairings). Easiest fix: both install
  [Tailscale](https://tailscale.com) — the swarm then finds the direct tailnet path.

## Repo layout

- [`test/security.js`](test/security.js) — path-traversal regression test (`npm run test:security`)
- [`src/server.js`](src/server.js) — MCP server and tool definitions
- [`src/transport.js`](src/transport.js) — Hyperswarm swarm, pairing handshake, room
  auth, at-least-once message protocol
- [`src/crypto.js`](src/crypto.js) — invite codes, argon2 stretching, MACs, secretbox
- [`src/store.js`](src/store.js) — persistence: identity, room keys, inbox/outbox
- [`test/smoke.js`](test/smoke.js) — end-to-end test on a local DHT testnet: `npm test`

## License

MIT
