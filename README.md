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

**Current release: v0.3.1 (LTS)** — per-project room membership, signed messages
(TOFU), session identifiers, and a version handshake. LTS: 0.3.x stays
wire-compatible; peers on mismatched versions detect and report it in-session.

### ▶ 30-second explainer

![Claude Together explainer](docs/explainer.gif)

*[Full-quality MP4](https://github.com/wybe-labs/claude-together/blob/main/docs/explainer.mp4)*

## Install (each person, ~2 minutes)

Requires [Node.js](https://nodejs.org) ≥ 18 and [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/wybe-labs/claude-together
cd claude-together
npm install

cd /path/to/your/project        # the project you want to be reachable in
npm --prefix /path/to/claude-together run register
```

Registration is **per project**, not machine-wide: hooks go in that project's
`.claude/settings.local.json`, the slash commands in its `.claude/commands`, and the
MCP server is added at `--scope local`. A session in a project you never registered
has no claude-together tools and no delivery hooks, so it cannot be pulled into a
room — being reachable is something you turn on where you want it. Run it again in
each project you want, and restart your Claude Code session.

If the `claude` CLI isn't on your PATH it prints the exact command to run manually.

> Upgrading from ≤0.3? Those versions installed hooks user-wide in
> `~/.claude/settings.json`, where they fired in every project. `npm run register`
> removes those entries (leaving any other hooks alone) and tells you it did.

## Usage

Two equivalent ways: **slash commands** (installed by `npm run register`) or plain
natural language — both end up calling the same MCP tools.

| Slash command | Shorthand for |
|---|---|
| `/together-invite bug-hunt` | create a room + invite code |
| `/together-join X7KQ-2MPF-3HV9` | redeem a friend's code |
| `/together-send bug-hunt found it, check session.ts` | send a message (lands when their turn ends) |
| `/together-send bug-hunt to alice: here's that stack trace` | address specific people — only they get active delivery |
| `/together-interrupt bug-hunt stop, merging a fix now` | barge into their running session (if that room opted in) |
| `/together-inbox` | check new + passive messages |
| `/together-history bug-hunt` | re-read recent room chat (non-destructive) |
| `/together-status` | rooms, peers, members + last seen, queues |

Or just talk to Claude in any session:

| You say | What happens |
|---|---|
| "create an invite for room `name`" | Creates the room, prints a short single-use code (5 min TTL). Keep your session open until your friend joins. |
| "join room `X7KQ-2MPF-3HV9`" | Redeems a code from a friend; pairs in a few seconds. Everyone already in the room automatically gets a "`name` joined the room (`hostname` · `session label` · `harness`)" notice — even members who are offline see it when they reconnect. The label defaults to your project folder name; set `CLAUDE_TOGETHER_LABEL` to override it. |
| "send to `name`: …" | Delivers instantly if they're online, otherwise queues on disk and delivers when you're both online. |
| "check my messages" | Fetches everything unread, across all rooms. |
| "multiplayer status" | Rooms, connected peers, known members with last-seen times, queued/unread counts. |
| "show the history of `name`" | Re-reads the recent room log (last 200 msgs / 7 days) without touching your unread inbox. |
| "set my display name to …" | The name shown on your messages. |
| "leave room `name`" | Deletes the room key, stops announcing on the DHT, and closes the room's connections. |

**Version mismatches are detected on connect.** Sessions exchange their
claude-together version in the room handshake; if a peer runs an older version,
your Claude tells you and suggests passing the update along — and if *you* are
the outdated one, Claude offers to `git pull` + `npm install` for you and reminds
you that restarting Claude Code and resuming (`claude --continue`) keeps your
session.

### Delivery modes — messages land like a teammate tapping your shoulder

Messages don't sit in a mailbox waiting to be polled. `npm run register` installs
Claude Code hooks that deliver them into live sessions the same way Claude Code
surfaces your own mid-turn messages:

| Priority | How it lands on the other side |
|---|---|
| `normal` (`/together-send`, default) | Delivered the moment their Claude **finishes its current turn** (or when they next prompt, if idle). |
| `interrupt` (`/together-interrupt`) | *Requests* injection **mid-turn** at their Claude's next tool boundary. Honored only by rooms the receiver opted in (below); otherwise it lands at turn end. |
| `passive` | Never injected. Waits quietly for `/together-inbox`. |

**Interrupts are opt-in, per room, on the receiving side.** They are off by default,
because the session being interrupted runs shell, docker and git commands, and a
mid-turn injection arrives in the middle of that work — so whether a peer may barge
in is the receiver's call, not the sender's. Turn it on for a room you trust by
asking your Claude ("allow interrupts from bug-hunt"), and off again the same way;
`status` shows the current setting per room. Opting out never loses messages, it only
means they land at the end of the turn. Senders are told the interrupt may be
downgraded, so nobody reads a lack of barge-in as the message not arriving.

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
- **Every project is a peer.** Your laptop, your desktop, a second account, two
  different projects on one machine — each joins the mesh in its own right.

### Membership is per project, not per machine

Joining a room is an explicit act, scoped to the project directory the session runs
in: each project gets its own store under `~/.claude-together/projects/<name>-<hash>/`
(room keys, inbox, queues). A session in another folder is **not** in your rooms, sees
none of your messages, and has to redeem its own invite to join. Only your display
name is machine-global. Two sessions open in the *same* project directory share that
project's membership and show up as two peers.

Pairing and reconnecting happen automatically from then on: room keys persist in the
project's store, and sessions re-find each other through the DHT. Codes are only ever
needed to add a new person (or a new project). Set `CLAUDE_TOGETHER_DIR` to point
several projects at one shared store if you deliberately want the old machine-global
behavior.

**Migrating from 0.2:** pre-0.3 versions kept one machine-global room list; 0.3 no
longer joins those rooms. The first session in each project gets a one-time notice
listing them — mint fresh invites in the projects that need them, or set
`CLAUDE_TOGETHER_DIR=~/.claude-together` to keep using the old shared store. Your
display name (and new signing identity) carry over automatically.

## Why the invite codes can be short

The code is not the encryption key — it's a single-use pairing secret
(the [magic-wormhole](https://github.com/magic-wormhole/magic-wormhole) trick):

1. Both sides stretch the code with **argon2id** (64 MB memory-hard) into a pairing key
   and meet at a DHT topic derived from it.
2. They prove knowledge of the code to each other with nonce-bound MACs — a stranger
   who finds the meeting point can't complete the handshake.
3. Over that authenticated, encrypted link the inviter hands over the room's real
   random **256-bit key**. The code is then retired forever.

60 bits of entropy + argon2 + single-use + 5-minute expiry ≫ anything brute-forceable
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
  member, or whoever redeems a leaked code first within its 5-minute window (an
  invite is spent the moment its key is handed over, so only one redeemer wins) —
  keeps read/write access forever. `leave_room` only deletes *your own* copy; it can't evict anyone else.
  **You cannot kick a member.** The only way to exclude someone is for everyone else to
  start a fresh room. There is no forward secrecy: a leaked key exposes past logged
  history and all future messages.
- **Sender authenticity is trust-on-first-use, not absolute.** Every message is signed
  with a long-lived per-identity ed25519 key; receivers pin a sender's key the first
  time they see it and warn loudly if a later message is signed with a different key
  (or arrives unsigned from a sender who used to sign). But the *first* message from a
  name is taken on faith, display names are not unique, and `host`/`label`/`sid` remain
  self-asserted decoration. Treat the warnings as real, and the absence of warnings as
  strong-but-not-absolute.
- **Any member can invite anyone.** There is no admin role or approval step.
- **Prompt-injection risk is real.** Messages are injected into your live Claude session
  (mid-turn for `interrupt` priority, when the agent has tool access). The untrusted-data
  framing reduces but does not eliminate the risk that a crafted message manipulates the
  receiving agent. Don't run Claude Together in a session with dangerous auto-approved
  tools while in a room with people you don't trust. Mid-turn injection is off unless
  you opted that room in, which is the setting to leave alone for any room you don't
  fully trust — but `normal` delivery still reaches the same agent, one turn later.
- **Every message carries your hostname, project-folder name, a per-session id, and a harness tag**
  (so members can tell your machines, projects, and sessions apart). Set
  `CLAUDE_TOGETHER_LABEL` to override the folder name; your machine hostname is
  still sent, and the session id is random per process.

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

### Corporate networks: use your own bootstrap node

Peers behind one restrictive corporate NAT hit a variant of the above that Tailscale
isn't always allowed to solve, and being on the same LAN does not help: discovery is
global-DHT-only, so both sides are introduced by public address and then fail to
hole-punch back into their own network. Both sides simply time out.

Run a DHT bootstrap node inside the network instead, on any machine both can reach:

```
npm run bootstrap-node -- --host <lan ip>     # leave running; defaults to port 49737
```

Then point every session at it and restart them:

```
CLAUDE_TOGETHER_BOOTSTRAP=<lan ip>:49737
```

Discovery and the hole punch then stay entirely inside the LAN. `status` reports which
bootstrap a session is using — sessions on different bootstraps form separate DHTs and
cannot see each other, so the value must match everywhere.

## Repo layout

- [`test/security.js`](test/security.js) — path-traversal regression test (`npm run test:security`)
- [`src/server.js`](src/server.js) — MCP server and tool definitions
- [`src/transport.js`](src/transport.js) — Hyperswarm swarm, pairing handshake, room
  auth, at-least-once message protocol
- [`src/crypto.js`](src/crypto.js) — invite codes, argon2 stretching, MACs, secretbox
- [`src/store.js`](src/store.js) — persistence: identity, room keys, inbox/outbox
- [`src/scope.js`](src/scope.js) — per-project store scoping (shared by server and hooks)
- [`scripts/bootstrap-node.js`](scripts/bootstrap-node.js) — DHT bootstrap node for a
  private network: `npm run bootstrap-node -- --host <lan ip>`
- [`test/smoke.js`](test/smoke.js) — end-to-end test on a local DHT testnet: `npm test`
- [`test/interrupts.js`](test/interrupts.js) — receiver-side interrupt opt-in
- [`test/register.js`](test/register.js) — per-project hook installation

## License

MIT
