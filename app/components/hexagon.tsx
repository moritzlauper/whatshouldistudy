import { RIASEC_KEYS } from '@/lib/taxonomy/fields.ts'

/** RIASEC profile as a radar on Holland's hexagon (R, I, A, S, E, C clockwise). */
export function Hexagon({ profile, size = 220, labels = true }: { profile: number[]; size?: number; labels?: boolean }) {
  const c = size / 2
  const r = size / 2 - (labels ? 22 : 6)
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f]
  }
  const ring = (f: number) => RIASEC_KEYS.map((_, i) => pt(i, f).join(',')).join(' ')
  const shape = profile.map((v, i) => pt(i, 0.12 + 0.88 * Math.max(0, Math.min(1, v))).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Interest profile: ${RIASEC_KEYS.map((k, i) => `${k} ${Math.round(profile[i] * 100)}`).join(', ')}`}>
      {[1, 0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {RIASEC_KEYS.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />
      })}
      <polygon points={shape} fill="var(--accent)" fillOpacity={0.22} stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {labels &&
        RIASEC_KEYS.map((k, i) => {
          const [x, y] = pt(i, 1.17)
          return (
            <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="var(--muted)">
              {k}
            </text>
          )
        })}
    </svg>
  )
}
