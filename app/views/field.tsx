import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FIELDS, FIELD_BY_ID, RIASEC_KEYS, VALUE_KEYS } from '@/lib/taxonomy/fields.ts'
import type { Big5Key, SubjectKey } from '@/lib/taxonomy/fields.ts'
import { riasecCode } from '@/lib/engine/questionnaire.ts'
import { getMeta, getShard, getStats } from '@/lib/server/data.ts'
import { flag } from '@/lib/countries.ts'
import { TYPE_STYLE, typeLabel } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { kit } from '@/lib/site/kit.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { big5Label, countryLabel, emoji, fieldBlurb, fieldCareers, fieldName, fmtNumber, groupLabel, riasecLabel, subjectLabel, valueLabel } from '@/lib/site/labels.ts'
import { Hexagon } from '../ui/hexagon.tsx'
import { Burst, Sparkle } from '../ui/shapes.tsx'
import { Earnings } from '../ui/earnings.tsx'
import { JsonLd, fieldLd } from '../ui/json-ld.tsx'


export async function FieldView({ site, base, id }: SiteProps & { id: string }) {
  const { t, r, locale, intl, conf } = kit(site, base)
  const country = conf.country
  const f = FIELD_BY_ID[id]
  if (!f) notFound()
  const [stats, { meta }, shard] = await Promise.all([getStats(), getMeta(), country ? getShard(id) : Promise.resolve(null)])
  const s = stats[id]
  const name = fieldName(id, locale)
  const byCountry = Object.entries(meta?.counts[id] ?? {}).sort((a, b) => (country ? Number(b[0] === country) - Number(a[0] === country) : 0) || b[1] - a[1])
  const subjects = Object.entries(f.subjects)
    .filter(([, d]) => (d ?? 0) >= 0.5)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  const offers = VALUE_KEYS.filter((k) => f.values[k] >= 0.75)
  const traits = (Object.entries(f.big5) as Array<[Big5Key, number]>).filter(([, v]) => Math.abs(v) >= 0.15)
  const related = FIELDS.filter((x) => x.id !== f.id)
    .map((x) => ({ x, d: x.riasec.reduce((acc, v, i) => acc + (v - f.riasec[i]) ** 2, 0) + (x.group === f.group ? 0 : 0.15) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
    .map(({ x }) => x)
  const code = riasecCode(f.riasec)

  // Country sites: the institutions that teach it there.
  const chInstitutions = new Map<string, { name: string; type?: InstType; url?: string; levels: Set<string> }>()
  for (const p of shard?.programmes ?? []) {
    if (p.country !== country) continue
    const e = chInstitutions.get(p.institution) ?? { name: p.institution, type: p.institutionType as InstType | undefined, url: p.institutionUrl, levels: new Set<string>() }
    e.levels.add(p.level)
    chInstitutions.set(p.institution, e)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <JsonLd data={fieldLd(site, id, name)} />
      <Link href={r.fields} className="text-sm font-semibold text-muted hover:text-ink">
        ← {t.fields.back} · {groupLabel(f.group, locale)}
      </Link>
      <div className="relative mt-5">
        <Burst className="spin-slow absolute -right-2 -top-6 hidden sm:block" size={110} color="var(--yellow)" />
        <div className="text-7xl" aria-hidden="true">{emoji(id)}</div>
        <h1 className="mt-3 hyphens-auto break-words font-display text-5xl sm:text-7xl">{name}</h1>
        <p className="mt-5 max-w-3xl text-xl text-muted">{fieldBlurb(id, locale)}</p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-[1fr_1.2fr]">
        <div className="card p-6">
          <h2 className="font-display text-2xl">{t.fields.whoTitle}</h2>
          <div className="mt-3 flex items-center gap-4">
            <Hexagon profile={f.riasec} size={170} label={t.misc.profileLabel} />
            <div className="text-sm">
              <div className="font-display text-4xl">{code}</div>
              <ul className="mt-2 grid gap-1 text-muted">
                {[...code].map((k) => (
                  <li key={k}>{riasecLabel(k as (typeof RIASEC_KEYS)[number], locale).short}</li>
                ))}
              </ul>
            </div>
          </div>
          {traits.length > 0 && <p className="mt-4 text-sm text-muted">{t.fields.traits(traits.map(([k, v]) => (v > 0 ? big5Label(k, locale).high : big5Label(k, locale).low).split(',')[0]).join(', '))}</p>}
        </div>
        <div className="grid gap-5">
          <div className="card p-6">
            <h2 className="font-display text-2xl">{t.fields.buildsOn}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {subjects.map(([k, d]) => (
                <span key={k} className="chip">
                  {subjectLabel(k as SubjectKey, locale)} <span className="text-accent">{'●'.repeat(Math.round((d ?? 0) * 3))}</span>
                </span>
              ))}
            </div>
            {offers.length > 0 && (
              <>
                <h2 className="mt-6 font-display text-2xl">{t.fields.offers}</h2>
                <p className="mt-1 text-sm text-muted">{offers.map((k) => valueLabel(k, locale)).join(' · ')}</p>
              </>
            )}
          </div>
          <div className="card on-color bg-lime p-6">
            <h2 className="font-display text-2xl">{t.fields.leadsTo}</h2>
            <p className="mt-1 text-sm text-muted">{fieldCareers(id, locale).join(' · ')}</p>
            <div className="mt-3">
              <Earnings stat={s} />
            </div>
          </div>
        </div>
      </div>

      {chInstitutions.size > 0 && (
        <section className="card mt-10 p-6">
          <h2 className="font-display text-2xl">{t.fields.whereLocal(name)}</h2>
          <p className="mt-1 text-sm text-muted">{t.fields.whereLocalSub}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...chInstitutions.values()]
              .sort((a, b) => a.name.localeCompare(b.name, intl))
              .map((i) => (
                <a key={i.name} href={i.url} target="_blank" rel="noreferrer" className="chip on-color hover:-translate-y-0.5" style={{ background: i.type ? TYPE_STYLE[i.type]?.color : 'var(--surface)' }}>
                  {i.name}
                  {i.type && <span className="text-xs opacity-70">· {typeLabel(i.type, country, locale === 'en' ? 'en' : 'de')}</span>}
                </a>
              ))}
          </div>
        </section>
      )}

      {byCountry.length > 0 && (
        <section className="card mt-10 p-6">
          <h2 className="font-display text-2xl">{t.fields.tracked(fmtNumber(country ? (meta?.counts[id]?.[country] ?? 0) : (s?.programmes ?? 0), intl))}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {byCountry.map(([cc, n]) => (
              <span key={cc} className="chip">
                {flag(cc)} {countryLabel(cc, intl)} <span className="text-muted">{fmtNumber(n, intl)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-display text-3xl">{t.fields.related}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((x) => (
            <Link key={x.id} href={r.field(x.id)} className="card-sm card-pop flex items-center gap-3 p-4">
              <span className="text-2xl" aria-hidden="true">{emoji(x.id)}</span>
              <span>
                <span className="block font-bold">{fieldName(x.id, locale)}</span>
                <span className="text-xs text-muted">{groupLabel(x.group, locale)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="card relative mt-14 overflow-hidden bg-accent p-8 text-accent-ink sm:p-10">
        <Sparkle className="float absolute right-8 top-8" size={54} color="var(--yellow)" />
        <h2 className="font-display text-4xl">{t.fields.ctaTitle(name)}</h2>
        <p className="mt-3 max-w-2xl opacity-85">{t.fields.ctaText}</p>
        <Link href={r.start} className="btn btn-lime btn-lg mt-7">
          {t.fields.cta} →
        </Link>
      </div>
    </div>
  )
}
