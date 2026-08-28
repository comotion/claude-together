import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { T } from './theme'
import {
  DrawnLine, FadeUp, GridBg, Packet, SceneTitle, Terminal, Typewriter, useSpringIn
} from './components'

// Fades a scene in/out at its edges so cuts feel soft.
const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(
    frame,
    [0, 12, duration - 12, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  return (
    <AbsoluteFill style={{ opacity }}>
      <GridBg />
      {children}
    </AbsoluteFill>
  )
}

// ---------- 1. Hook (180) ----------
export const Hook: React.FC = () => {
  const title = useSpringIn(80, 35)
  return (
    <SceneFade duration={180}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 40 }}>
        <div style={{ fontFamily: T.mono, fontSize: 40, color: T.dim }}>
          <span style={{ color: T.green }}>&gt; </span>
          <Typewriter text="claude, add multiplayer" delay={12} cps={1.1} />
        </div>
        <div
          style={{
            fontFamily: T.sans,
            fontSize: 130,
            fontWeight: 800,
            letterSpacing: 2,
            color: T.text,
            opacity: title,
            transform: `scale(${0.9 + title * 0.1})`
          }}
        >
          Claude <span style={{ color: T.cyan }}>Together</span>
        </div>
        <FadeUp delay={115}>
          <div style={{ fontFamily: T.sans, fontSize: 44, color: T.dim }}>
            Session multiplayer for Claude Code
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}

// ---------- 2. Problem (300) ----------
export const Problem: React.FC = () => {
  const frame = useCurrentFrame()
  const cross = useSpringIn(95, 20)
  return (
    <SceneFade duration={300}>
      <SceneTitle text="Two sessions. Two accounts. Zero ways to talk." delay={8} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 220, alignItems: 'center', marginTop: 40 }}>
          <FadeUp delay={18} dist={60}>
            <Terminal title="you — laptop" width={560}>
              <div style={{ color: T.dim }}>account: <span style={{ color: T.text }}>you@gmail.com</span></div>
              <div style={{ color: T.dim, marginTop: 8 }}>working on: <span style={{ color: T.amber }}>auth bug</span></div>
              <div style={{ marginTop: 16, color: T.red }}>can't reach your friend's session</div>
            </Terminal>
          </FadeUp>
          <FadeUp delay={38} dist={60}>
            <Terminal title="friend — desktop" width={560}>
              <div style={{ color: T.dim }}>account: <span style={{ color: T.text }}>friend@gmail.com</span></div>
              <div style={{ color: T.dim, marginTop: 8 }}>working on: <span style={{ color: T.amber }}>same bug</span></div>
              <div style={{ marginTop: 16, color: T.red }}>can't reach yours either</div>
            </Terminal>
          </FadeUp>
        </div>
        <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
          <DrawnLine x1={760} y1={560} x2={1160} y2={560} delay={70} color={T.red} dashed />
          <g opacity={cross} transform={`translate(960, 560) scale(${cross})`}>
            <circle r={44} fill={T.bg} stroke={T.red} strokeWidth={5} />
            <path d="M -18 -18 L 18 18 M 18 -18 L -18 18" stroke={T.red} strokeWidth={7} strokeLinecap="round" />
          </g>
        </svg>
        <FadeUp delay={140} style={{ position: 'absolute', bottom: 150, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: T.sans, fontSize: 42, color: T.text }}>
            Claude Code can't message across accounts —
          </div>
        </FadeUp>
        <FadeUp delay={185} style={{ position: 'absolute', bottom: 85, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: T.sans, fontSize: 42, color: T.dim, opacity: frame > 185 ? 1 : 0 }}>
            and nobody wants to run a server just to chat.
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}

// ---------- 3. Invite (390) ----------
const CodeChip: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <span
    style={{
      fontFamily: T.mono,
      fontSize: 34,
      fontWeight: 700,
      color: T.amber,
      background: `${T.amber}18`,
      border: `2px solid ${T.amber}`,
      borderRadius: 10,
      padding: '6px 18px',
      ...style
    }}
  >
    X7KQ-2MPF-3HV9
  </span>
)

export const Invite: React.FC = () => {
  const frame = useCurrentFrame()
  // The code chip flies from the left terminal to the right one.
  const fly = interpolate(frame, [175, 215], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const flyEase = 1 - (1 - fly) * (1 - fly)
  return (
    <SceneFade duration={390}>
      <SceneTitle text="One short code. That's the whole setup." delay={5} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 140, alignItems: 'flex-start', marginTop: 60 }}>
          <FadeUp delay={12} dist={60}>
            <Terminal title="you" width={700} accent={fly > 0 && fly < 1 ? T.amber : T.border}>
              <div>
                <span style={{ color: T.green }}>&gt; </span>
                <Typewriter text="/together-invite bug-hunt" delay={25} />
              </div>
              {frame > 105 && (
                <FadeUp delay={105} dist={16}>
                  <div style={{ marginTop: 18, color: T.dim }}>Invite code:</div>
                  <div style={{ marginTop: 10 }}>
                    <CodeChip />
                  </div>
                  <div style={{ marginTop: 12, color: T.dim, fontSize: 22 }}>
                    single use · expires in 15 minutes
                  </div>
                </FadeUp>
              )}
            </Terminal>
          </FadeUp>
          <FadeUp delay={150} dist={60}>
            <Terminal title="your friend" width={700}>
              <div>
                <span style={{ color: T.green }}>&gt; </span>
                <Typewriter text="/together-join X7KQ-2MPF-3HV9" delay={225} />
              </div>
              {frame > 320 && (
                <FadeUp delay={320} dist={16}>
                  <div style={{ marginTop: 18, color: T.green, fontWeight: 700 }}>
                    ✓ Joined room "bug-hunt"
                  </div>
                  <div style={{ marginTop: 8, color: T.dim, fontSize: 22 }}>
                    connected directly · end-to-end encrypted
                  </div>
                </FadeUp>
              )}
            </Terminal>
          </FadeUp>
        </div>
        {fly > 0 && fly < 1 && (
          <div
            style={{
              position: 'absolute',
              left: 420 + flyEase * 780,
              top: 560 - Math.sin(flyEase * Math.PI) * 140,
              transform: `scale(${1 + Math.sin(flyEase * Math.PI) * 0.25})`
            }}
          >
            <CodeChip />
          </div>
        )}
        <FadeUp delay={340} style={{ position: 'absolute', bottom: 90, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: T.sans, fontSize: 40, color: T.dim }}>
            Text it, say it, carrier-pigeon it — any channel works.
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}

// ---------- 4. How it works (620) ----------
const Node: React.FC<{
  x: number
  y: number
  label: string
  delay: number
  color?: string
  dimmed?: boolean
}> = ({ x, y, label, delay, color = T.cyan, dimmed = false }) => {
  const s = useSpringIn(delay, 25)
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 85,
        top: y - 85,
        width: 170,
        height: 170,
        borderRadius: 85,
        background: T.bgPanel,
        border: `4px solid ${dimmed ? T.border : color}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        opacity: s * (dimmed ? 0.45 : 1),
        transform: `scale(${s})`,
        boxShadow: dimmed ? 'none' : `0 0 40px ${color}33`
      }}
    >
      <div style={{ fontSize: 52 }}>💻</div>
      <div style={{ fontFamily: T.sans, fontSize: 26, fontWeight: 600, color: dimmed ? T.dim : T.text }}>
        {label}
      </div>
    </div>
  )
}

const Caption: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [from, from + 15, to - 15, to], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        width: '100%',
        textAlign: 'center',
        opacity,
        fontFamily: T.sans,
        fontSize: 44,
        color: T.text
      }}
    >
      {children}
    </div>
  )
}

export const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame()
  const YOU = { x: 480, y: 590 }
  const FRIEND = { x: 1440, y: 590 }
  const DHT = { x: 960, y: 300 }
  const THIRD = { x: 960, y: 880 }
  const dhtFade = interpolate(frame, [230, 270], [1, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const thirdOffline = frame >= 350 && frame < 470
  const lock = useSpringIn(195, 22)
  return (
    <SceneFade duration={620}>
      <SceneTitle text="No servers. Just math." delay={5} />
      {/* DHT cloud */}
      <div
        style={{
          position: 'absolute',
          left: DHT.x - 230,
          top: DHT.y - 95,
          width: 460,
          height: 190,
          borderRadius: 95,
          border: `3px dashed ${T.purple}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: useSpringIn(45, 25) * dhtFade
        }}
      >
        <div style={{ fontFamily: T.sans, fontSize: 32, fontWeight: 600, color: T.purple }}>public DHT</div>
        <div style={{ fontFamily: T.sans, fontSize: 24, color: T.dim }}>sees only opaque hashes</div>
      </div>

      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
        {/* rendezvous via DHT */}
        <g opacity={dhtFade}>
          <DrawnLine x1={YOU.x} y1={YOU.y - 90} x2={DHT.x - 150} y2={DHT.y + 95} delay={95} color={T.purple} dashed width={4} />
          <DrawnLine x1={FRIEND.x} y1={FRIEND.y - 90} x2={DHT.x + 150} y2={DHT.y + 95} delay={115} color={T.purple} dashed width={4} />
        </g>
        {/* direct hole-punched connection */}
        <DrawnLine x1={YOU.x + 90} y1={YOU.y} x2={FRIEND.x - 90} y2={FRIEND.y} delay={165} color={T.cyan} width={6} />
        {/* mesh lines to third member */}
        {frame >= 280 && (
          <>
            <DrawnLine x1={YOU.x + 60} y1={YOU.y + 70} x2={THIRD.x - 130} y2={THIRD.y - 40} delay={295} color={T.cyan} width={5} />
            <DrawnLine x1={FRIEND.x - 60} y1={FRIEND.y + 70} x2={THIRD.x + 130} y2={THIRD.y - 40} delay={305} color={T.cyan} width={5} />
          </>
        )}
        {/* offline relay: you -> friend now, friend -> third later */}
        <Packet x1={YOU.x + 90} y1={YOU.y} x2={FRIEND.x - 90} y2={FRIEND.y} start={380} end={415} />
        <Packet x1={FRIEND.x - 60} y1={FRIEND.y + 70} x2={THIRD.x + 130} y2={THIRD.y - 40} start={480} end={515} />
      </svg>

      <Node x={YOU.x} y={YOU.y} label="you" delay={20} />
      <Node x={FRIEND.x} y={FRIEND.y} label="friend" delay={32} />
      {frame >= 280 && <Node x={THIRD.x} y={THIRD.y} label="friend 2" delay={285} dimmed={thirdOffline} />}
      {thirdOffline && (
        <div
          style={{
            position: 'absolute',
            left: THIRD.x - 70,
            top: THIRD.y + 95,
            fontFamily: T.sans,
            fontSize: 26,
            color: T.dim
          }}
        >
          offline 💤
        </div>
      )}

      {/* lock on the direct line */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 40,
          top: 590 - 40,
          width: 80,
          height: 80,
          borderRadius: 40,
          background: T.bg,
          border: `3px solid ${T.green}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 38,
          opacity: lock,
          transform: `scale(${lock})`
        }}
      >
        🔒
      </div>

      <Caption from={80} to={165}>
        A short code meets both sides at a <span style={{ color: T.purple }}>DHT rendezvous</span> — hardened with argon2
      </Caption>
      <Caption from={175} to={270}>
        Then they hole-punch a <span style={{ color: T.cyan }}>direct connection</span> — <span style={{ color: T.green }}>end-to-end encrypted</span>, no middleman
      </Caption>
      <Caption from={285} to={360}>
        Rooms are meshes — <span style={{ color: T.cyan }}>any member can invite more people</span>
      </Caption>
      <Caption from={370} to={460}>
        Someone offline? Messages wait with whoever <span style={{ color: T.green }}>did</span> get them…
      </Caption>
      <Caption from={470} to={600}>
        …and <span style={{ color: T.green }}>friends relay them</span> when they return. Store-and-forward, no server.
      </Caption>
    </SceneFade>
  )
}

// ---------- 5. Features (330) ----------
const FEATURES: Array<[string, string, string]> = [
  ['🔒', 'End-to-end encrypted', 'Noise protocol on every connection, always'],
  ['🌐', 'Truly serverless', 'pure P2P — nothing to host, nothing to trust'],
  ['📨', 'Offline catch-up', 'friends relay what you missed'],
  ['👥', 'Group rooms', 'laptops, desktops, whole teams — every session is a peer'],
  ['⌨️', 'Slash commands', '/together-invite · /together-join · /together-send']
]

export const Features: React.FC = () => (
  <SceneFade duration={330}>
    <SceneTitle text="What you get" delay={5} />
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34, marginTop: 60 }}>
        {FEATURES.map(([icon, title, sub], i) => (
          <FadeUp key={title} delay={30 + i * 32} dist={50}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                width: 1220,
                background: T.bgPanel,
                border: `2px solid ${T.border}`,
                borderRadius: 16,
                padding: '22px 34px'
              }}
            >
              <div style={{ fontSize: 52 }}>{icon}</div>
              <div style={{ fontFamily: T.sans, fontSize: 38, fontWeight: 700, color: T.text, width: 420 }}>
                {title}
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 30, color: T.dim }}>{sub}</div>
            </div>
          </FadeUp>
        ))}
      </div>
    </AbsoluteFill>
  </SceneFade>
)

// ---------- 6. CTA (280) ----------
export const CTA: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <SceneFade duration={280}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 50 }}>
        <FadeUp delay={8}>
          <Terminal title="get started" width={1150}>
            <div>
              <span style={{ color: T.green }}>$ </span>
              <Typewriter text="git clone https://github.com/wybe-labs/claude-together" delay={18} cps={1.8} />
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ color: T.green }}>$ </span>
              <Typewriter text="npm install && npm run register" delay={82} cps={1.8} />
            </div>
            {frame > 150 && (
              <FadeUp delay={150} dist={14}>
                <div style={{ marginTop: 16, color: T.green }}>
                  ✓ ready — restart Claude Code and try /together-invite
                </div>
              </FadeUp>
            )}
          </Terminal>
        </FadeUp>
        <FadeUp delay={175}>
          <div style={{ fontFamily: T.sans, fontSize: 76, fontWeight: 800, color: T.text }}>
            Claude <span style={{ color: T.cyan }}>Together</span>
          </div>
        </FadeUp>
        <FadeUp delay={200}>
          <div style={{ fontFamily: T.mono, fontSize: 38, color: T.dim }}>
            github.com/<span style={{ color: T.text }}>wybe-labs/claude-together</span> · MIT
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}
