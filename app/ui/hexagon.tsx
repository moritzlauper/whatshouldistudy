import { RIASEC_KEYS } from '@/lib/taxonomy/fields.ts'

/** RIASEC profile as a radar on Holland's hexagon (R, I, A, S, E, C clockwise). */
export function Hexagon({ profile, size = 220, labels = true, label = 'Interest profile', letters = RIASEC_KEYS as readonly string[] }: { profile: number[]; size?: number; labels?: boolean; label?: string; letters?: readonly string[] }) {
  const c = size / 2
  const r = size / 2 - (labels ? 24 : 6)
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f]
  }
  const ring = (f: number) => RIASEC_KEYS.map((_, i) => pt(i, f).join(',')).join(' ')
  const shape = profile.map((v, i) => pt(i, 0.12 + 0.88 * Math.max(0, Math.min(1, v))).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${RIASEC_KEYS.map((k, i) => `${k} ${Math.round(profile[i] * 100)}`).join(', ')}`} className="shrink-0">
      <polygon points={ring(1)} fill="var(--surface-2)" stroke="var(--line)" strokeWidth={2} strokeLinejoin="round" />
      {[0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--soft-line)" strokeWidth={1.5} />
      ))}
      {RIASEC_KEYS.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--soft-line)" strokeWidth={1.5} />
      })}
      <polygon points={shape} fill="var(--accent)" fillOpacity={0.85} stroke="var(--line)" strokeWidth={2.5} strokeLinejoin="round" />
      {labels &&
        RIASEC_KEYS.map((k, i) => {
          const [x, y] = pt(i, 1.2)
          return (
            <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800} fill="var(--ink)">
              {letters[i] ?? k}
            </text>
          )
        })}
    </svg>
  )
}
