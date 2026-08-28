import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { T } from './theme'

export const useSpringIn = (delay: number, durationInFrames = 30) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, durationInFrames, config: { damping: 200 } })
}

export const FadeUp: React.FC<{
  delay: number
  children: React.ReactNode
  style?: React.CSSProperties
  dist?: number
}> = ({ delay, children, style, dist = 40 }) => {
  const s = useSpringIn(delay)
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * dist}px)`, ...style }}>
      {children}
    </div>
  )
}

// Types text one character at a time starting at `delay`, cursor while typing.
export const Typewriter: React.FC<{
  text: string
  delay: number
  cps?: number
  style?: React.CSSProperties
  color?: string
  cursor?: boolean
}> = ({ text, delay, cps = 1.4, style, color = T.text, cursor = true }) => {
  const frame = useCurrentFrame()
  const chars = Math.max(0, Math.floor((frame - delay) * cps))
  const shown = text.slice(0, chars)
  const done = chars >= text.length
  const blink = Math.floor(frame / 16) % 2 === 0
  return (
    <span style={{ fontFamily: T.mono, color, whiteSpace: 'pre-wrap', ...style }}>
      {shown}
      {cursor && !done && frame >= delay && (
        <span style={{ opacity: blink ? 1 : 0, color: T.green }}>▋</span>
      )}
    </span>
  )
}

export const Terminal: React.FC<{
  title: string
  width: number
  children: React.ReactNode
  style?: React.CSSProperties
  accent?: string
}> = ({ title, width, children, style, accent = T.border }) => (
  <div
    style={{
      width,
      background: T.bgTerminal,
      border: `2px solid ${accent}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      ...style
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        background: T.bgPanel,
        borderBottom: `1px solid ${T.border}`
      }}
    >
      <Dot c="#ff5f57" />
      <Dot c="#febc2e" />
      <Dot c="#28c840" />
      <span style={{ marginLeft: 10, color: T.dim, fontFamily: T.mono, fontSize: 20 }}>{title}</span>
    </div>
    <div style={{ padding: 24, fontSize: 26, lineHeight: 1.6 }}>{children}</div>
  </div>
)

const Dot: React.FC<{ c: string }> = ({ c }) => (
  <div style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
)

// Animated line that draws itself between two points.
export const DrawnLine: React.FC<{
  x1: number
  y1: number
  x2: number
  y2: number
  delay: number
  color?: string
  width?: number
  dashed?: boolean
}> = ({ x1, y1, x2, y2, delay, color = T.cyan, width = 5, dashed = false }) => {
  const s = useSpringIn(delay, 25)
  const mx = x1 + (x2 - x1) * s
  const my = y1 + (y2 - y1) * s
  return (
    <line
      x1={x1}
      y1={y1}
      x2={mx}
      y2={my}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dashed ? '14 12' : undefined}
      opacity={s > 0.01 ? 1 : 0}
    />
  )
}

// A dot that travels from A to B between startFrame and endFrame.
export const Packet: React.FC<{
  x1: number
  y1: number
  x2: number
  y2: number
  start: number
  end: number
  color?: string
  r?: number
}> = ({ x1, y1, x2, y2, start, end, color = T.green, r = 12 }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const visible = frame >= start && frame <= end + 8
  const fade = interpolate(frame, [end, end + 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  if (!visible) return null
  return (
    <circle
      cx={x1 + (x2 - x1) * t}
      cy={y1 + (y2 - y1) * t}
      r={r}
      fill={color}
      opacity={fade}
      style={{ filter: `drop-shadow(0 0 12px ${color})` }}
    />
  )
}

export const SceneTitle: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => (
  <FadeUp delay={delay} style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center' }}>
    <span style={{ fontFamily: T.sans, fontSize: 52, fontWeight: 700, color: T.text }}>{text}</span>
  </FadeUp>
)

export const GridBg: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: T.bg,
      backgroundImage: `linear-gradient(${T.border}22 1px, transparent 1px), linear-gradient(90deg, ${T.border}22 1px, transparent 1px)`,
      backgroundSize: '64px 64px'
    }}
  />
)
