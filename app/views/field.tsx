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
import { CATALOGUE_COUNTRIES, LEVEL_ORDER, LINK_ONLY, hasProgrammePages, programmeSlug } from '@/lib/catalogue.ts'
import { toCatalogueEntry } from '@/lib/programmes.ts'
import type { CatalogueEntry, Programme } from '@/lib/programmes.ts'
import { CatalogueRow } from '../ui/catalogue-row.tsx'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { inCountry } from './catalogue.tsx'

/** Programmes per country on the global field page. */
const PER_COUNTRY = 6

/**
 * A few programmes of one country for the field's page: the field's own before
 * those that only touch it, the surest matches first, bachelor before master,
 * one per institution (its plainest title), and the institutions with the most
 * programmes in the field first.
 */
function sample(ps: Programme[], id: string, n: number, intl: string): CatalogueEntry[] {
  const perInstitution = new Map<string, number>()
  for (const p of ps) perInstitution.set(p.institution, (perInstitution.get(p.institution) ?? 0) + 1)
  const sorted = ps
    .filter((p) => !p.parent)
    .sort(
      (a, b) =>
        Number(b.fields[0] === id) - Number(a.fields[0] === id) ||
        Math.round((b.fieldConfidence ?? 0) * 5) - Math.round((a.fieldConfidence ?? 0) * 5) ||
        LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
        perInstitution.get(b.institution)! - perInstitution.get(a.institution)! ||
        // At one institution, the plainest title stands for the rest.
        a.name.length - b.name.length ||
        a.name.localeCompare(b.name, intl),
    )
  const seen = new Set<string>()
  const out: CatalogueEntry[] = []
  for (const p of sorted) {
    if (seen.has(p.institution)) continue
    seen.add(p.institution)
    out.push(toCatalogueEntry(p))
    if (out.length === n) break
  }
  return out
}

export async function FieldView({ site, base, locale: selectedLocale, id }: SiteProps & { id: string }) {
  const { t, r, locale, intl, conf } = kit(site, base, selectedLocale)
  const country = conf.country
  const f = FIELD_BY_ID[id]
  if (!f) notFound()
  const [stats, { meta }, shard] = await Promise.all([getStats(), country ? Promise.resolve({ meta: null }) : getMeta(), getShard(id)])
  const s = stats[id]
  const name = fieldName(id, locale)
  // Global site only: links each country's catalogue. A country site has only its own, linked above.
  const byCountry = Object.entries(meta?.counts[id] ?? {})
    .filter(([cc]) => CATALOGUE_COUNTRIES.includes(cc))
    .sort((a, b) => b[1] - a[1])
  const sampleByCountry = new Map<string, CatalogueEntry[]>()
  if (!country) {
    const perCountry = new Map<string, Programme[]>()
    for (const p of shard?.programmes ?? []) {
      if (!perCountry.has(p.country)) perCountry.set(p.country, [])
      perCountry.get(p.country)!.push(p)
    }
    for (const [cc] of byCountry) sampleByCountry.set(cc, sample(perCountry.get(cc) ?? [], id, PER_COUNTRY, intl))
  }
  const programmeHref = (cc: string, p: CatalogueEntry) => (hasProgrammePages(cc) ? r.programme(cc, p.fields[0], programmeSlug(p)) : undefined)
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
  // Where the source allows it, every programme with its exact title: the field's own first, then by level.
  const ownProgrammes =
    country && !LINK_ONLY[country]
      ? (shard?.programmes ?? [])
          .filter((p) => p.country === country)
          .map(toCatalogueEntry)
          .sort((a, b) => Number(b.fields[0] === id) - Number(a.fields[0] === id) || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.name.localeCompare(b.name, intl))
      : []
  const byInstitution = new Map<string, typeof ownProgrammes>()
  for (const p of ownProgrammes) {
    if (!byInstitution.has(p.institution)) byInstitution.set(p.institution, [])
    byInstitution.get(p.institution)!.push(p)
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
          <p className="mt-1 text-sm text-muted">{ownProgrammes.length ? catalogueText(locale).listSub(fmtNumber(ownProgrammes.length, intl)) : t.fields.whereLocalSub}</p>
          {byInstitution.size > 0 ? (
            <div className="mt-6 grid gap-7">
              {[...byInstitution.entries()]
                .sort((a, b) => a[0].localeCompare(b[0], intl))
                .map(([inst, ps]) => {
                  const i = chInstitutions.get(inst)
                  return (
                    <div key={inst}>
                      <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-line pb-2">
                        <span className="font-display text-lg leading-tight">{inst}</span>
                        {i?.type && TYPE_STYLE[i.type] && (
                          <span className="chip on-color text-xs" style={{ background: TYPE_STYLE[i.type].color }}>
                            {typeLabel(i.type, country, locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it')}
                          </span>
                        )}
                      </h3>
                      <ul>
                        {ps.map((p) => (
                          <CatalogueRow key={p.id} p={p} country={country!} locale={locale} fieldHref={(x) => r.countryField(country!, x)} href={programmeHref(country!, p)} />
                        ))}
                      </ul>
                    </div>
                  )
                })}
            </div>
          ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...chInstitutions.values()]
              .sort((a, b) => a.name.localeCompare(b.name, intl))
              .map((i) => (
                <a key={i.name} href={i.url} target="_blank" rel="noreferrer" className="chip on-color hover:-translate-y-0.5" style={{ background: i.type ? TYPE_STYLE[i.type]?.color : 'var(--surface)' }}>
                  {i.name}
                  {i.type && <span className="text-xs opacity-70">· {typeLabel(i.type, country, locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it')}</span>}
                </a>
              ))}
          </div>
          )}
          <Link href={r.countryField(country!, id)} className="mt-5 inline-block font-bold text-accent hover:underline">
            {catalogueText(locale).searchIn(name)} →
          </Link>
        </section>
      )}

      {byCountry.length > 0 && (
        <section className="card mt-10 p-6">
          <h2 className="font-display text-2xl">{t.fields.whereLocal(name)}</h2>
          <p className="mt-1 text-sm text-muted">{t.fields.tracked(fmtNumber(s?.programmes ?? 0, intl))}</p>
          <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {byCountry.map(([cc, n]) => (
              <div key={cc}>
                <h3 className="flex items-baseline justify-between gap-3 border-b-2 border-line pb-2">
                  <span className="font-display text-lg leading-tight">
                    {flag(cc)} {countryLabel(cc, intl)}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{catalogueText(locale).programmesShort(fmtNumber(n, intl))}</span>
                </h3>
                <ul>
                  {(sampleByCountry.get(cc) ?? []).map((p) => (
                    <CatalogueRow key={p.id} p={p} country={cc} locale={locale} showInstitution fieldHref={(x) => r.countryField(cc, x)} href={programmeHref(cc, p)} />
                  ))}
                </ul>
                <Link href={r.countryField(cc, id)} className="mt-2 inline-block text-sm font-bold text-accent hover:underline">
                  {catalogueText(locale).allIn(name, inCountry(cc, locale))} →
                </Link>
              </div>
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
