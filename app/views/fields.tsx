import Link from 'next/link'
import { FIELDS, GROUP_LABELS } from '@/lib/taxonomy/fields.ts'
import type { FieldGroup } from '@/lib/taxonomy/fields.ts'
import { getMeta, getStats } from '@/lib/server/data.ts'
import { kit } from '@/lib/site/kit.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { emoji, fieldBlurb, fieldName, fmtNumber, groupLabel } from '@/lib/site/labels.ts'

const GROUP_COLORS = ['var(--pink)', 'var(--sky)', 'var(--lime)', 'var(--yellow)', 'var(--orange)', 'var(--violet)', 'var(--pink)', 'var(--sky)', 'var(--lime)']

export async function FieldsView({ site, base }: SiteProps) {
  const { t, r, locale, intl, conf } = kit(site, base)
  const [stats, { meta }] = await Promise.all([getStats(), getMeta()])
  // The Swiss site counts Swiss programmes.
  const count = (id: string) => (conf.country ? (meta?.counts[id]?.[conf.country] ?? 0) : (stats[id]?.programmes ?? 0))
  const groups = Object.keys(GROUP_LABELS) as FieldGroup[]
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h1 className="font-display text-5xl sm:text-6xl">{t.fields.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        {t.fields.sub(FIELDS.length)}{' '}
        <Link href={r.start} className="font-bold text-accent underline-offset-2 hover:underline">
          {t.fields.findOut} →
        </Link>
      </p>
      <nav className="mt-8 flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <a key={g} href={`#${g}`} className="chip on-color" style={{ background: GROUP_COLORS[i] }}>
            {groupLabel(g, locale)}
          </a>
        ))}
      </nav>
      {groups.map((g, gi) => (
        <section key={g} id={g} className="mt-14 scroll-mt-24">
          <h2 className="flex items-center gap-3 font-display text-3xl">
            <span className="h-5 w-5 rotate-12 rounded-md border-2 border-line" style={{ background: GROUP_COLORS[gi] }} aria-hidden="true" />
            {groupLabel(g, locale)}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <Link key={f.id} href={r.field(f.id)} className="card-sm card-pop flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{emoji(f.id)}</span>
                  <span className="hyphens-auto break-words font-display text-xl leading-tight">{fieldName(f.id, locale)}</span>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted">{fieldBlurb(f.id, locale)}</p>
                {count(f.id) > 0 && <p className="mt-3 text-xs font-bold text-muted">{t.fields.tracked(fmtNumber(count(f.id), intl))}</p>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
