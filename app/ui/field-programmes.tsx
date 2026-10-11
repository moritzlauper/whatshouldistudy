'use client'

import { useMemo, useState } from 'react'
import type { CatalogueEntry } from '@/lib/programmes.ts'
import { hasProgrammePages, programmeSlug } from '@/lib/catalogue.ts'
import { TYPE_STYLE, typeLabel } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { CatalogueRow } from './catalogue-row.tsx'
import { useSite } from './site-context.tsx'

/** Filter the public field catalogue without changing its programme order. */
export function FieldProgrammes({ programmes, country }: { programmes: CatalogueEntry[]; country: string }) {
  const { locale, intl, r } = useSite()
  const ct = catalogueText(locale)
  const [type, setType] = useState('')
  const [city, setCity] = useState('')
  const language = locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it'
  const types = useMemo(() => [...new Set(programmes.map((p) => p.institutionType).filter((x): x is InstType => !!x && Object.hasOwn(TYPE_STYLE, x)))], [programmes])
  const cities = useMemo(() => [...new Set(programmes.map((p) => p.city).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, intl)), [programmes, intl])
  const filtered = programmes.filter((p) => (!type || p.institutionType === type) && (!city || p.city === city))
  const groups = new Map<string, CatalogueEntry[]>()
  for (const p of filtered) {
    if (!groups.has(p.institution)) groups.set(p.institution, [])
    groups.get(p.institution)!.push(p)
  }

  return (
    <div className="mt-6">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          {ct.filters.type}
          <select className="input min-w-0 w-full" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{ct.filters.allTypes}</option>
            {types.map((value) => <option key={value} value={value}>{typeLabel(value, country, language)}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          {ct.detail.place}
          <select className="input min-w-0 w-full" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{ct.filters.allPlaces}</option>
            {cities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-ghost" disabled={!type && !city} onClick={() => { setType(''); setCity('') }}>{ct.filters.reset}</button>
      </div>
      <p className="mt-3 text-sm font-semibold text-muted" role="status">{ct.search.results(fmtNumber(filtered.length, intl))}</p>
      {filtered.length === 0 && <p className="mt-3 text-muted">{ct.filters.none}</p>}
      <div className="mt-5 grid gap-7">
        {[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], intl)).map(([institution, items]) => {
          const institutionType = items.find((p) => p.institutionType && Object.hasOwn(TYPE_STYLE, p.institutionType))?.institutionType as InstType | undefined
          return <div key={institution}>
            <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-line pb-2">
              <span className="font-display text-lg leading-tight">{institution}</span>
              {institutionType && <span className="chip on-color text-xs" style={{ background: TYPE_STYLE[institutionType].color }}>{typeLabel(institutionType, country, language)}</span>}
            </h3>
            <ul>{items.map((p) => <CatalogueRow key={p.id} p={p} country={country} locale={locale} fieldHref={(id) => r.countryField(country, id)} href={hasProgrammePages(country) ? r.programme(country, p.fields[0], programmeSlug(p)) : undefined} />)}</ul>
          </div>
        })}
      </div>
    </div>
  )
}
