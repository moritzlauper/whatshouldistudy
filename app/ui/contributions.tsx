'use client'

import type { FieldMatch } from '@/lib/engine/types.ts'
import { useSite } from './site-context.tsx'

const COLOR: Record<string, string> = {
  takeout: 'var(--pink)',
  'google-search': 'var(--sky)',
  youtube: 'var(--orange)',
  instagram: 'var(--violet)',
  tiktok: 'var(--lime)',
  reddit: 'var(--orange)',
  github: 'var(--sky)',
  spotify: 'var(--lime)',
  'spotify-export': 'var(--lime)',
  footprint: 'var(--soft-line)',
  riasecData: 'var(--accent)',
  riasec: 'var(--yellow)',
  subjects: 'var(--yellow)',
  values: 'var(--yellow)',
  personality: 'var(--yellow)',
}

/** How much each source and questionnaire part adds to a field's match. */
export function Contributions({ m }: { m: FieldMatch }) {
  const { t } = useSite()
  const list = m.contributions ?? []
  if (!list.length) return null
  const c = t.contrib
  const label = (k: string) => (c.parts as Record<string, string>)[k] ?? t.sourceNames[k] ?? k
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{c.title}</div>
      <div className="mt-2 flex h-3.5 overflow-hidden rounded-full border-2 border-line" role="img" aria-label={list.map((x) => `${label(x.key)} ${c.pct(Math.round(x.share * 100))}`).join(', ')}>
        {list.map((x) => (
          <span key={x.key} className="h-full border-r border-line last:border-r-0" style={{ width: `${x.share * 100}%`, background: COLOR[x.key] ?? 'var(--accent)' }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {list
          .filter((x) => x.share >= 0.03)
          .map((x) => (
            <li key={x.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-line" style={{ background: COLOR[x.key] ?? 'var(--accent)' }} aria-hidden="true" />
              <span className="text-muted">{label(x.key)}</span>
              <span className="font-bold">{c.pct(Math.round(x.share * 100))}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
