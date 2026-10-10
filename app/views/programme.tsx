import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { LEVEL_ORDER, programmeSlug } from '@/lib/catalogue.ts'
import { flag } from '@/lib/countries.ts'
import { TYPE_STYLE, typeLabel } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { toCatalogueEntry } from '@/lib/programmes.ts'
import type { CatalogueEntry, Programme } from '@/lib/programmes.ts'
import { getCatalogue, getMeta, getStats } from '@/lib/server/data.ts'
import { resolveProgramme } from '@/lib/server/programme.ts'
import type { FoundProgramme } from '@/lib/server/programme.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import type { Locale, SiteProps } from '@/lib/site/config.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import { pageUrl } from '@/lib/site/meta.ts'
import { countryLabel, emoji, fieldBlurb, fieldCareers, fieldName, fmtMoney, levelLabel } from '@/lib/site/labels.ts'
import { catalogueFacts } from '../ui/catalogue-row.tsx'
import { JsonLd, breadcrumbLd } from '../ui/json-ld.tsx'
import { Burst } from '../ui/shapes.tsx'
import { Cta, countryTotals, crumbs, fmtDate, inCountry } from './catalogue.tsx'

/**
 * One page per programme, for every country whose source has an open licence
 * (see LINK_ONLY): what the free catalogue knows about it, the programmes next
 * to it, and the field it belongs to. Fees by citizenship, earnings of the
 * programme and admission rates stay in the paid list.
 */

const RELATED = 12

const lang = (locale: Locale) => (locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it')

/** For a page: the programme, or a 404, or the move to its own address. */
async function programmeOr404(k: Kit, cc: string, field: string, slug: string): Promise<FoundProgramme> {
  const res = await resolveProgramme(cc, field, slug)
  if (!res) notFound()
  if ('redirect' in res) permanentRedirect(k.r.programme(cc, res.redirect.field, res.redirect.slug))
  return res.found
}

const href = (k: Kit, cc: string, p: Pick<CatalogueEntry, 'id' | 'name' | 'institution' | 'focus' | 'fields'>) => k.r.programme(cc, p.fields[0], programmeSlug(p))

/** Where a programme is: city and region, or the country. */
const placeOf = (p: Pick<Programme, 'city' | 'region'>) => [p.city, p.region].filter(Boolean).join(', ')

/** Programmes of the same field elsewhere in the country: same level, the same city first, then the same region. */
function nearby(all: Programme[], p: Programme): Programme[] {
  const rank = (q: Programme) => (q.city && q.city === p.city ? 0 : q.region && q.region === p.region ? 1 : 2)
  return all
    .filter((q) => q.country === p.country && q.level === p.level && q.institution !== p.institution && !q.parent)
    .map((q, i) => ({ q, r: rank(q), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, RELATED)
    .map((x) => x.q)
}

function Related({ k, cc, title, items, showInstitution, more }: { k: Kit; cc: string; title: string; items: CatalogueEntry[]; showInstitution: boolean; more?: { label: string; href: string } }) {
  if (!items.length) return null
  return (
    <section className="mt-12">
      <h2 className="font-display text-3xl">{title}</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((q) => (
          <li key={q.id}>
            <Link href={href(k, cc, q)} className="card-sm card-pop block h-full p-4">
              <span className="block font-bold leading-snug">{q.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{[levelLabel(q.level, k.locale), showInstitution ? q.institution : null, q.city].filter(Boolean).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
      {more && (
        <Link href={more.href} className="mt-4 inline-block font-bold text-accent hover:underline">
          {more.label} →
        </Link>
      )}
    </section>
  )
}

export async function ProgrammeView({ site, base, locale: selectedLocale, country: cc, field, slug }: SiteProps & { country: string; field: string; slug: string }) {
  const k = kit(site, base, selectedLocale)
  const { r, intl, locale, t } = k
  const ct = catalogueText(locale)
  const d = ct.detail
  const [{ p: full, shard }, { meta }, stats] = await Promise.all([programmeOr404(k, cc, field, slug), getMeta(), getStats()])
  if (!countryTotals(meta, cc)) notFound()
  // Only the catalogue's own fields reach the page; fees, earnings and admission rates stay in the paid list.
  const p = toCatalogueEntry(full)
  const fname = fieldName(field, locale)
  const inC = inCountry(cc, locale)
  const type = p.institutionType && p.institutionType in TYPE_STYLE ? (p.institutionType as InstType) : undefined
  const source = meta?.sources.find((s) => s.id === full.source)

  const inCountryShard = shard.programmes.filter((q) => q.country === cc)
  const sameInstitution = inCountryShard
    .filter((q) => q.institution === p.institution && q.id !== p.id && q.id !== p.parent && q.parent !== p.id)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.name.localeCompare(b.name, intl))
    .slice(0, RELATED)
    .map(toCatalogueEntry)
  const elsewhere = nearby(inCountryShard, full).map(toCatalogueEntry)
  // Majors are split out for Switzerland only, whose catalogue is small enough to look through.
  const catalogue = full.source === 'ch-studyprogrammes' ? await getCatalogue(cc) : null
  const parent = p.parent ? catalogue?.programmes.find((q) => q.id === p.parent) : undefined
  const majors = catalogue?.programmes.filter((q) => q.parent === p.id) ?? []

  const s = stats[field]
  const earnings =
    cc === 'CH' && s?.ch
      ? [ct.earningsCh, [s.ch.uhMaster && `${t.earnings.uhMaster}: ${fmtMoney(s.ch.uhMaster, 'CHF', intl)}`, s.ch.fhBachelor && `${t.earnings.fhBachelor}: ${fmtMoney(s.ch.fhBachelor, 'CHF', intl)}`].filter(Boolean).join(' · '), t.earnings.chSource(s.ch.year)]
      : cc === 'US' && s?.usMedianEarnings
        ? [ct.earningsUs, fmtMoney(s.usMedianEarnings, 'USD', intl), t.earnings.usSource]
        : null

  const url = pageUrl(site, (x) => x.programme(cc, field, slug), locale)
  const trail: Array<[string, string]> = [...crumbs(k, cc, { id: field, name: fname }), [p.name, url]]
  const months = p.durationYears ? Math.round(p.durationYears * 12) : 0
  const ld = {
    '@graph': [
      breadcrumbLd(trail),
      {
        '@type': 'EducationalOccupationalProgram',
        '@id': `${url}#programme`,
        name: p.name,
        url,
        ...(p.url ? { sameAs: p.url } : {}),
        provider: {
          '@type': 'CollegeOrUniversity',
          name: p.institution,
          ...(p.institutionUrl ? { url: p.institutionUrl } : {}),
          address: { '@type': 'PostalAddress', ...(p.city ? { addressLocality: p.city } : {}), ...(p.region ? { addressRegion: p.region } : {}), addressCountry: cc },
        },
        educationalCredentialAwarded: p.degreeTitle ?? levelLabel(p.level, locale),
        ...(months ? { timeToComplete: `P${months}M` } : {}),
        ...(p.languages?.length ? { inLanguage: p.languages } : {}),
        ...(p.ects ? { numberOfCredits: p.ects } : {}),
        ...(p.mode ? { educationalProgramMode: p.mode } : {}),
        ...(p.requirements || p.admission ? { programPrerequisites: p.requirements ?? p.admission } : {}),
        ...(p.focus?.length ? { teaches: p.focus } : {}),
      },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <JsonLd data={ld} />
      <Link href={r.countryField(cc, field)} className="text-sm font-semibold text-muted hover:text-ink">
        ← {ct.allIn(fname, inC)}
      </Link>
      <div className="relative mt-5">
        <Burst className="spin-slow absolute -right-2 -top-6 hidden sm:block" size={100} color="var(--yellow)" />
        <div className="text-6xl" aria-hidden="true">
          {emoji(field)}
          <span className="ml-2 text-4xl">{flag(cc)}</span>
        </div>
        <h1 className="mt-3 max-w-4xl hyphens-auto break-words font-display text-4xl sm:text-5xl">{p.name}</h1>
        <p className="mt-4 max-w-3xl text-xl text-muted">
          {p.institutionUrl ? (
            <a href={p.institutionUrl} target="_blank" rel="noopener" className="font-semibold text-ink hover:text-accent">
              {p.institution}
            </a>
          ) : (
            <span className="font-semibold text-ink">{p.institution}</span>
          )}
          {' · '}
          {[placeOf(p), countryLabel(cc, intl)].filter(Boolean).join(', ')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip">{levelLabel(p.level, locale)}</span>
          {type && (
            <span className="chip on-color" style={{ background: TYPE_STYLE[type].color }}>
              {typeLabel(type, cc, lang(locale))}
            </span>
          )}
          {p.fields.map((f) => (
            <Link key={f} href={r.countryField(cc, f)} className="chip hover:-translate-y-0.5">
              {emoji(f)} {fieldName(f, locale)}
            </Link>
          ))}
        </div>
        {parent && (
          <p className="mt-4 text-sm">
            <span className="text-muted">{ct.partOf}: </span>
            <Link href={href(k, cc, parent)} className="font-bold text-accent hover:underline">
              {parent.name}
            </Link>
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener" className="btn btn-primary">
              {d.official} ↗
            </a>
          )}
          {p.regulationsUrl && (
            <a href={p.regulationsUrl} target="_blank" rel="noopener" className="btn btn-ghost">
              {d.regulations} ↗
            </a>
          )}
          {p.institutionUrl && p.institutionUrl !== p.url && (
            <a href={p.institutionUrl} target="_blank" rel="noopener" className="btn btn-ghost">
              {d.website} ↗
            </a>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <h2 className="font-display text-2xl">{ct.factsTitle}</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {catalogueFacts(p, cc, locale, (f) => r.countryField(cc, f)).map(([key, v]) => (
              <div key={key} className="contents">
                <dt className="font-bold">{key}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="card-sm p-6">
          <h2 className="font-display text-2xl">{ct.aboutTitle(fname)}</h2>
          <p className="mt-2 text-sm text-muted">{fieldBlurb(field, locale)}</p>
          <h3 className="mt-4 font-bold">{ct.careers}</h3>
          <p className="mt-1 text-sm text-muted">{fieldCareers(field, locale).join(' · ')}</p>
          {earnings && (
            <div className="mt-4 text-sm">
              <div className="font-bold">{earnings[0]}</div>
              <div className="text-muted">{earnings[1]}</div>
              <div className="mt-0.5 text-xs text-muted">{earnings[2]}</div>
            </div>
          )}
          <Link href={r.field(field)} className="mt-4 inline-block font-bold text-accent hover:underline">
            {ct.aboutMore(fname)} →
          </Link>
        </section>
      </div>

      <Related k={k} cc={cc} title={d.majors} items={majors} showInstitution={false} />
      <Related k={k} cc={cc} title={ct.moreAtInstitution(fname, p.institution)} items={sameInstitution} showInstitution={false} />
      <Related k={k} cc={cc} title={ct.elsewhere(fname, inC)} items={elsewhere} showInstitution more={{ label: ct.allIn(fname, inC), href: r.countryField(cc, field) }} />

      {source && <p className="mt-12 text-xs text-muted">{ct.sourceLine(source.name, source.licence, fmtDate(shard.updated, intl))}</p>}

      <Cta k={k} title={ct.fieldCtaTitle(fname)} />
    </div>
  )
}

/** Title and description of a programme page, or null where there is none. */
export async function programmeText(cc: string, field: string, slug: string, locale: Locale): Promise<{ title: string; description: string } | null> {
  const res = await resolveProgramme(cc, field, slug)
  if (!res || !('found' in res)) return null
  const p = res.found.p
  const ct = catalogueText(locale)
  const years = p.durationYears ? ct.years(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(p.durationYears)) : ''
  const langs = (p.languages ?? []).map((l) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(l) ?? l
    } catch {
      return l
    }
  })
  const extra = [years, langs.join(', ')].filter(Boolean).join(', ')
  // A Korean title gets its English focus next to it.
  const name = /[A-Za-z]/.test(p.name) || !p.focus?.[0] ? p.name : `${p.name} (${p.focus[0]})`
  return {
    title: `${name} · ${p.institution}`,
    description: ct.programmeMetaDesc(levelLabel(p.level, locale), fieldName(field, locale), p.institution, placeOf(p), extra),
  }
}
