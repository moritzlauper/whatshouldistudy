import Link from 'next/link'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { LEVEL_ORDER, programmeSlug } from '@/lib/catalogue.ts'
import { TYPE_STYLE, typeLabel } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { publicReading } from '@/lib/facts-store.ts'
import type { PublicReading } from '@/lib/facts-store.ts'
import { toCatalogueEntry } from '@/lib/programmes.ts'
import type { CatalogueEntry, Programme } from '@/lib/programmes.ts'
import { getCatalogue, getMeta, getStats } from '@/lib/server/data.ts'
import { countryFacts } from '@/lib/server/facts-db.ts'
import { resolveProgramme } from '@/lib/server/programme.ts'
import { translateDescription } from '@/lib/server/translate.ts'
import type { FoundProgramme } from '@/lib/server/programme.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import type { Locale, SiteProps } from '@/lib/site/config.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import { pageUrl } from '@/lib/site/meta.ts'
import { countryLabel, emoji, fieldName, fmtMoney, levelLabel, riasecLabel, subjectLabel } from '@/lib/site/labels.ts'
import { basicLabel } from '@/lib/site/basic-labels.ts'
import { programmePageText } from '@/lib/site/programme-text.ts'
import { programmeCareers } from '@/lib/site/programme-careers.ts'
import type { ProgrammeText } from '@/lib/site/programme-text.ts'
import { profileRemote, profileStandouts, profileTypes, programmeProfile, typeShifts } from '@/lib/programme-profile.ts'
import { FIELD_BY_ID, RIASEC_KEYS } from '@/lib/taxonomy/fields.ts'
import type { SubjectKey } from '@/lib/taxonomy/fields.ts'
import type { BasicKey } from '@/lib/taxonomy/basic-interests.ts'
import { ProgrammeFit } from '../ui/programme-fit.tsx'
import type { FitChip, FitTypeBar } from '../ui/programme-fit.tsx'
import { catalogueFacts, languageName } from '../ui/catalogue-row.tsx'
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

/** Countries whose programme pages show what was read on the official page. */
const READING_COUNTRIES = new Set(['CH', 'AT'])

const lang = (locale: Locale) => (locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it')

/** For a page: the programme, or a 404, or the move to its own address. */
async function programmeOr404(k: Kit, cc: string, field: string, slug: string): Promise<FoundProgramme> {
  const res = await resolveProgramme(cc, field, slug)
  if (!res) notFound()
  if ('redirect' in res) permanentRedirect(k.r.programme(cc, res.redirect.field, res.redirect.slug))
  // Temporary: the programme may be listed again after the next data run.
  if ('gone' in res) redirect(k.r.countryField(cc, res.gone))
  return res.found
}

/** A stored description cut at its length limit ends at the last full sentence. */
export function wholeSentences(text: string, limit = 420): string {
  if (text.length < limit) return text
  const end = Math.max(text.lastIndexOf('. '), text.lastIndexOf('! '), text.lastIndexOf('? '))
  return end > limit / 3 ? text.slice(0, end + 1) : `${text.replace(/\s+\S*$/, '')} …`
}

/** Sources whose licence covers the descriptions; others (e.g. studyprogrammes.ch) are never shown. */
const DESCRIPTION_SOURCES = new Set(['fi-opintopolku'])

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

/** A basic interest or a school subject (`s:math`) by its label. */
const levelLabelOf = (key: string, locale: Locale) => (key.startsWith('s:') ? subjectLabel(key.slice(2) as SubjectKey, locale) : basicLabel(key as BasicKey, locale))

/** Colours of the cards with what sets a programme apart, in turn. */
const CARD_COLOURS = ['bg-accent-soft', 'on-color bg-lime', 'on-color bg-sky']

/**
 * What sets the programme apart: the points from the reading of its official page as cards, its specialisations
 * and the focus areas of the catalogue. Null when there is none of these.
 */
function AboutProgramme({ reading, focus, locale, intl, tx }: { reading: PublicReading | null; focus: string[]; locale: Locale; intl: string; tx: ProgrammeText }) {
  const ct = catalogueText(locale)
  const o = ct.official
  const tags = [...new Set([...(reading?.specialisations ?? []), ...focus])]
  if (!reading?.distinctive.length && !tags.length) return null
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="font-display text-2xl sm:text-3xl">{tx.aboutTitle}</h2>
      {reading && reading.distinctive.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reading.distinctive.map((d, i) => (
            <li key={d} className={`rounded-2xl border-2 border-line p-4 text-sm leading-relaxed ${CARD_COLOURS[i % CARD_COLOURS.length]}`}>
              {d}
            </li>
          ))}
        </ul>
      )}
      {tags.length > 0 && (
        <div>
          <h3 className="text-sm text-muted">{reading?.specialisations.length ? o.specialisations : tx.focus}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tags.map((n) => (
              <li key={n} className="chip">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {reading && (
        <p className="text-xs text-muted">
          {o.note(fmtDate(reading.at, intl))}
          {reading.url && (
            <>
              {' '}
              {ct.sourceLabel}:{' '}
              <a href={reading.url} target="_blank" rel="noopener" className="font-semibold hover:text-ink">
                {new URL(reading.url).hostname.replace(/^www\./, '')} ↗
              </a>
            </>
          )}
        </p>
      )}
    </section>
  )
}

/** One tile of the key facts at the top. */
function Tile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="card-flat flex min-w-[9.5rem] flex-1 flex-col gap-0.5 rounded-2xl px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-bold leading-snug">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  )
}

function Related({ k, cc, title, items, showInstitution, more }: { k: Kit; cc: string; title: string; items: CatalogueEntry[]; showInstitution: boolean; more?: { label: string; href: string } }) {
  if (!items.length) return null
  return (
    <section className="mt-12">
      <h2 className="font-display text-3xl">{title}</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((q) => (
          <li key={q.id}>
            <Link href={href(k, cc, q)} prefetch={false} className="card-sm card-pop block h-full p-4">
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
  const [{ p: full, shard }, { meta }, stats, facts] = await Promise.all([
    programmeOr404(k, cc, field, slug),
    getMeta(),
    getStats(),
    READING_COUNTRIES.has(cc) ? countryFacts(cc) : null,
  ])
  if (!countryTotals(meta, cc)) notFound()
  // Only the catalogue's own fields reach the page; fees, earnings and admission rates stay in the paid list.
  const p = toCatalogueEntry(full)
  const fname = fieldName(field, locale)
  const inC = inCountry(cc, locale)
  const type = p.institutionType && p.institutionType in TYPE_STYLE ? (p.institutionType as InstType) : undefined
  const source = meta?.sources.find((s) => s.id === full.source)
  // The institution's own words, only where the source's licence covers them (Finland, CC BY 4.0).
  // Translated into the page's language when it is rendered; left out where that fails.
  const original = full.description && source && DESCRIPTION_SOURCES.has(source.id) ? wholeSentences(full.description) : undefined
  const alreadyEnglish = locale === 'en' && !!original && (original.match(/\b(the|and|of|to|in|with)\b/gi)?.length ?? 0) >= 4
  const about = !original ? undefined : alreadyEnglish ? original : await translateDescription(original, locale)
  // Only the specialisations and what sets the programme apart: the rest of the reading belongs to the paid comparison.
  const reading = publicReading(facts?.[full.id], locale)

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

  const tx = programmePageText(locale)
  const s = stats[field]
  // The Swiss figure that fits the institution type and degree first; where none fits, the page says so.
  const ch = cc === 'CH' ? s?.ch : undefined
  const matching = (type === 'uni' || type === 'eth') && p.level === 'master' ? 'uhMaster' : type === 'fh' && p.level === 'bachelor' ? 'fhBachelor' : type === 'ph' ? 'teaching' : null
  const chFigures = ch
    ? (['uhMaster', 'fhBachelor', 'teaching'] as const)
        .filter((key) => ch[key])
        .sort((a, b) => Number(b === matching) - Number(a === matching))
        .map((key) => `${t.earnings[key]}: ${fmtMoney(ch[key]!, 'CHF', intl)}`)
    : []
  const earnings = chFigures.length
    ? { title: tx.earningsField(fname), value: chFigures.join(' · '), note: [!matching || !ch?.[matching] ? tx.earningsNoMatch : '', t.earnings.chSource(ch!.year)].filter(Boolean).join(' ') }
    : cc === 'US' && s?.usMedianEarnings
      ? { title: ct.earningsUs, value: fmtMoney(s.usMedianEarnings, 'USD', intl), note: t.earnings.usSource }
      : null
  const listOf = (xs: string[]) => new Intl.ListFormat(intl, { type: 'conjunction' }).format(xs)
  const careers = programmeCareers(p.fields, locale, cc === 'CH' && (type === 'fh' || type === 'ph'))

  // The key facts as tiles; the rest of the catalogue's facts in a list below, without what the page shows elsewhere.
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const languages = p.languages?.length ? p.languages.map((l) => languageName(l, locale)).join(', ') : null
  const others = p.otherLanguages?.length ? p.otherLanguages.map((l) => (/^[a-z]{2}$/.test(l) ? languageName(l, locale) : l)).join(', ') : null
  const tiles: Array<{ label: string; value: string; sub?: string | null }> = [
    { label: d.degree, value: levelLabel(p.level, locale), sub: p.ects ? `${num.format(p.ects)} ECTS` : null },
    ...(p.durationYears ? [{ label: d.duration, value: ct.years(num.format(p.durationYears)) }] : []),
    ...(p.mode ? [{ label: d.mode, value: ct.modes[p.mode] }] : []),
    ...(languages ? [{ label: d.language, value: languages, sub: others ? tx.partly(others) : null }] : []),
  ]
  const shown = new Set([d.degree, d.institution, d.place, d.language, d.otherLanguages, d.duration, d.mode, d.focus, d.fields])
  const moreFacts = catalogueFacts(p, cc, locale, (f) => r.countryField(cc, f)).filter(([key]) => !shown.has(key))

  // The fit card: the programme's own profile, mixed from its fields; one field alone says that it describes the field.
  const prof = programmeProfile(p.fields)
  const fit = prof
    ? (() => {
        const mixed = prof.fields.length > 1
        const first = fieldName(prof.fields[0], locale)
        const tops = new Set(profileTypes(prof.riasec))
        const base = FIELD_BY_ID[prof.fields[0]].riasec
        const bars: FitTypeBar[] = RIASEC_KEYS.map((key, i) => ({ k: key, label: riasecLabel(key, locale).name, v: prof.riasec[i], ...(mixed ? { base: base[i] } : {}), top: tops.has(key) }))
          .sort((a, b) => b.v - a.v)
        const shifts = typeShifts(prof)
        const lower = (key: (typeof shifts)[number]['k']) => riasecLabel(key, locale).name.toLowerCase()
        const chip = (key: string): FitChip => ({ key, label: levelLabelOf(key, locale) })
        return {
          title: mixed ? tx.fitTitle : tx.fieldFitTitle(first),
          bars,
          barsNote: mixed ? tx.barsNote(first) : undefined,
          shift: shifts.length ? tx.shift(shifts.filter((x) => x.more).map((x) => lower(x.k)), shifts.filter((x) => !x.more).map((x) => lower(x.k)), first, listOf) : undefined,
          pro: profileStandouts(prof).map(chip),
          contra: profileRemote(prof).map(chip),
          fieldOnly: mixed ? undefined : tx.fieldOnly(first),
        }
      })()
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
        ...(p.focus?.length || reading?.specialisations.length ? { teaches: [...new Set([...(p.focus ?? []), ...(reading?.specialisations ?? [])])] } : {}),
        ...(reading?.distinctive.length ? { description: reading.distinctive.join(' ') } : {}),
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
        <h1 className="max-w-4xl hyphens-auto break-words font-display text-4xl sm:text-5xl">{p.name}</h1>
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

      <dl className="mt-6 flex flex-wrap gap-3">
        {tiles.map((x) => (
          <Tile key={x.label} {...x} />
        ))}
      </dl>

      {about && (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-2xl">{ct.aboutProgramme}</h2>
          <p className="mt-2 leading-relaxed">{about}</p>
          <p className="mt-1 text-xs text-muted">{ct.aboutSource(`${source!.name} (${source!.licence})`, !alreadyEnglish)}</p>
        </section>
      )}

      {/* On a phone the fit card follows what sets the programme apart; on a wide screen it stands to the right. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_auto_auto_1fr] lg:items-start">
        <div className="lg:col-start-1 empty:hidden">
          <AboutProgramme reading={reading} focus={p.focus ?? []} locale={locale} intl={intl} tx={tx} />
        </div>
        {fit && (
          <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1">
            <ProgrammeFit {...fit} />
          </div>
        )}
        <section className="card-sm flex flex-col gap-4 p-5 sm:p-6 lg:col-start-1">
          <h2 className="font-display text-2xl sm:text-3xl">{tx.afterTitle}</h2>
          {careers.length > 0 && (
            <div>
              <h3 className="text-sm text-muted">{tx.careersFrom(listOf(p.fields.map((f) => fieldName(f, locale))))}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {careers.map((c) => (
                  <li key={c} className="chip-soft">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {earnings && (
            <div className="text-sm">
              <div className="text-muted">{earnings.title}</div>
              <div className="font-bold">{earnings.value}</div>
              <div className="mt-0.5 text-xs text-muted">{earnings.note}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {p.fields.map((f) => (
              <Link key={f} href={r.field(f)} className="font-bold text-accent hover:underline">
                {ct.aboutMore(fieldName(f, locale))} →
              </Link>
            ))}
          </div>
        </section>
        {moreFacts.length > 0 && (
          <section className="card-sm p-5 sm:p-6 lg:col-start-1">
            <h2 className="font-display text-2xl">{tx.moreFacts}</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {moreFacts.map(([key, v]) => (
                <div key={key} className="contents">
                  <dt className="font-bold">{key}</dt>
                  <dd className="text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <Related k={k} cc={cc} title={d.majors} items={majors} showInstitution={false} />
      <Related k={k} cc={cc} title={ct.moreAtInstitution(fname, p.institution)} items={sameInstitution} showInstitution={false} />
      <Related k={k} cc={cc} title={ct.elsewhere(fname, inC)} items={elsewhere} showInstitution more={{ label: ct.allIn(fname, inC), href: r.countryField(cc, field) }} />

      {source && (
        <p className="mt-12 text-xs text-muted">
          {ct.sourceLabel}:{' '}
          <a href={source.url} target="_blank" rel="noopener" className="font-semibold hover:text-ink">
            {source.name}
          </a>{' '}
          ({source.licenceUrl ? (
            <a href={source.licenceUrl} target="_blank" rel="noopener license" className="hover:text-ink">
              {source.licence}
            </a>
          ) : (
            source.licence
          )}
          ). {ct.sourceNote(fmtDate(shard.updated, intl))}
        </p>
      )}

      <Cta k={k} title={ct.ctaTitle} />
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
  // The town is searched for too («Physik Master Lausanne»): in the title when the institution's name lacks it and there is room.
  const at = `${p.institution}${p.city && !p.institution.toLowerCase().includes(p.city.toLowerCase()) ? `, ${p.city}` : ''}`
  const reading = READING_COUNTRIES.has(cc) ? publicReading((await countryFacts(cc))?.[p.id], locale) : null
  // What the official page says sets it apart tells a searcher more than the list of facts every page has.
  const detail = reading?.distinctive[0] ?? (reading?.specialisations.length ? `${ct.specialisations(reading.specialisations.join(', '))}.` : undefined)
  return {
    title: `${name} · ${`${name} · ${at}`.length <= 60 ? at : p.institution}`,
    description: ct.programmeMetaDesc(levelLabel(p.level, locale), fieldName(field, locale), p.institution, placeOf(p), extra, detail),
  }
}
