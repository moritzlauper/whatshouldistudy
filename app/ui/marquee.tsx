import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { emoji, fieldName } from '@/lib/site/labels.ts'
import type { Locale } from '@/lib/site/config.ts'

const ORDER = [...FIELDS].sort((a, b) => (a.id.length * 7) % 11 - (b.id.length * 7) % 11)

/** A tilted ribbon of every field, scrolling sideways. */
export function Marquee({ locale, color = 'var(--accent)', textColor = 'var(--accent-ink)', reverse = false, tilt = -2, offset = 0 }: { locale: Locale; color?: string; textColor?: string; reverse?: boolean; tilt?: number; offset?: number }) {
  const items = [...ORDER.slice(offset), ...ORDER.slice(0, offset)].slice(0, 40)
  const row = (copy: string) =>
    items.map((f) => (
    <span key={`${f.id}-${copy}`} className="mx-5 inline-flex items-center gap-2 whitespace-nowrap font-display text-2xl sm:text-3xl">
      <span aria-hidden="true">{emoji(f.id)}</span>
      {fieldName(f.id, locale)}
      <span aria-hidden="true" className="ml-5 opacity-60">✦</span>
    </span>
  ))
  return (
    <div className="relative -mx-8 overflow-hidden border-y-2 border-line py-3" style={{ background: color, color: textColor, transform: `rotate(${tilt}deg)` }} aria-hidden="true">
      <div className={`marquee-track${reverse ? ' reverse' : ''}`}>
        {row('a')}
        {row('b')}
      </div>
    </div>
  )
}
