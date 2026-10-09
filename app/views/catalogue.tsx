import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATALOGUE_COUNTRIES, LEVEL_ORDER } from '@/lib/catalogue.ts'
import { COUNTRIES, flag } from '@/lib/countries.ts'
import { ADMISSION, TYPE_STYLE, admissionText, typeLabel } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { toCatalogueEntry } from '@/lib/programmes.ts'
import type { CatalogueEntry, DataMeta, Level } from '@/lib/programmes.ts'
import { getCatalogue, getMeta, getShard, getStats } from '@/lib/server/data.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { isLocal } from '@/lib/site/config.ts'
import type { Locale, SiteProps } from '@/lib/site/config.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import { pageUrl } from '@/lib/site/meta.ts'
import { countryLabel, emoji, fieldBlurb, fieldCareers, fieldName, fmtMoney, fmtNumber, groupLabel, levelLabel } from '@/lib/site/labels.ts'
import { FIELDS, FIELD_BY_ID, GROUP_LABELS } from '@/lib/taxonomy/fields.ts'
import type { FieldGroup } from '@/lib/taxonomy/fields.ts'
import { CatalogueRow } from '../ui/catalogue-row.tsx'
import { CatalogueSearch, MoreAt } from '../ui/catalogue-search.tsx'
import { JsonLd, breadcrumbLd } from '../ui/json-ld.tsx'
import { Burst, Sparkle } from '../ui/shapes.tsx'

/** At most this many programmes are listed on a field page; above it, each institution shows its first few. */
const ROW_BUDGET = 800
const TOP_INSTITUTIONS = 60

const lang = (locale: Locale) => (locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it')

/** "in Switzerland" in the page's language. */
export function inCountry(cc: string, locale: Locale): string {
  return catalogueText(locale).inCountry(cc, COUNTRIES[cc]?.name ?? cc)
}

/** Programmes and institutions of a country, or null where we have none. */
export function countryTotals(meta: DataMeta | null, cc: string) {
  const c = meta?.byCountry?.[cc]
  if (!c?.programmes || !CATALOGUE_COUNTRIES.includes(cc)) return null
  return c
}

const fieldCount = (meta: DataMeta | null, id: string, cc: string) => meta?.counts[id]?.[cc] ?? 0

function list(items: string[], intl: string): string {
  try {
    return new Intl.ListFormat(intl, { type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

function fmtDate(iso: string | undefined, intl: string): string {
  return iso ? new Date(iso).toLocaleDateString(intl, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

function crumbs(k: Kit, cc?: string, field?: { id: string; name: string }): Array<[string, string]> {
  const { site, locale, conf } = k
  const ct = catalogueText(locale)
  const out: Array<[string, string]> = [[conf.name, pageUrl(site, (r) => r.home, locale)]]
  if (!isLocal(site)) out.push([ct.indexTitle, pageUrl(site, (r) => r.programmes, locale)])
  if (cc) out.push([isLocal(site) ? ct.nav : countryLabel(cc, k.intl), pageUrl(site, (r) => r.country(cc), locale)])
  if (cc && field) out.push([field.name, pageUrl(site, (r) => r.countryField(cc, field.id), locale)])
  return out
}

function Cta({ k, title }: { k: Kit; title: string }) {
  const ct = catalogueText(k.locale)
  return (
    <div className="card relative mt-14 overflow-hidden bg-accent p-8 text-accent-ink sm:p-10">
      <Sparkle className="float absolute right-8 top-8" size={54} color="var(--yellow)" />
      <h2 className="max-w-2xl font-display text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl opacity-85">{ct.ctaText}</p>
      <Link href={k.r.start} className="btn btn-lime btn-lg mt-7">
        {ct.cta} →
      </Link>
    </div>
  )
}

/** Global site: every country with programme data. */
export async function CatalogueIndexView({ site, base, locale: selectedLocale }: SiteProps) {
  const k = kit(site, base, selectedLocale)
  const { r, intl, locale } = k
  const ct = catalogueText(locale)
  const { meta } = await getMeta()
  const countries = CATALOGUE_COUNTRIES.map((cc) => ({ cc, c: countryTotals(meta, cc) }))
    .filter((x): x is { cc: string; c: NonNullable<typeof x.c> } => !!x.c)
    .sort((a, b) => b.c.programmes - a.c.programmes)
  const total = countries.reduce((s, x) => s + x.c.programmes, 0)
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <JsonLd data={breadcrumbLd(crumbs(k))} />
      <h1 className="font-display text-5xl sm:text-6xl">{ct.indexTitle}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{ct.indexLead(fmtNumber(total, intl), countries.length)}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map(({ cc, c }) => (
          <Link key={cc} href={r.country(cc)} className="card-sm card-pop flex items-center gap-4 p-5">
            <span className="text-4xl" aria-hidden="true">{flag(cc)}</span>
            <span>
              <span className="block font-display text-2xl leading-tight">{countryLabel(cc, intl)}</span>
              <span className="text-sm text-muted">
                {ct.programmesShort(fmtNumber(c.programmes, intl))} · {ct.institutionsShort(fmtNumber(c.institutions, intl))}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <Cta k={k} title={ct.ctaTitle} />
    </div>
  )
}

/** One country: search, kinds of institution, fields, institutions, fees and sources. */
export async function CountryView({ site, base, locale: selectedLocale, country: cc }: SiteProps & { country: string }) {
  const k = kit(site, base, selectedLocale)
  const { r, intl, locale } = k
  const ct = catalogueText(locale)
  const [{ meta }, catalogue] = await Promise.all([getMeta(), getCatalogue(cc)])
  const totals = countryTotals(meta, cc)
  if (!totals) notFound()
  const inC = inCountry(cc, locale)
  const sources = (meta?.sources ?? []).filter((s) => s.countries.includes(cc) && s.count > 0 && s.id !== 'ch-bfs-salaries')
  const fields = FIELDS.filter((f) => fieldCount(meta, f.id, cc) > 0)
  const groups = (Object.keys(GROUP_LABELS) as FieldGroup[]).filter((g) => fields.some((f) => f.group === g))
  const types = Object.entries(totals.byType)
    .filter(([type]) => type in TYPE_STYLE)
    .sort((a, b) => b[1] - a[1]) as Array<[InstType, number]>
  const levels = LEVEL_ORDER.filter((l) => catalogue?.programmes.some((p) => p.level === l) ?? l === 'bachelor')

  // Institutions by number of programmes, with their website.
  const institutions = new Map<string, { name: string; n: number; url?: string; city?: string }>()
  for (const p of catalogue?.programmes ?? []) {
    const e = institutions.get(p.institution) ?? { name: p.institution, n: 0, url: p.institutionUrl, city: p.city }
    e.n++
    institutions.set(p.institution, e)
  }
  const topInstitutions = [...institutions.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, intl)).slice(0, TOP_INSTITUTIONS)
  const fees = ct.fees[cc] ?? (locale === 'en' ? COUNTRIES[cc]?.typicalTuition : undefined)

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <JsonLd data={breadcrumbLd(crumbs(k, cc))} />
      {!isLocal(site) && (
        <Link href={r.programmes} className="text-sm font-semibold text-muted hover:text-ink">
          ← {ct.indexTitle}
        </Link>
      )}
      <div className="relative mt-5">
        <Burst className="spin-slow absolute -right-2 -top-6 hidden sm:block" size={110} color="var(--lime)" />
        <div className="text-7xl" aria-hidden="true">{flag(cc)}</div>
        <h1 className="mt-3 hyphens-auto break-words font-display text-5xl sm:text-6xl">{ct.h1(inC)}</h1>
        <p className="mt-5 max-w-3xl text-xl text-muted">{ct.lead(fmtNumber(totals.programmes, intl), fmtNumber(totals.institutions, intl), list(sources.map((s) => s.name), intl))}</p>
        <p className="mt-2 text-sm text-muted">{ct.updated(fmtDate(meta?.updated, intl))}</p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-xl">
        {[
          [ct.statProgrammes, totals.programmes],
          [ct.statInstitutions, totals.institutions],
          [ct.statFields, fields.length],
        ].map(([label, n]) => (
          <div key={label} className="card-sm p-4">
            <div className="font-display text-3xl">{fmtNumber(n as number, intl)}</div>
            <div className="text-xs font-bold text-muted">{label}</div>
          </div>
        ))}
      </div>

      <div id="search" className="mt-10 scroll-mt-24">
        <CatalogueSearch country={cc} levels={levels} title={ct.search.label} />
      </div>

      {types.length > 1 && (
        <section className="mt-14">
          <h2 className="font-display text-3xl">{ct.typesTitle}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {types.map(([type, n]) => {
              const admission = admissionText(cc, type, lang(locale))
              return (
                <div key={type} className="card-sm p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-line text-xl" style={{ background: TYPE_STYLE[type].color }} aria-hidden="true">
                      {TYPE_STYLE[type].glyph}
                    </span>
                    <span>
                      <span className="block font-bold">{typeLabel(type, cc, lang(locale))}</span>
                      <span className="text-xs text-muted">{ct.programmesShort(fmtNumber(n, intl))}</span>
                    </span>
                  </div>
                  {admission && (
                    <p className="mt-3 text-sm text-muted">
                      <span className="font-bold text-ink">{ct.admission}:</span> {admission}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="font-display text-3xl">{ct.fieldsTitle}</h2>
        <p className="mt-2 text-muted">{ct.fieldsSub(inC)}</p>
        {groups.map((g) => (
          <div key={g} className="mt-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{groupLabel(g, locale)}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields
                .filter((f) => f.group === g)
                .map((f) => (
                  <Link key={f.id} href={r.countryField(cc, f.id)} className="card-sm card-pop flex items-center gap-3 p-4">
                    <span className="text-2xl" aria-hidden="true">{emoji(f.id)}</span>
                    <span className="min-w-0">
                      <span className="block hyphens-auto break-words font-bold leading-tight">{fieldName(f.id, locale)}</span>
                      <span className="text-xs text-muted">{ct.programmesShort(fmtNumber(fieldCount(meta, f.id, cc), intl))}</span>
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </section>

      {topInstitutions.length > 0 && (
        <section className="card mt-14 p-6">
          <h2 className="font-display text-3xl">{ct.institutionsTitle}</h2>
          <p className="mt-1 text-sm text-muted">{institutions.size > TOP_INSTITUTIONS ? ct.institutionsSub(TOP_INSTITUTIONS) : ct.institutionsAll}</p>
          <ul className="mt-4 grid gap-x-6 sm:grid-cols-2">
            {topInstitutions.map((i) => (
              <li key={i.name} className="flex items-baseline justify-between gap-3 border-b border-line/15 py-2">
                {i.url ? (
                  <a href={i.url} target="_blank" rel="noopener" className="min-w-0 font-semibold hover:text-accent">
                    {i.name}
                  </a>
                ) : (
                  <span className="min-w-0 font-semibold">{i.name}</span>
                )}
                <span className="shrink-0 text-xs text-muted">{fmtNumber(i.n, intl)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {fees && (
          <section className="card-sm p-6">
            <h2 className="font-display text-2xl">{ct.feesTitle}</h2>
            <p className="mt-2 text-sm text-muted">{fees}</p>
          </section>
        )}
        <section className="card-sm p-6">
          <h2 className="font-display text-2xl">{ct.sourcesTitle}</h2>
          <p className="mt-2 text-sm text-muted">{ct.sourcesText}</p>
          <ul className="mt-3 grid gap-1 text-sm">
            {sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener" className="font-semibold hover:text-accent">
                  {s.name}
                </a>
                <span className="text-xs text-muted"> · {s.licence}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Cta k={k} title={ct.ctaTitle} />

      {!isLocal(site) && meta && (
        <section className="mt-12">
          <h2 className="font-display text-2xl">{ct.otherCountries}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATALOGUE_COUNTRIES.filter((x) => x !== cc && countryTotals(meta, x)).map((x) => (
              <Link key={x} href={r.country(x)} className="chip hover:-translate-y-0.5">
                {flag(x)} {countryLabel(x, intl)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Fewest programmes per institution and level that keeps the page under ROW_BUDGET rows; everything if it fits. */
function rowsPerGroup(sizes: number[]): number {
  if (sizes.reduce((s, n) => s + n, 0) <= ROW_BUDGET) return Infinity
  let limit = Math.max(...sizes)
  while (limit > 3 && sizes.reduce((s, n) => s + Math.min(n, limit), 0) > ROW_BUDGET) limit--
  return limit
}

/** Every programme of one field in one country, by level and institution. */
export async function CountryFieldView({ site, base, locale: selectedLocale, country: cc, id }: SiteProps & { country: string; id: string }) {
  const k = kit(site, base, selectedLocale)
  const { r, intl, locale, t } = k
  const ct = catalogueText(locale)
  const f = FIELD_BY_ID[id]
  if (!f) notFound()
  const [{ meta }, shard, stats] = await Promise.all([getMeta(), getShard(id), getStats()])
  if (!countryTotals(meta, cc)) notFound()
  // Only the catalogue's own fields reach the page; fees, earnings and admission rates stay in the paid list.
  const programmes: CatalogueEntry[] = (shard?.programmes ?? []).filter((p) => p.country === cc).map(toCatalogueEntry)
  if (!programmes.length) notFound()
  const name = fieldName(id, locale)
  const inC = inCountry(cc, locale)

  const byLevel = LEVEL_ORDER.map((level) => {
    const insts = new Map<string, CatalogueEntry[]>()
    let n = 0
    for (const p of programmes) {
      if (p.level !== level) continue
      if (!insts.has(p.institution)) insts.set(p.institution, [])
      insts.get(p.institution)!.push(p)
      n++
    }
    return { level, institutions: [...insts.entries()].sort((a, b) => a[0].localeCompare(b[0], intl)), n }
  }).filter((l) => l.n > 0)
  const limit = rowsPerGroup(byLevel.flatMap((l) => l.institutions.map(([, ps]) => ps.length)))
  const institutionCount = new Set(programmes.map((p) => p.institution)).size
  const levelsText = list(byLevel.map((l) => ct.levelCount(fmtNumber(l.n, intl), levelLabel(l.level, locale))), intl)
  const types = [...new Set(programmes.map((p) => p.institutionType).filter((x): x is InstType => !!x && x in TYPE_STYLE))]
  const admissions = types.map((type) => [type, admissionText(cc, type, lang(locale))] as const).filter(([, a]) => a && ADMISSION[cc])
  const s = stats[id]
  const earnings =
    cc === 'CH' && s?.ch
      ? [ct.earningsCh, [s.ch.uhMaster && `${t.earnings.uhMaster}: ${fmtMoney(s.ch.uhMaster, 'CHF', intl)}`, s.ch.fhBachelor && `${t.earnings.fhBachelor}: ${fmtMoney(s.ch.fhBachelor, 'CHF', intl)}`].filter(Boolean).join(' · '), t.earnings.chSource(s.ch.year)]
      : cc === 'US' && s?.usMedianEarnings
        ? [ct.earningsUs, fmtMoney(s.usMedianEarnings, 'USD', intl), t.earnings.usSource]
        : null
  const related = FIELDS.filter((x) => x.id !== id && x.group === f.group && fieldCount(meta, x.id, cc) > 0)
    .sort((a, b) => fieldCount(meta, b.id, cc) - fieldCount(meta, a.id, cc))
    .slice(0, 6)

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <JsonLd data={breadcrumbLd(crumbs(k, cc, { id, name }))} />
      <Link href={r.country(cc)} className="text-sm font-semibold text-muted hover:text-ink">
        ← {ct.allProgrammes(inC)}
      </Link>
      <div className="relative mt-5">
        <Burst className="spin-slow absolute -right-2 -top-6 hidden sm:block" size={110} color="var(--yellow)" />
        <div className="text-7xl" aria-hidden="true">
          {emoji(id)}
          <span className="ml-2 text-5xl">{flag(cc)}</span>
        </div>
        <h1 className="mt-3 hyphens-auto break-words font-display text-5xl sm:text-6xl">{ct.fieldH1(name, inC)}</h1>
        <p className="mt-5 max-w-3xl text-xl text-muted">{ct.fieldSummary(name, inC, fmtNumber(programmes.length, intl), fmtNumber(institutionCount, intl), levelsText)}</p>
        {byLevel.length > 1 && (
          <nav className="mt-5 flex flex-wrap gap-2">
            {byLevel.map((l) => (
              <a key={l.level} href={`#${l.level}`} className="chip">
                {levelLabel(l.level, locale)} <span className="text-muted">{fmtNumber(l.n, intl)}</span>
              </a>
            ))}
          </nav>
        )}
      </div>

      <div className="mt-10">
        <CatalogueSearch country={cc} field={id} levels={byLevel.map((l) => l.level)} title={ct.searchIn(name)} />
      </div>

      {byLevel.map((l) => (
        <section key={l.level} id={l.level} className="mt-12 scroll-mt-24">
          <h2 className="font-display text-3xl">
            {levelLabel(l.level, locale)} <span className="text-muted">({fmtNumber(l.n, intl)})</span>
          </h2>
          <div className="mt-5 grid gap-4">
            {l.institutions.map(([inst, ps]) => {
              const first = ps[0]
              const type = first.institutionType as InstType | undefined
              return (
                <div key={inst} className="card-sm p-5">
                  <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-display text-xl leading-tight">{inst}</span>
                    {type && type in TYPE_STYLE && (
                      <span className="chip on-color text-xs" style={{ background: TYPE_STYLE[type].color }}>
                        {typeLabel(type, cc, lang(locale))}
                      </span>
                    )}
                    {first.institutionUrl && (
                      <a href={first.institutionUrl} target="_blank" rel="noopener" className="text-xs font-bold text-accent hover:underline">
                        {ct.search.website} ↗
                      </a>
                    )}
                  </h3>
                  <ul className="mt-2">
                    {ps.slice(0, limit).map((p) => (
                      <CatalogueRow key={p.id} p={p} locale={locale} showLevel={false} />
                    ))}
                  </ul>
                  {ps.length > limit && <MoreAt label={ct.moreAt(fmtNumber(ps.length - limit, intl))} q={inst} level={l.level} />}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="mt-14 grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <section className="card p-6">
          <h2 className="font-display text-2xl">{ct.aboutTitle(name)}</h2>
          <p className="mt-2 text-muted">{fieldBlurb(id, locale)}</p>
          <h3 className="mt-5 font-bold">{ct.careers}</h3>
          <p className="mt-1 text-sm text-muted">{fieldCareers(id, locale).join(' · ')}</p>
          {earnings && (
            <div className="mt-5 text-sm">
              <div className="font-bold">{earnings[0]}</div>
              <div className="text-muted">{earnings[1]}</div>
              <div className="mt-0.5 text-xs text-muted">{earnings[2]}</div>
            </div>
          )}
          <Link href={r.field(id)} className="mt-5 inline-block font-bold text-accent hover:underline">
            {ct.aboutMore(name)} →
          </Link>
        </section>
        {admissions.length > 0 && (
          <section className="card-sm p-6">
            <h2 className="font-display text-2xl">{ct.admissionTitle}</h2>
            <ul className="mt-3 grid gap-3 text-sm">
              {admissions.map(([type, a]) => (
                <li key={type}>
                  <span className="font-bold">{typeLabel(type, cc, lang(locale))}:</span> <span className="text-muted">{a}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-3xl">{ct.relatedTitle(inC)}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((x) => (
              <Link key={x.id} href={r.countryField(cc, x.id)} className="card-sm card-pop flex items-center gap-3 p-4">
                <span className="text-2xl" aria-hidden="true">{emoji(x.id)}</span>
                <span>
                  <span className="block font-bold">{fieldName(x.id, locale)}</span>
                  <span className="text-xs text-muted">{ct.programmesShort(fmtNumber(fieldCount(meta, x.id, cc), intl))}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Cta k={k} title={ct.fieldCtaTitle(name)} />
    </div>
  )
}

/** Title and description of a field page, for its metadata. */
export async function countryFieldText(cc: string, id: string, locale: Locale): Promise<{ title: string; description: string; index: boolean } | null> {
  const ct = catalogueText(locale)
  const [{ meta }, shard] = await Promise.all([getMeta(), getShard(id)])
  if (!FIELD_BY_ID[id] || !countryTotals(meta, cc)) return null
  const programmes = (shard?.programmes ?? []).filter((p) => p.country === cc)
  if (!programmes.length) return null
  const intl = locale
  const name = fieldName(id, locale)
  const inC = inCountry(cc, locale)
  const n = fmtNumber(programmes.length, intl)
  const levels = list(
    LEVEL_ORDER.map((l) => [l, programmes.filter((p) => p.level === l).length] as [Level, number])
      .filter(([, c]) => c > 0)
      .map(([l, c]) => ct.levelCount(fmtNumber(c, intl), levelLabel(l, locale))),
    intl,
  )
  return {
    title: ct.fieldMetaTitle(name, inC, n),
    description: ct.fieldMetaDesc(name, inC, n, fmtNumber(new Set(programmes.map((p) => p.institution)).size, intl), levels),
    // A field with one or two programmes is too thin a page to index.
    index: programmes.length >= 3,
  }
}

/** Title and description of a country page. */
export async function countryText(cc: string, locale: Locale): Promise<{ title: string; description: string } | null> {
  const ct = catalogueText(locale)
  const { meta } = await getMeta()
  const c = countryTotals(meta, cc)
  if (!c) return null
  const inC = inCountry(cc, locale)
  return { title: ct.metaTitle(inC, fmtNumber(c.programmes, locale)), description: ct.metaDesc(inC, fmtNumber(c.programmes, locale), fmtNumber(c.institutions, locale)) }
}
