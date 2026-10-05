'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { unlockToken } from '@/lib/store.ts'
import type { Preferences, Results } from '@/lib/engine/types.ts'
import { COUNTRIES, countryName, flag, formatMoney } from '@/lib/countries.ts'
import { LEVEL_LABELS } from '@/lib/programmes.ts'
import type { Level, ResearchInstitution } from '@/lib/programmes.ts'
import type { RankResult, RankedProgramme } from '@/lib/server/rank.ts'
import { FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'

interface Teaser {
  total: number
  facets: RankResult['facets']
  samples: RankedProgramme[]
  sample: boolean
  updated?: string
}

interface Config {
  payments: 'stripe' | 'free' | 'off'
  price: { cents: number; currency: string }
}

/** The fields we look up programmes for: your top six, with their scores. */
function requestFields(results: Results) {
  return results.fields.slice(0, 6).map((f) => ({ id: f.id, score: f.score }))
}

export function Programmes({ results, prefs }: { results: Results; prefs: Preferences }) {
  const [token, setToken] = useState<string | null>(null)
  const [teaser, setTeaser] = useState<Teaser | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const fields = useMemo(() => requestFields(results), [results])

  useEffect(() => {
    setToken(unlockToken())
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/teaser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields, prefs }) })
      .then((r) => r.json())
      .then(setTeaser)
      .catch(() => setTeaser(null))
  }, [fields, prefs])

  const noDataCountries = prefs.countries.filter((c) => !COUNTRIES[c]?.programmeData)

  return (
    <section id="programmes" className="mt-16 scroll-mt-20">
      <h2 className="font-display text-3xl sm:text-4xl">Where to study it</h2>
      <p className="mt-2 max-w-2xl text-muted">
        Real programmes for your top fields
        {prefs.countries.length ? ` in ${prefs.countries.length > 4 ? `${prefs.countries.length} countries` : prefs.countries.map(countryName).join(', ')}` : ', anywhere we have data'}
        , {prefs.level === 'any' ? "bachelor's and master's" : prefs.level === 'master' ? "master's level" : "bachelor's level"}.{' '}
        <a href="/start#preferences" className="text-accent underline-offset-2 hover:underline">
          Change
        </a>
      </p>
      {teaser?.sample && (
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          Demo data: this deployment shows a small sample dataset until the weekly data workflow has run.
        </p>
      )}

      {token ? (
        <Explorer token={token} fields={fields} prefs={prefs} onInvalid={() => setToken(null)} />
      ) : (
        <Locked teaser={teaser} config={config} results={results} />
      )}

      {noDataCountries.length > 0 && <Research token={token} fields={fields.map((f) => f.id)} countries={noDataCountries} />}
    </section>
  )
}

function Locked({ teaser, config, results }: { teaser: Teaser | null; config: Config | null; results: Results }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const price = config ? formatMoney(config.price.cents / 100, config.price.currency.toUpperCase()) : ''

  async function checkout() {
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/checkout', { method: 'POST' })
      const j = (await r.json()) as { url?: string; error?: string }
      if (!j.url) throw new Error(j.error ?? 'Checkout failed.')
      window.location.assign(j.url)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div>
        {teaser ? (
          <>
            <div className="rounded-2xl border border-line bg-surface p-6">
              <div className="font-display text-5xl">{teaser.total.toLocaleString('en')}</div>
              <div className="mt-1 text-muted">programmes match your top fields and filters</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.entries(teaser.facets.countries)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cc, n]) => (
                    <span key={cc} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
                      {flag(cc)} {countryName(cc)} <span className="text-muted">{n.toLocaleString('en')}</span>
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(teaser.facets.fields)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => (
                    <span key={id} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                      {FIELD_BY_ID[id]?.name} {n.toLocaleString('en')}
                    </span>
                  ))}
              </div>
            </div>
            {teaser.samples.length > 0 && (
              <>
                <p className="mt-6 text-sm text-muted">Your top {teaser.samples.length}, free:</p>
                <div className="mt-3 grid gap-3">
                  {teaser.samples.map((p) => (
                    <ProgrammeRow key={p.id} p={p} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="animate-soft rounded-2xl border border-line bg-surface p-6 text-muted">Looking up programmes…</div>
        )}
      </div>
      <div className="h-fit rounded-3xl border-2 border-accent bg-surface p-7 lg:sticky lg:top-20">
        <h3 className="font-display text-2xl">Get the full report</h3>
        <p className="mt-2 text-sm text-muted">Everything that matches {FIELD_BY_ID[results.fields[0].id].name} and your other top fields, ranked for you.</p>
        <ul className="mt-5 grid gap-2 text-sm">
          {[
            `All ${teaser ? teaser.total.toLocaleString('en') : ''} matching programmes`,
            'The fee that applies to your citizenship',
            'Earnings, debt and admission rates where published',
            'Strongest universities in 60+ more countries',
            'Filters, search and CSV export',
            'New programmes flagged, data refreshed weekly',
          ].map((x) => (
            <li key={x}>✓ {x}</li>
          ))}
        </ul>
        {config?.payments === 'off' ? (
          <p className="mt-6 text-sm text-muted">Payments aren’t set up on this deployment yet.</p>
        ) : (
          <button
            type="button"
            disabled={busy || !config}
            onClick={checkout}
            className="mt-6 w-full rounded-full bg-accent px-6 py-3 font-medium text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Opening checkout…' : config?.payments === 'free' ? 'Unlock (free in this deployment)' : `Unlock for ${price}`}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        <p className="mt-3 text-center text-xs text-muted">One-time payment · valid 12 months · secure checkout by Stripe</p>
      </div>
    </div>
  )
}

function ProgrammeRow({ p }: { p: RankedProgramme }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold leading-snug">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                {p.name}
              </a>
            ) : (
              p.name
            )}
            {p.isNew && <span className="ml-2 rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">New</span>}
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
            {flag(p.country)} {[p.city, p.region].filter(Boolean).join(', ') || countryName(p.country)}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent" title="How well this programme matches your fields">
          {p.match}
        </span>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <Item k="Field" v={FIELD_BY_ID[p.matchedField]?.name} />
        <Item k="Level" v={LEVEL_LABELS[p.level]} />
        {p.durationYears && <Item k="Duration" v={`${p.durationYears} yrs`} />}
        <Item
          k="Tuition/yr"
          v={
            p.fee
              ? `${p.fee.amount === 0 ? 'Free' : formatMoney(p.fee.amount, p.fee.currency)}${p.fee.estimated ? ' (approx.)' : ''}`
              : (p.tuition?.note ?? 'See programme page')
          }
        />
        {p.earnings && <Item k={`Earnings, ${p.earnings.yearsAfter} yr after`} v={formatMoney(p.earnings.median, p.earnings.currency)} />}
        {p.debt && <Item k="Median debt" v={formatMoney(p.debt.median, p.debt.currency)} />}
        {p.admissionRate !== undefined && <Item k="Admission rate" v={`${Math.round(p.admissionRate * 100)}%`} />}
        {p.capacity && <Item k="Places" v={String(p.capacity)} />}
        {p.languages?.length ? <Item k="Language" v={p.languages.map((l) => l.toUpperCase()).join(', ')} /> : null}
      </dl>
    </article>
  )
}

function Item({ k, v }: { k: string; v?: string }) {
  if (!v) return null
  return (
    <div>
      <dt className="inline">{k}: </dt>
      <dd className="inline text-ink">{v}</dd>
    </div>
  )
}

function Explorer({
  token,
  fields,
  prefs,
  onInvalid,
}: {
  token: string
  fields: Array<{ id: string; score: number }>
  prefs: Preferences
  onInvalid: () => void
}) {
  const [country, setCountry] = useState('')
  const [level, setLevel] = useState<Level | 'any'>('any')
  const [sort, setSort] = useState<'match' | 'cost' | 'earnings' | 'new'>('match')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<RankResult | null>(null)
  const [loading, setLoading] = useState(false)

  const query = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      const r = await fetch('/api/programmes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields, prefs, country: country || undefined, level, sort, q: q || undefined, page, ...extra }),
      })
      if (r.status === 401) {
        onInvalid()
        return null
      }
      return (await r.json()) as RankResult
    },
    [token, fields, prefs, country, level, sort, q, page, onInvalid],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      query().then((d) => {
        if (!cancelled && d) setData(d)
        if (!cancelled) setLoading(false)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  async function exportCsv() {
    const all = await query({ page: 0, pageSize: 2000 })
    if (!all) return
    const cols = ['match', 'name', 'institution', 'country', 'city', 'level', 'field', 'tuition_per_year', 'currency', 'earnings', 'admission_rate', 'url']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = all.items.map((p) =>
      [p.match, p.name, p.institution, p.country, p.city, p.level, FIELD_BY_ID[p.matchedField]?.name, p.fee?.amount, p.fee?.currency, p.earnings?.median, p.admissionRate, p.url ?? p.institutionUrl]
        .map(esc)
        .join(','),
    )
    const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'whatshouldistudy-programmes.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          placeholder="Search programme, university, city"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select value={country} onChange={(e) => (setCountry(e.target.value), setPage(0))} className="rounded-xl border border-line bg-bg px-3 py-2 text-sm">
          <option value="">All countries</option>
          {Object.entries(data?.facets.countries ?? {}).map(([cc, n]) => (
            <option key={cc} value={cc}>
              {countryName(cc)} ({n})
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => (setLevel(e.target.value as Level | 'any'), setPage(0))} className="rounded-xl border border-line bg-bg px-3 py-2 text-sm">
          <option value="any">All levels</option>
          {Object.entries(data?.facets.levels ?? {}).map(([l, n]) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l as Level]} ({n})
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => (setSort(e.target.value as typeof sort), setPage(0))} className="rounded-xl border border-line bg-bg px-3 py-2 text-sm">
          <option value="match">Best match</option>
          <option value="cost">Lowest tuition</option>
          <option value="earnings">Highest earnings</option>
          <option value="new">Newest</option>
        </select>
        <button type="button" onClick={exportCsv} className="rounded-xl border border-line px-3 py-2 text-sm hover:border-ink/40">
          CSV
        </button>
      </div>
      <p className="mt-4 text-sm text-muted">
        {data ? `${data.total.toLocaleString('en')} programmes` : 'Loading…'}
        {data?.updated && ` · data from ${new Date(data.updated).toLocaleDateString('en', { dateStyle: 'medium' })}`}
        {loading && data && ' · updating…'}
      </p>
      <div className="mt-3 grid gap-3">
        {data?.items.map((p) => (
          <ProgrammeRow key={p.id} p={p} />
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full border border-line px-4 py-2 disabled:opacity-40">
            ← Previous
          </button>
          <span className="text-muted">
            {page + 1} / {pages}
          </span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded-full border border-line px-4 py-2 disabled:opacity-40">
            Next →
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
  const [data, setData] = useState<ResearchResponse | null>(null)
  useEffect(() => {
    fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ fields, countries }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [token, fields, countries])

  if (!data?.byCountry) return null
  return (
    <div className="mt-12">
      <h3 className="font-display text-2xl">More countries: where your fields are strong</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        For these countries we don’t have an official programme-by-programme list yet. Instead: the universities with the most research in your fields
        (OpenAlex), a strong sign the field is taught seriously, especially at master’s level, plus every university in the country.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Object.entries(data.byCountry).map(([cc, c]) => (
          <div key={cc} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-semibold">
                {flag(cc)} {countryName(cc)}
              </h4>
              <span className="text-xs text-muted">{c.directory} universities</span>
            </div>
            {COUNTRIES[cc]?.typicalTuition && <p className="mt-1 text-xs text-muted">Typical tuition: {COUNTRIES[cc].typicalTuition}</p>}
            {Object.keys(c.research).length === 0 && <p className="mt-3 text-sm text-muted">No research profile data for your fields here.</p>}
            {Object.entries(c.research).map(([fid, list]) => (
              <div key={fid} className="mt-3">
                <div className="text-xs uppercase tracking-wider text-muted">{FIELD_BY_ID[fid]?.name}</div>
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
                        <span className="h-1.5 w-16 shrink-0 rounded-full bg-surface-2">
                          <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((i.strength ?? 0) * 100)}%` }} />
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-sm text-muted">{list.length} universities ranked · unlock to see them</p>
                )}
              </div>
            ))}
            {data.paid && c.universities && c.universities.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-accent">All {c.universities.length} universities</summary>
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
                          href={`https://www.google.com/search?q=${encodeURIComponent(`site:${u.domain} ${fields.map((f) => FIELD_BY_ID[f]?.name).slice(0, 2).join(' OR ')} degree`)}`}
                        >
                          search programmes
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
