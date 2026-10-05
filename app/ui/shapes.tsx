/** Decorative shapes for the hype look. All aria-hidden. */

type ShapeProps = { className?: string; color?: string; size?: number; style?: React.CSSProperties }

function burst(n: number, outer: number, inner: number, c = 50) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(c + Math.cos(a) * r).toFixed(1)},${(c + Math.sin(a) * r).toFixed(1)}`)
  }
  return pts.join(' ')
}

export function Burst({ className, color = 'var(--yellow)', size = 96, style, spikes = 12 }: ShapeProps & { spikes?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" className={className} style={style}>
      <polygon points={burst(spikes, 48, 34)} fill={color} stroke="var(--line)" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  )
}

export function Sparkle({ className, color = 'var(--pink)', size = 48, style }: ShapeProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" className={className} style={style}>
      <path d="M50 4 C55 38 62 45 96 50 C62 55 55 62 50 96 C45 62 38 55 4 50 C38 45 45 38 50 4Z" fill={color} stroke="var(--line)" strokeWidth={3.5} strokeLinejoin="round" />
    </svg>
  )
}

export function Blob({ className, color = 'var(--lime)', size = 160, style }: ShapeProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 200 200" className={className} style={style}>
      <path
        d="M151 37c22 19 34 52 27 82s-33 57-64 62-66-13-81-41-10-66 10-90 49-35 72-31 23-1 36 18z"
        fill={color}
        stroke="var(--line)"
        strokeWidth={4}
      />
    </svg>
  )
}

export function Squiggle({ className, color = 'var(--accent)', size = 140, style }: ShapeProps) {
  return (
    <svg aria-hidden="true" width={size} height={size * 0.3} viewBox="0 0 140 42" className={className} style={style}>
      <path d="M4 30 Q 18 4 32 21 T 60 21 T 88 21 T 116 21 T 136 14" fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" />
    </svg>
  )
}

export function Ring({ className, color = 'var(--sky)', size = 90, style }: ShapeProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" className={className} style={style}>
      <circle cx={50} cy={50} r={36} fill="none" stroke="var(--line)" strokeWidth={22} />
      <circle cx={50} cy={50} r={36} fill="none" stroke={color} strokeWidth={15} />
    </svg>
  )
}

export function Pill({ className, color = 'var(--orange)', size = 120, style }: ShapeProps) {
  return (
    <svg aria-hidden="true" width={size} height={size * 0.45} viewBox="0 0 120 54" className={className} style={style}>
      <rect x={3} y={3} width={114} height={48} rx={24} fill={color} stroke="var(--line)" strokeWidth={3.5} />
    </svg>
  )
}

/** Swiss cross in a red square. */
export function SwissFlag({ className, size = 40, style }: ShapeProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" className={className} style={style}>
      <rect x={1.5} y={1.5} width={29} height={29} rx={6} fill="#ff2b3a" stroke="var(--line)" strokeWidth={2} />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" />
    </svg>
  )
}

/** Small flag sticker for a site: Swiss cross, German and Austrian stripes, a globe for the global site. */
export function SiteFlag({ site, size = 20 }: { site: 'global' | 'ch' | 'de' | 'at'; size?: number }) {
  if (site === 'ch') return <SwissFlag size={size} />
  if (site === 'global') return <span aria-hidden="true">🌍</span>
  const stripes = site === 'de' ? ['#1a1033', '#dd0000', '#ffce00'] : ['#ed2939', '#ffffff', '#ed2939']
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32">
      <clipPath id={`flag-${site}`}>
        <rect x={1.5} y={1.5} width={29} height={29} rx={6} />
      </clipPath>
      <g clipPath={`url(#flag-${site})`}>
        {stripes.map((c, i) => (
          <rect key={i} x={0} y={i * 10.67} width={32} height={10.67} fill={c} />
        ))}
      </g>
      <rect x={1.5} y={1.5} width={29} height={29} rx={6} fill="none" stroke="var(--line)" strokeWidth={2} />
    </svg>
  )
}
