import type { SiteId } from '@/lib/site/config.ts'

/** A tilted sticker: a sparkle for the global site, the Swiss cross for the Swiss one. */
export function Logo({ site, size = 32 }: { site: SiteId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <g transform="rotate(-8 20 20)">
        <rect x={4} y={5} width={31} height={31} rx={9} fill="var(--line)" />
        <rect x={2.5} y={3} width={31} height={31} rx={9} fill="var(--accent)" stroke="var(--line)" strokeWidth={2.5} />
        {site === 'ch' ? (
          <path d="M15 9.5h6v6h6v6h-6v6h-6v-6H9v-6h6z" fill="#fff" stroke="var(--line)" strokeWidth={1.5} strokeLinejoin="round" />
        ) : (
          <path d="M18 7.5c1.2 6.8 2.8 8.4 9.5 9.5-6.7 1.1-8.3 2.7-9.5 9.5-1.2-6.8-2.8-8.4-9.5-9.5 6.7-1.1 8.3-2.7 9.5-9.5z" fill="#fff" stroke="var(--line)" strokeWidth={1.5} strokeLinejoin="round" />
        )}
      </g>
      <circle cx={33} cy={8} r={5} fill={site === 'ch' ? 'var(--yellow)' : 'var(--lime)'} stroke="var(--line)" strokeWidth={2} />
    </svg>
  )
}

export function Wordmark({ parts }: { parts: [string, string] }) {
  return (
    <span className="font-display text-lg tracking-tight">
      {parts[0]}
      <span className="text-accent">{parts[1]}</span>
    </span>
  )
}
