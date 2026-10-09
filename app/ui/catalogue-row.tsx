import Link from 'next/link'
import type { CatalogueEntry } from '@/lib/programmes.ts'
import type { Locale } from '@/lib/site/config.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { levelLabel } from '@/lib/site/labels.ts'

function languageName(code: string, intl: string): string {
  try {
    return new Intl.DisplayNames([intl], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * One programme of the free catalogue. Rendered on the server for the field
 * pages and in the browser for search results, so it uses no hooks.
 */
export function CatalogueRow({ p, locale, showInstitution = false, showLevel = true, field }: { p: CatalogueEntry; locale: Locale; showInstitution?: boolean; showLevel?: boolean; field?: { name: string; href: string } }) {
  const ct = catalogueText(locale)
  const years = p.durationYears ? ct.years(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(p.durationYears)) : null
  const details = [
    showLevel ? levelLabel(p.level, locale) : null,
    showInstitution ? p.institution : null,
    p.city,
    p.languages?.length ? p.languages.map((l) => languageName(l, locale)).join(', ') : null,
    years,
    p.mode ? ct.modes[p.mode] : null,
  ].filter(Boolean)
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/15 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <span className="font-bold">{p.name}</span>
        <div className="text-xs text-muted">
          {details.join(' · ')}
          {field && (
            <>
              {' · '}
              <Link href={field.href} className="font-semibold text-accent hover:underline">
                {field.name}
              </Link>
            </>
          )}
        </div>
      </div>
      {p.url ? (
        <a href={p.url} target="_blank" rel="noopener" className="shrink-0 text-xs font-bold text-accent hover:underline">
          {ct.search.programme} ↗
        </a>
      ) : (
        p.institutionUrl &&
        showInstitution && (
          <a href={p.institutionUrl} target="_blank" rel="noopener" className="shrink-0 text-xs font-bold text-accent hover:underline">
            {ct.search.website} ↗
          </a>
        )
      )}
    </li>
  )
}
