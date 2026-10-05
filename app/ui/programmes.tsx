'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { unlockToken } from '@/lib/store.ts'
import { isLocal } from '@/lib/site/config.ts'
import type { Preferences, Results } from '@/lib/engine/types.ts'
import { COUNTRIES, flag } from '@/lib/countries.ts'
import type { Level, ResearchInstitution } from '@/lib/programmes.ts'
import type { RankResult, RankedProgramme } from '@/lib/server/rank.ts'
import { TYPE_LABEL, TYPE_STYLE, admissionText, typeShort } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { withBase } from '@/lib/site.ts'
import { formatPrice } from '@/lib/pricing.ts'
import { countryLabel, emoji, fieldName, fmtMoney, fmtNumber, levelLabel } from '@/lib/site/labels.ts'
import { useConfig } from './price.tsx'
import type { Config } from './price.tsx'
import { useSite } from './site-context.tsx'
import { Burst } from './shapes.tsx'

interface Teaser {
  total: number
  facets: RankResult['facets']
  samples: RankedProgramme[]
  sample: boolean
  updated?: string
}

/** «in der Schweiz», «in den USA»: German needs the article. */
const DE_DATIVE: Record<string, string> = {
  CH: 'der Schweiz',
  US: 'den USA',
  NL: 'den Niederlanden',
  TR: 'der Türkei',
  SK: 'der Slowakei',
  AE: 'den Vereinigten Arabischen Emiraten',
  PH: 'den Philippinen',
}


/** The fields we look up programmes for: your top six, with their scores. */
function requestFields(results: Results) {
  return results.fields.slice(0, 6).map((f) => ({ id: f.id, score: f.score }))
}

/** Until the report is unlocked, place 1 stays hidden, also from the free teaser. */
const teaserFields = (fields: ReturnType<typeof requestFields>) => fields.slice(1)

export function Programmes({ results, prefs }: { results: Results; prefs: Preferences }) {
  const { t, r, site, locale, intl } = useSite()
  const [token, setToken] = useState<string | null>(null)
  const [teaser, setTeaser] = useState<Teaser | null>(null)
  const config = useConfig(site)
  const fields = useMemo(() => requestFields(results), [results])

  useEffect(() => setToken(unlockToken()), [])

  useEffect(() => {
    fetch(withBase('/api/teaser'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: teaserFields(fields), prefs }) })
      .then((res) => res.json())
      .then(setTeaser)
      .catch(() => setTeaser(null))
  }, [fields, prefs])

  const noDataCountries = prefs.countries.filter((c) => !COUNTRIES[c]?.programmeData)
  const where = prefs.countries.length
    ? prefs.countries.length > 4
      ? t.programmes.inCountries(prefs.countries.length)
      : t.programmes.inList(prefs.countries.map((c) => (locale !== 'en' ? (DE_DATIVE[c] ?? countryLabel(c, intl)) : countryLabel(c, intl))))
    : t.programmes.anywhere

  return (
    <section id={r.anchors.programmes} className="mt-20 scroll-mt-24">
      <h2 className="font-display text-4xl sm:text-5xl">{t.programmes.title}</h2>
      <p className="mt-3 max-w-2xl text-muted">
        {t.programmes.sub(where, t.programmes.levelText[prefs.level])}{' '}
        <Link href={`${r.start}#${r.anchors.prefs}`} className="font-bold text-accent underline-offset-2 hover:underline">
          {t.programmes.change}
        </Link>
      </p>
      {teaser?.sample && <p className="on-color mt-5 rounded-2xl border-2 border-line bg-yellow px-4 py-3 text-sm font-semibold">⚠ {t.programmes.demo}</p>}

      {token ? <Explorer token={token} fields={fields} prefs={prefs} onInvalid={() => setToken(null)} /> : <Locked teaser={teaser} config={config} results={results} />}

      {noDataCountries.length > 0 && <Research token={token} fields={fields.map((f) => f.id)} countries={noDataCountries} />}
    </section>
  )
}

function Locked({ teaser, config, results }: { teaser: Teaser | null; config: Config | null; results: Results }) {
  const { t, site, base, locale, intl, conf } = useSite()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const price = formatPrice(config?.price ?? { currency: conf.currency, amount: 15 }, intl)

  async function checkout() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(withBase(`/api/checkout?site=${site}&back=${encodeURIComponent(base)}&o=${encodeURIComponent(window.location.origin)}`), { method: 'POST' })
      const j = (await res.json()) as { url?: string; error?: string }
      if (!j.url) throw new Error(j.error ?? t.programmes.checkoutFailed)
      window.location.assign(j.url)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 grid gap-7 lg:grid-cols-[1.3fr_1fr]">
      <div>
        {teaser ? (
          <>
            <div className="card p-6 sm:p-7">
              <div className="font-display text-6xl">{fmtNumber(teaser.total, intl)}</div>
              <div className="mt-1 font-semibold text-muted">{t.programmes.matchCount}</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.entries(teaser.facets.countries)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cc, n]) => (
                    <span key={cc} className="chip">
                      {flag(cc)} {countryLabel(cc, intl)} <span className="text-muted">{fmtNumber(n, intl)}</span>
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip-soft">🔒 {t.results.lockedChip}</span>
                {Object.entries(teaser.facets.fields)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => (
                    <span key={id} className="chip-soft">
                      {emoji(id)} {fieldName(id, locale)} <span className="text-muted">{fmtNumber(n, intl)}</span>
                    </span>
                  ))}
              </div>
            </div>
            {teaser.samples.length > 0 && (
              <>
                <p className="mt-7 font-bold">{t.programmes.freeTop(teaser.samples.length)}</p>
                <div className="mt-3 grid gap-4">
                  {teaser.samples.map((p) => (
                    <ProgrammeRow key={p.id} p={p} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="card animate-soft p-6 font-semibold text-muted">{t.programmes.loading}</div>
        )}
      </div>
      <div className="card relative h-fit bg-accent p-7 text-accent-ink lg:sticky lg:top-24">
        <div className="absolute -top-7 right-0 rotate-12 sm:-right-4">
          <Burst size={96} color="var(--yellow)" />
          <span className="absolute inset-0 flex items-center justify-center font-display text-lg text-on-color">{price}</span>
        </div>
        <h3 className="pr-16 font-display text-3xl">{t.programmes.boxTitle}</h3>
        <p className="mt-2 text-sm opacity-85">{t.programmes.boxSub}</p>
        <ul className="mt-5 grid gap-2 text-sm font-medium">
          {t.programmes.boxList(teaser ? fmtNumber(teaser.total, intl) : '').map((x) => (
            <li key={x}>★ {x}</li>
          ))}
        </ul>
        {config?.payments === 'off' ? (
          <p className="mt-6 text-sm opacity-85">{t.programmes.paymentsOff}</p>
        ) : (
          <button type="button" disabled={busy || !config} onClick={checkout} className="btn btn-lime btn-lg mt-6 w-full">
            {busy ? t.programmes.opening : config?.payments === 'free' ? t.programmes.unlockFree : t.programmes.unlock(price)}
          </button>
        )}
        {error && <p className="mt-3 rounded-xl bg-surface p-2 text-sm font-semibold text-bad">{error}</p>}
        <p className="mt-3 text-center text-xs opacity-80">{t.programmes.boxNote}</p>
      </div>
    </div>
  )
}

/** A URL that is just a homepage, not the programme's own page. */
function isHomepage(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === ''
  } catch {
    return true
  }
}

/**
 * The programme's own page. Where the data only knows the institution (Swiss
 * statistics, US Scorecard), DuckDuckGo's «\» search jumps straight to the
 * first result on the institution's site, usually the programme page.
 */
function programmeLink(p: RankedProgramme): string {
  if (p.url && p.url !== p.institutionUrl && !isHomepage(p.url)) return p.url
  const home = p.institutionUrl ?? p.url
  let site = ''
  try {
    if (home) site = ` site:${new URL(home).hostname.replace(/^www\./, '')}`
  } catch {
    site = ''
  }
  const query = `\\${p.name}${site || ` ${p.institution}`}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
}

function ProgrammeRow({ p }: { p: RankedProgramme }) {
  const { t, locale, intl, site } = useSite()
  // Switzerland, Germany and Austria talk about fees per semester.
  const perSemester = isLocal(site)
  const feeAmount = p.fee ? (perSemester ? Math.round(p.fee.amount / 2) : p.fee.amount) : 0
  const type = p.institutionType as InstType | undefined
  const lang = locale === 'en' ? 'en' : 'de'
  return (
    <article className="card-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-bold leading-snug">
            <a href={programmeLink(p)} target="_blank" rel="noreferrer" className="hover:text-accent" title={t.programmes.row.openPage}>
              {p.name} <span className="text-xs text-muted" aria-hidden="true">↗</span>
            </a>
            {p.isNew && <span className="on-color ml-2 rounded-full border-2 border-line bg-lime px-2 py-0.5 text-xs font-bold">{t.programmes.row.isNew}</span>}
          </h4>
          <div className="mt-0.5 text-sm text-muted">
            {p.institutionUrl ? (
              <a href={p.institutionUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
                {p.institution}
              </a>
            ) : (
              p.institution
            )}
            {' · '}
            {flag(p.country)} {[p.city, p.region].filter(Boolean).join(', ') || countryLabel(p.country, intl)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {type && TYPE_LABEL[type] && (
            <span className="on-color rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-bold" style={{ background: TYPE_STYLE[type].color }} title={TYPE_LABEL[type][lang]}>
              {typeShort(type, p.country)}
            </span>
          )}
          <span className="rounded-full border-2 border-line bg-accent px-2.5 py-0.5 text-sm font-extrabold text-accent-ink" title={t.programmes.row.matchTip}>
            {p.match}
          </span>
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <Item k={t.programmes.row.field} v={`${emoji(p.matchedField)} ${fieldName(p.matchedField, locale)}`} />
        <Item k={t.programmes.row.level} v={levelLabel(p.level as Level, locale)} />
        {p.durationYears && <Item k={t.programmes.row.duration} v={`${p.durationYears} ${t.programmes.row.yrs}`} />}
        <Item
          k={perSemester ? t.programmes.row.feeSemester : t.programmes.row.fee}
          v={p.fee ? `${feeAmount === 0 ? t.programmes.row.free : fmtMoney(feeAmount, p.fee.currency, intl)}${p.fee.estimated ? t.programmes.row.approx : ''}` : (p.tuition?.note ?? t.programmes.row.seePage)}
        />
        {p.earnings && <Item k={t.programmes.row.earnings(p.earnings.yearsAfter)} v={fmtMoney(p.earnings.median, p.earnings.currency, intl)} />}
        {p.debt && <Item k={t.programmes.row.debt} v={fmtMoney(p.debt.median, p.debt.currency, intl)} />}
        {p.admissionRate !== undefined && <Item k={t.programmes.row.admission} v={`${Math.round(p.admissionRate * 100)} %`} />}
        {p.capacity && <Item k={p.source === 'ch-bfs' ? t.programmes.row.students : t.programmes.row.places} v={fmtNumber(p.capacity, intl)} />}
        {p.languages?.length ? <Item k={t.programmes.row.language} v={p.languages.map((l) => l.toUpperCase()).join(', ')} /> : null}
      </dl>
      {p.admission && (
        <p className="mt-2 text-xs text-muted">
          🎟️ {t.programmes.row.entry}: {admissionText(p.country, type, lang) ?? p.admission}
        </p>
      )}
    </article>
  )
}

function Item({ k, v }: { k: string; v?: string }) {
  if (!v) return null
  return (
    <div>
      <dt className="inline">{k}: </dt>
      <dd className="inline font-semibold text-ink">{v}</dd>
    </div>
  )
}

function Explorer({ token, fields, prefs, onInvalid }: { token: string; fields: Array<{ id: string; score: number }>; prefs: Preferences; onInvalid: () => void }) {
  const { t, locale, intl, conf, site } = useSite()
  const [country, setCountry] = useState('')
  const [level, setLevel] = useState<Level | 'any'>('any')
  const [sort, setSort] = useState<'match' | 'cost' | 'earnings' | 'new'>('match')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<RankResult | null>(null)
  const [loading, setLoading] = useState(false)

  const query = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      const res = await fetch(withBase('/api/programmes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields, prefs, country: country || undefined, level, sort, q: q || undefined, page, ...extra }),
      })
      if (res.status === 401) {
        onInvalid()
        return null
      }
      return (await res.json()) as RankResult
    },
    [token, fields, prefs, country, level, sort, q, page, onInvalid],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      query().then((d) => {
        if (!cancelled && d) setData(d)
        if (!cancelled) setLoading(false)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  async function exportCsv() {
    const all = await query({ page: 0, pageSize: 2000 })
    if (!all) return
    const cols = ['match', 'name', 'institution', 'country', 'city', 'level', 'field', 'tuition_per_year', 'currency', 'earnings', 'admission_rate', 'url']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = all.items.map((p) =>
      [p.match, p.name, p.institution, p.country, p.city, p.level, fieldName(p.matchedField, locale), p.fee?.amount, p.fee?.currency, p.earnings?.median, p.admissionRate, p.url ?? p.institutionUrl].map(esc).join(','),
    )
    const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${conf.name}-programmes.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0
  return (
    <div className="mt-8">
      <div className="card-sm flex flex-wrap items-center gap-2 p-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          placeholder={t.programmes.search}
          className="input min-w-[12rem] flex-1"
        />
        <select value={country} onChange={(e) => (setCountry(e.target.value), setPage(0))} className="input w-auto">
          <option value="">{t.programmes.allCountries}</option>
          {Object.entries(data?.facets.countries ?? {}).map(([cc, n]) => (
            <option key={cc} value={cc}>
              {countryLabel(cc, intl)} ({n})
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => (setLevel(e.target.value as Level | 'any'), setPage(0))} className="input w-auto">
          <option value="any">{t.programmes.allLevels}</option>
          {Object.entries(data?.facets.levels ?? {}).map(([l, n]) => (
            <option key={l} value={l}>
              {levelLabel(l as Level, locale)} ({n})
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => (setSort(e.target.value as typeof sort), setPage(0))} className="input w-auto">
          {(['match', 'cost', 'earnings', 'new'] as const).filter((s) => s !== 'earnings' || !isLocal(site)).map((s) => (
            <option key={s} value={s}>
              {t.programmes.sort[s]}
            </option>
          ))}
        </select>
        <button type="button" onClick={exportCsv} className="btn btn-ghost btn-sm">
          CSV ⤓
        </button>
      </div>
      <p className="mt-4 text-sm font-semibold text-muted">
        {data ? t.programmes.count(fmtNumber(data.total, intl)) : t.programmes.loading}
        {data?.updated && t.programmes.dataFrom(new Date(data.updated).toLocaleDateString(intl, { dateStyle: 'medium' }))}
        {loading && data && t.programmes.updating}
      </p>
      <div className="mt-3 grid gap-4">
        {data?.items.map((p) => (
          <ProgrammeRow key={p.id} p={p} />
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-7 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="btn btn-ghost btn-sm">
            {t.programmes.prev}
          </button>
          <span className="font-bold">
            {page + 1} / {pages}
          </span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="btn btn-ghost btn-sm">
            {t.programmes.nextPage}
          </button>
        </div>
      )}
    </div>
  )
}

interface ResearchResponse {
  paid: boolean
  byCountry: Record<string, { research: Record<string, Array<Partial<ResearchInstitution>>>; directory: number; universities?: Array<{ name: string; url?: string; domain?: string }> }>
}

function Research({ token, fields, countries }: { token: string | null; fields: string[]; countries: string[] }) {
  const { t, locale, intl } = useSite()
  const [data, setData] = useState<ResearchResponse | null>(null)
  useEffect(() => {
    fetch(withBase('/api/research'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ fields, countries }),
    })
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
  }, [token, fields, countries])

  if (!data?.byCountry) return null
  return (
    <div className="mt-16">
      <h3 className="font-display text-3xl">{t.programmes.researchTitle}</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted">{t.programmes.researchSub}</p>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {Object.entries(data.byCountry).map(([cc, c]) => (
          <div key={cc} className="card-sm p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-display text-xl">
                {flag(cc)} {countryLabel(cc, intl)}
              </h4>
              <span className="text-xs font-semibold text-muted">{t.programmes.universities(c.directory)}</span>
            </div>
            {COUNTRIES[cc]?.typicalTuition && (
              <p className="mt-1 text-xs text-muted">
                {t.programmes.typical}: {COUNTRIES[cc].typicalTuition}
              </p>
            )}
            {Object.keys(c.research).length === 0 && <p className="mt-3 text-sm text-muted">{t.programmes.noResearch}</p>}
            {Object.entries(c.research).map(([fid, list]) => (
              <div key={fid} className="mt-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">
                  {emoji(fid)} {fieldName(fid, locale)}
                </div>
                {data.paid ? (
                  <ol className="mt-1 grid gap-1 text-sm">
                    {list.slice(0, 6).map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {i.url ? (
                            <a href={i.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                              {i.name}
                            </a>
                          ) : (
                            i.name
                          )}
                          {i.city && <span className="text-muted"> · {i.city}</span>}
                        </span>
                        <span className="bar h-2 w-16 shrink-0">
                          <span className="bg-accent" style={{ width: `${Math.round((i.strength ?? 0) * 100)}%` }} />
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-sm text-muted">🔒 {t.programmes.ranked(list.length)}</p>
                )}
              </div>
            ))}
            {data.paid && c.universities && c.universities.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-accent">{t.programmes.allUnis(c.universities.length)}</summary>
                <ul className="mt-2 max-h-64 overflow-y-auto pr-1">
                  {c.universities.map((u) => (
                    <li key={u.name} className="flex justify-between gap-2 py-0.5">
                      <a href={u.url} target="_blank" rel="noreferrer" className="truncate hover:text-accent">
                        {u.name}
                      </a>
                      {u.domain && (
                        <a
                          className="shrink-0 text-xs text-muted hover:text-ink"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.google.com/search?q=${encodeURIComponent(`site:${u.domain} ${fields.map((f) => fieldName(f, locale)).slice(0, 2).join(' OR ')}`)}`}
                        >
                          {t.programmes.searchProgrammes}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
