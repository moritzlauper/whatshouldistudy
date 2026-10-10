import Link from 'next/link'
import type { CatalogueEntry } from '@/lib/programmes.ts'
import type { Locale } from '@/lib/site/config.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { TYPE_STYLE, admissionText, typeLabel } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { fieldName, levelLabel } from '@/lib/site/labels.ts'

function languageName(code: string, intl: string): string {
  try {
    return new Intl.DisplayNames([intl], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

const lang = (locale: Locale) => (locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it')

/** Every fact the free catalogue has on a programme, as label and value; empty ones are left out. */
export function catalogueFacts(p: CatalogueEntry, country: string, locale: Locale, fieldHref?: (id: string) => string): Array<[string, React.ReactNode]> {
  const ct = catalogueText(locale)
  const d = ct.detail
  const years = p.durationYears ? ct.years(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(p.durationYears)) : null
  const languages = p.languages?.length ? p.languages.map((l) => languageName(l, locale)).join(', ') : null
  const type = p.institutionType && p.institutionType in TYPE_STYLE ? (p.institutionType as InstType) : undefined
  // The programme's own rule where the source has one (in German, Switzerland), otherwise the rule for its kind of institution.
  const admission = (locale.startsWith('de-') ? p.admission : undefined) ?? admissionText(country, type, lang(locale))
  const otherLanguages = p.otherLanguages?.length ? p.otherLanguages.map((l) => (/^[a-z]{2}$/.test(l) ? languageName(l, locale) : l)).join(', ') : null
  const ects = p.ects ? `${new Intl.NumberFormat(locale).format(p.ects)} ECTS` : null
  const facts: Array<[string, React.ReactNode]> = [
    [d.degree, levelLabel(p.level, locale)],
    [d.title, p.degreeTitle],
    [d.institution, type ? `${p.institution} (${typeLabel(type, country, lang(locale))})` : p.institution],
    [d.department, p.department],
    [d.partners, p.partners],
    [d.place, [p.city, p.region].filter(Boolean).join(', ')],
    [d.language, languages],
    [d.otherLanguages, otherLanguages],
    [d.duration, [years, ects].filter(Boolean).join(' · ')],
    [d.mode, p.mode ? ct.modes[p.mode] : null],
    [d.focus, p.focus?.length ? p.focus.join(' · ') : null],
    [d.admission, admission],
    [d.requirements, p.requirements],
    [d.prior, p.priorStudies?.length ? p.priorStudies.join(', ') : null],
    [d.deadline, p.deadline],
    [
      d.fields,
      p.fields.map((f, i) => (
        <span key={f}>
          {i > 0 && ', '}
          {fieldHref ? (
            <Link href={fieldHref(f)} className="font-semibold text-accent hover:underline">
              {fieldName(f, locale)}
            </Link>
          ) : (
            fieldName(f, locale)
          )}
        </span>
      )),
    ],
  ]
  return facts.filter(([, v]) => v !== null && v !== undefined && v !== '')
}

/**
 * One programme of the free catalogue: its exact title and the key facts, and
 * everything else we know about it on a click, with a link to its own page.
 * Rendered on the server for the field pages and in the browser for search
 * results, so it uses no hooks.
 */
export function CatalogueRow({
  p,
  country,
  locale,
  fieldHref,
  href,
  showInstitution = false,
  showLevel = true,
}: {
  p: CatalogueEntry
  country: string
  locale: Locale
  /** Link to a field's page in this country. */
  fieldHref?: (id: string) => string
  /** The programme's own page, where the country has them. */
  href?: string
  showInstitution?: boolean
  showLevel?: boolean
}) {
  const ct = catalogueText(locale)
  const d = ct.detail
  const years = p.durationYears ? ct.years(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(p.durationYears)) : null
  const languages = p.languages?.length ? p.languages.map((l) => languageName(l, locale)).join(', ') : null
  const summary = [showLevel ? levelLabel(p.level, locale) : null, showInstitution ? p.institution : null, p.city, languages, years].filter(Boolean)
  const facts = catalogueFacts(p, country, locale, fieldHref)
  return (
    <li className="border-b border-line/15 last:border-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-x-4 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="font-bold group-open:text-accent">{p.name}</span>
            <span className="block text-xs text-muted">{summary.join(' · ')}</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-accent transition-transform group-open:rotate-180" aria-hidden="true">
            ▾
          </span>
        </summary>
        <div className="mb-4 rounded-2xl border-2 border-line bg-surface-2 p-4 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {href && (
              <Link href={href} className="font-bold text-accent hover:underline">
                {d.page} →
              </Link>
            )}
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener" className="font-bold text-accent hover:underline">
                {d.official} ↗
              </a>
            )}
            {p.regulationsUrl && (
              <a href={p.regulationsUrl} target="_blank" rel="noopener" className="font-bold text-accent hover:underline">
                {d.regulations} ↗
              </a>
            )}
            {p.institutionUrl && (
              <a href={p.institutionUrl} target="_blank" rel="noopener" className="font-bold text-accent hover:underline">
                {d.website} ↗
              </a>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}
