import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { T } from './theme'
import {
  DrawnLine, FadeUp, PageBg, Packet, SceneTitle, Terminal, Typewriter, useSpringIn
} from './components'

const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 7, duration - 7, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  return (
    <AbsoluteFill style={{ opacity }}>
      <PageBg />
      {children}
    </AbsoluteFill>
  )
}

// ---------- 1. Hook (75 = 2.5s) ----------
export const Hook: React.FC = () => {
  const title = useSpringIn(6, 22)
  return (
    <SceneFade duration={75}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30 }}>
        <div
          style={{
            fontFamily: T.serif,
            fontSize: 150,
            fontWeight: 700,
            color: T.ink,
            opacity: title,
            transform: `scale(${0.92 + title * 0.08})`
          }}
        >
          Claude <span style={{ color: T.accentDeep }}>Together</span>
        </div>
        <FadeUp delay={22}>
          <div style={{ fontFamily: T.sans, fontSize: 46, color: T.dim }}>
            Session multiplayer for Claude Code
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}

// ---------- 2. Problem (90 = 3s) ----------
export const Problem: React.FC = () => {
  const cross = useSpringIn(38, 16)
  return (
    <SceneFade duration={90}>
      <SceneTitle text="Two accounts. Zero ways to talk." delay={4} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 260, alignItems: 'center', marginTop: 50 }}>
          <FadeUp delay={8} dist={40}>
            <Terminal title="you" width={480}>
              <div style={{ color: T.termDim }}>account: <span style={{ color: T.termText }}>you@gmail.com</span></div>
              <div style={{ marginTop: 10, color: '#e58c74' }}>friend unreachable</div>
            </Terminal>
          </FadeUp>
          <FadeUp delay={16} dist={40}>
            <Terminal title="your friend" width={480}>
              <div style={{ color: T.termDim }}>account: <span style={{ color: T.termText }}>friend@gmail.com</span></div>
              <div style={{ marginTop: 10, color: '#e58c74' }}>you unreachable</div>
            </Terminal>
          </FadeUp>
        </div>
        <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
          <DrawnLine x1={730} y1={560} x2={1190} y2={560} delay={26} color={T.red} dashed width={4} />
          <g opacity={cross} transform={`translate(960, 560) scale(${cross})`}>
            <circle r={40} fill={T.bg} stroke={T.red} strokeWidth={5} />
            <path d="M -16 -16 L 16 16 M 16 -16 L -16 16" stroke={T.red} strokeWidth={7} strokeLinecap="round" />
          </g>
        </svg>
        <FadeUp delay={52} style={{ position: 'absolute', bottom: 110, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: T.serif, fontSize: 42, color: T.dim, fontStyle: 'italic' }}>
            …and nobody wants to host a server for it.
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}

// ---------- 3. Invite (165 = 5.5s) ----------
const CodeChip: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <span
    style={{
      fontFamily: T.mono,
      fontSize: 32,
      fontWeight: 700,
      color: T.accentDeep,
      background: `${T.accent}1f`,
      border: `2px solid ${T.accentDeep}`,
      borderRadius: 10,
      padding: '5px 16px',
      ...style
    }}
  >
    X7KQ-2MPF-3HV9
  </span>
)

export const Invite: React.FC = () => {
  const frame = useCurrentFrame()
  const fly = interpolate(frame, [62, 88], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const flyEase = 1 - (1 - fly) * (1 - fly)
  return (
    <SceneFade duration={165}>
      <SceneTitle text="One short code is the whole setup." delay={3} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 120, alignItems: 'flex-start', marginTop: 60 }}>
          <FadeUp delay={6} dist={40}>
            <Terminal title="you" width={660}>
              <div>
                <span style={{ color: T.accent }}>&gt; </span>
                <Typewriter text="/together-invite bug-hunt" delay={10} cps={3.2} />
              </div>
              {frame > 42 && (
                <FadeUp delay={42} dist={12}>
                  <div style={{ marginTop: 12 }}>
                    <CodeChip />
                    <span style={{ color: T.termDim, fontSize: 21, marginLeft: 14 }}>
                      single use · 15 min
                    </span>
                  </div>
                </FadeUp>
              )}
            </Terminal>
          </FadeUp>
          <FadeUp delay={55} dist={40}>
            <Terminal title="your friend" width={660}>
              <div>
                <span style={{ color: T.accent }}>&gt; </span>
                <Typewriter text="/together-join X7KQ-2MPF-3HV9" delay={92} cps={3.2} />
              </div>
              {frame > 132 && (
                <FadeUp delay={132} dist={12}>
                  <div style={{ marginTop: 12, color: '#9fb383', fontWeight: 700 }}>
                    ✓ joined "bug-hunt" — end-to-end encrypted
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
              left: 430 + flyEase * 760,
              top: 540 - Math.sin(flyEase * Math.PI) * 120,
              transform: `scale(${1 + Math.sin(flyEase * Math.PI) * 0.2})`
            }}
          >
            <CodeChip />
          </div>
        )}
      </AbsoluteFill>
    </SceneFade>
  )
}

// ---------- 4. How it works (240 = 8s) ----------
const Node: React.FC<{
  x: number
  y: number
  label: string
  delay: number
  dimmed?: boolean
}> = ({ x, y, label, delay, dimmed = false }) => {
  const s = useSpringIn(delay, 18)
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 75,
        top: y - 75,
        width: 150,
        height: 150,
        borderRadius: 75,
        background: T.termBg,
        border: `4px solid ${dimmed ? T.border : T.accent}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
        opacity: s * (dimmed ? 0.4 : 1),
        transform: `scale(${s})`,
        boxShadow: dimmed ? 'none' : `0 10px 30px ${T.accent}44`
      }}
    >
      <div style={{ fontSize: 44 }}>💻</div>
      <div style={{ fontFamily: T.sans, fontSize: 24, fontWeight: 600, color: T.termText }}>{label}</div>
    </div>
  )
}

const Caption: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [from, from + 10, to - 10, to], [0, 1, 1, 0], {
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
        fontFamily: T.serif,
        fontSize: 46,
        color: T.ink
      }}
    >
      {children}
    </div>
  )
}

export const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame()
  const YOU = { x: 500, y: 580 }
  const FRIEND = { x: 1420, y: 580 }
  const DHT = { x: 960, y: 310 }
  const THIRD = { x: 960, y: 850 }
  const dhtFade = interpolate(frame, [92, 118], [1, 0.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const thirdOffline = frame >= 150 && frame < 190
  const lock = useSpringIn(80, 16)
  return (
    <SceneFade duration={240}>
      <SceneTitle text="No servers. Just math." delay={3} />
      <div
        style={{
          position: 'absolute',
          left: DHT.x - 200,
          top: DHT.y - 80,
          width: 400,
          height: 160,
          borderRadius: 80,
          border: `3px dashed ${T.blue}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: useSpringIn(16, 18) * dhtFade
        }}
      >
        <div style={{ fontFamily: T.sans, fontSize: 30, fontWeight: 600, color: T.blue }}>public DHT</div>
        <div style={{ fontFamily: T.sans, fontSize: 22, color: T.dim }}>sees only hashes</div>
      </div>

      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
        <g opacity={dhtFade}>
          <DrawnLine x1={YOU.x} y1={YOU.y - 80} x2={DHT.x - 130} y2={DHT.y + 80} delay={28} color={T.blue} dashed width={4} />
          <DrawnLine x1={FRIEND.x} y1={FRIEND.y - 80} x2={DHT.x + 130} y2={DHT.y + 80} delay={36} color={T.blue} dashed width={4} />
        </g>
        <DrawnLine x1={YOU.x + 80} y1={YOU.y} x2={FRIEND.x - 80} y2={FRIEND.y} delay={62} color={T.accentDeep} width={6} />
        {frame >= 120 && (
          <>
            <DrawnLine x1={YOU.x + 55} y1={YOU.y + 60} x2={THIRD.x - 115} y2={THIRD.y - 40} delay={128} color={T.accentDeep} width={5} />
            <DrawnLine x1={FRIEND.x - 55} y1={FRIEND.y + 60} x2={THIRD.x + 115} y2={THIRD.y - 40} delay={134} color={T.accentDeep} width={5} />
          </>
        )}
        <Packet x1={YOU.x + 80} y1={YOU.y} x2={FRIEND.x - 80} y2={FRIEND.y} start={158} end={178} color={T.green} />
        <Packet x1={FRIEND.x - 55} y1={FRIEND.y + 60} x2={THIRD.x + 115} y2={THIRD.y - 40} start={196} end={216} color={T.green} />
      </svg>

      <Node x={YOU.x} y={YOU.y} label="you" delay={8} />
      <Node x={FRIEND.x} y={FRIEND.y} label="friend" delay={14} />
      {frame >= 120 && <Node x={THIRD.x} y={THIRD.y} label="friend 2" delay={122} dimmed={thirdOffline} />}
      {thirdOffline && (
        <div style={{ position: 'absolute', left: THIRD.x - 55, top: THIRD.y + 82, fontFamily: T.sans, fontSize: 24, color: T.dim }}>
          offline 💤
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 960 - 36,
          top: 580 - 36,
          width: 72,
          height: 72,
          borderRadius: 36,
          background: T.bg,
          border: `3px solid ${T.green}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 34,
          opacity: lock,
          transform: `scale(${lock})`
        }}
      >
        🔒
      </div>

      <Caption from={24} to={62}>
        the code meets both sides at a <span style={{ color: T.blue }}>DHT rendezvous</span>
      </Caption>
      <Caption from={66} to={118}>
        hole-punched, <span style={{ color: T.green }}>end-to-end encrypted</span>, no middleman
      </Caption>
      <Caption from={122} to={155}>
        rooms are meshes — <span style={{ color: T.accentDeep }}>anyone can invite</span>
      </Caption>
      <Caption from={158} to={232}>
        offline? <span style={{ color: T.green }}>friends relay your messages</span> when you return
      </Caption>
    </SceneFade>
  )
}

// ---------- 5. Features (150 = 5s) ----------
const FEATURES: Array<[string, string]> = [
  ['🔒', 'End-to-end encrypted, always'],
  ['🌐', 'Serverless — nothing to host or trust'],
  ['📨', 'Interrupt mid-turn, queue for turn end, or drop in the inbox'],
  ['👥', 'Group rooms — every session is a peer']
]

export const Features: React.FC = () => (
  <SceneFade duration={150}>
    <SceneTitle text="What you get" delay={3} />
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 50 }}>
        {FEATURES.map(([icon, title], i) => (
          <FadeUp key={title} delay={12 + i * 10} dist={36}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                width: 1240,
                background: '#ffffff',
                border: `2px solid ${T.border}`,
                borderRadius: 16,
                padding: '24px 34px',
                boxShadow: '0 6px 18px rgba(20,20,19,0.06)'
              }}
            >
              <div style={{ fontSize: 46 }}>{icon}</div>
              <div style={{ fontFamily: T.sans, fontSize: 36, fontWeight: 600, color: T.ink }}>{title}</div>
            </div>
          </FadeUp>
        ))}
      </div>
    </AbsoluteFill>
  </SceneFade>
)

// ---------- 6. CTA (180 = 6s) ----------
export const CTA: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <SceneFade duration={180}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 44 }}>
        <FadeUp delay={4}>
          <Terminal title="get started" width={1150}>
            <div>
              <span style={{ color: T.accent }}>$ </span>
              <Typewriter text="git clone https://github.com/wybe-labs/claude-together" delay={8} cps={3.4} />
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ color: T.accent }}>$ </span>
              <Typewriter text="npm install && npm run register" delay={44} cps={3.4} />
            </div>
            {frame > 78 && (
              <FadeUp delay={78} dist={10}>
                <div style={{ marginTop: 12, color: '#9fb383' }}>
                  ✓ ready — try /together-invite
                </div>
              </FadeUp>
            )}
          </Terminal>
        </FadeUp>
        <FadeUp delay={92}>
          <div style={{ fontFamily: T.serif, fontSize: 84, fontWeight: 700, color: T.ink }}>
            Claude <span style={{ color: T.accentDeep }}>Together</span>
          </div>
        </FadeUp>
        <FadeUp delay={106}>
          <div style={{ fontFamily: T.mono, fontSize: 36, color: T.dim }}>
            github.com/<span style={{ color: T.ink }}>wybe-labs/claude-together</span> · MIT
          </div>
        </FadeUp>
      </AbsoluteFill>
    </SceneFade>
  )
}
