'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { effectiveSummaries, update, useAppState } from '@/lib/store.ts'
import { profileShape, scoreRiasec } from '@/lib/engine/questionnaire.ts'
import { emoji, fieldCareers, riasecLabel } from '@/lib/site/labels.ts'
import { OCCUPATIONS } from '@/lib/work/occupations.ts'
import { companyFit, matchOccupations, normaliseSearch, rankCompanies, rankJobs } from '@/lib/work/matching.ts'
import { JOB_SOURCES, jobSector } from '@/lib/work/sources.ts'
import { DEFAULT_WORK_PREFERENCES, isCurrentJob, SECTORS } from '@/lib/work/types.ts'
import type { Job, JobsData, WorkPreferences } from '@/lib/work/types.ts'
import { useSite } from '../ui/site-context.tsx'
import { Burst } from '../ui/shapes.tsx'

const PAGE_SIZE = 12
const COLORS = ['var(--lime)', 'var(--sky)', 'var(--pink)', 'var(--yellow)', 'var(--violet)', 'var(--orange)']

export function WorkView({ data, unavailable }: { data: JobsData; unavailable: boolean }) {
  const { t, r, locale, intl } = useSite()
  const w = t.work
  const state = useAppState()
  const [now, setNow] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('')
  const [allIdeas, setAllIdeas] = useState(false)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [companiesShown, setCompaniesShown] = useState(6)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const prefs = { ...DEFAULT_WORK_PREFERENCES, ...state.workPrefs }
  const setPrefs = (patch: Partial<WorkPreferences>) => {
    update((s) => ({ ...s, workPrefs: { ...DEFAULT_WORK_PREFERENCES, ...s.workPrefs, ...patch } }))
    setShown(PAGE_SIZE)
    setCompaniesShown(6)
  }
  const occupations = useMemo(() => matchOccupations(state.answers, effectiveSummaries(state), state.prefs.studying), [state])
  const profile = scoreRiasec(state.answers)
  const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(intl, { dateStyle: 'medium' }) : '—'
  const jobs = data.jobs.filter((job) => now !== null && isCurrentJob(job, now))
  const search = normaliseSearch(query)
  const filtered = jobs.filter((job) => (!family || job.occupationIds.includes(family)) && (prefs.entry === 'any' || job.entry === prefs.entry) && (!search || normaliseSearch(`${job.title} ${job.company} ${job.city}`).includes(search)))
  const ranked = rankJobs(filtered, occupations, prefs)
  const companies = rankCompanies(ranked)
  const clearFilters = () => { setQuery(''); setFamily(''); setPrefs({ entry: 'any' }); setShown(PAGE_SIZE) }
  const findRoles = (id: string) => { setFamily(id); setQuery(''); setPrefs({ entry: 'any' }); setShown(PAGE_SIZE) }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
      <Link href={r.results} className="text-sm font-bold hover:underline">← {w.back}</Link>
      <header className="relative mt-8 border-b-2 border-line pb-9">
        <Burst className="absolute right-0 top-0 hidden md:block" size={100} color="var(--yellow)" />
        <div className="flex flex-wrap gap-3"><span className="chip" style={{ background: 'var(--yellow)' }}>{w.beta}</span><span className="sticker" style={{ background: 'var(--lime)' }}>{w.free}</span><span className="chip">{w.country}</span></div>
        <h1 className="mt-6 max-w-3xl font-display text-5xl sm:text-6xl">{w.title}</h1>
        <p className="mt-4 max-w-2xl text-xl text-muted">{w.lead}</p>
        <p className="mt-5 max-w-2xl text-sm text-muted">{w.local}</p>
        <nav className="mt-6 flex flex-wrap gap-3" aria-label={w.title}>
          <a className="btn btn-ghost btn-sm" href="#ideas">{w.ideas}</a>
          <a className="btn btn-ghost btn-sm" href="#jobs">{w.jobs}</a>
          <a className="btn btn-ghost btn-sm" href="#employers">{w.employers}</a>
        </nav>
      </header>

      {now !== null && (
        <div className="card-sm mt-6 flex flex-wrap items-center justify-between gap-4 p-5 text-on-color" style={{ background: 'var(--sky)' }}>
          <div><p className="font-bold">{occupations.length ? `✓ ${w.imported}` : w.empty}</p>{!occupations.length && <p className="mt-1 text-sm">{w.emptyText}</p>}</div>
          <Link className="btn btn-ghost btn-sm" href={r.start}>{occupations.length ? t.results.addMore : w.start} →</Link>
        </div>
      )}

      <section id="ideas" className="scroll-mt-24 pt-12">
        <h2 className="font-display text-3xl sm:text-4xl">{w.ideas}</h2>
        <p className="mt-3 max-w-3xl text-muted">{w.ideasText}</p>
        {profile && profileShape(profile).flat && <p className="mt-3 text-sm text-muted">{w.flat}</p>}
        {!occupations.length ? <p className="card-sm mt-6 p-6 text-muted">{w.noProfile}</p> : (
          <>
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {occupations.slice(0, allIdeas ? occupations.length : 6).map((match, i) => {
                const occupation = OCCUPATIONS.find((o) => o.id === match.id)!
                const examples = [...new Set(occupation.fields.flatMap((id) => fieldCareers(id, locale)))].slice(0, 4)
                return (
                  <article key={match.id} className="card flex min-w-0 flex-col p-6">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-line text-3xl" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true">{emoji(occupation.fields[0])}</span>
                    <h3 className="font-display text-2xl">{w.roles[match.id]}</h3>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted">{w.activities}</p>
                    <p className="mt-1 text-sm">{examples.join(' · ')}</p>
                    <div className="mb-5 mt-4 space-y-2 text-sm text-muted">
                      {match.interests.length > 0 && <p>{w.interestReason}: {match.interests.map((key) => riasecLabel(key, locale).name).join(' · ')}</p>}
                      {match.fromData && <p>{w.dataReason}</p>}
                      {!match.interests.length && !match.fromData && <p>{w.exploratory}</p>}
                    </div>
                    <a href="#jobs" className="mt-auto font-bold text-accent hover:underline" onClick={() => findRoles(match.id)}>{w.choose} →</a>
                  </article>
                )
              })}
            </div>
            <button type="button" className="btn btn-ghost mt-6" onClick={() => setAllIdeas(!allIdeas)}>{allIdeas ? w.fewerIdeas : w.allIdeas}</button>
          </>
        )}
      </section>

      <section className="card mt-12 p-6 sm:p-8" aria-labelledby="work-preferences">
        <h2 id="work-preferences" className="font-display text-3xl">{w.preferences}</h2>
        <p className="mt-2 text-sm text-muted">{w.preferencesText}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">{w.city}<input className="input w-full" value={prefs.city} maxLength={80} placeholder={w.cityPlaceholder} onChange={(e) => setPrefs({ city: e.target.value })} /></label>
          <label className="grid gap-2 text-sm font-bold">{w.workplace}<select className="input w-full" value={prefs.workplace} onChange={(e) => setPrefs({ workplace: e.target.value as WorkPreferences['workplace'] })}><option value="any">{w.any}</option>{(['onsite', 'hybrid', 'remote'] as const).map((key) => <option key={key} value={key}>{w.workplaces[key]}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold">{w.sector}<select className="input w-full" value={prefs.sector} onChange={(e) => setPrefs({ sector: e.target.value as WorkPreferences['sector'] })}><option value="any">{w.any}</option>{SECTORS.map((key) => <option key={key} value={key}>{w.sectors[key]}</option>)}</select></label>
        </div>
      </section>

      <section id="jobs" className="scroll-mt-24 pt-12">
        <h2 className="font-display text-3xl sm:text-4xl">{w.jobs}</h2>
        <p className="mt-3 max-w-3xl text-muted">{w.jobsText}</p>
        {now !== null && <p className="mt-4 font-bold">{w.inventory(jobs.length, jobs.filter((job) => job.entry === 'training').length, new Set(jobs.map((job) => `${job.sourceId}:${job.company}`)).size)}</p>}
        {unavailable && <p role="status" className="mt-3 text-sm text-muted">{w.noData}</p>}
        {data.sources.some((s) => !s.ok) && <p role="status" className="mt-3 text-sm text-muted">{w.partial}</p>}
        <div className="card-sm mt-6 grid gap-4 p-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">{w.search}<input type="search" className="input w-full" value={query} maxLength={120} onChange={(e) => { setQuery(e.target.value); setShown(PAGE_SIZE) }} /></label>
          <label className="grid gap-2 text-sm font-bold">{w.family}<select className="input w-full" value={family} onChange={(e) => { setFamily(e.target.value); setShown(PAGE_SIZE) }}><option value="">{w.all}</option>{OCCUPATIONS.map((o) => <option key={o.id} value={o.id}>{w.roles[o.id]}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold">{w.entry}<select className="input w-full" value={prefs.entry} onChange={(e) => setPrefs({ entry: e.target.value as WorkPreferences['entry'] })}><option value="any">{w.all}</option>{(['training', 'junior', 'experienced', 'unknown'] as const).map((key) => <option key={key} value={key}>{w.entries[key]}</option>)}</select></label>
        </div>
        <p className="mt-4 text-sm font-bold" aria-live="polite">{w.count(ranked.length)}</p>
        {!ranked.length && <div className="card-sm mt-4 p-6"><p>{w.noJobs}</p><button type="button" className="btn btn-ghost btn-sm mt-4" onClick={clearFilters}>{w.reset}</button></div>}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {ranked.slice(0, shown).map(({ job, occupation, fit }) => (
            <article key={job.id} className="card-sm flex min-w-0 flex-col p-5 sm:p-6">
              <p className="text-sm font-bold text-muted">{job.company} · {job.city}</p>
              <h3 className="mt-2 break-words font-display text-2xl">{job.title}</h3>
              <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="chip">{w.workplaces[job.workplace]}</span><span className="chip">{w.entries[job.entry]}</span>{job.employment && <span className="chip">{job.employment}</span>}</div>
              {occupation && <p className="mt-4 text-sm font-semibold text-accent">{w.roles[occupation.id]}</p>}
              {fit.requested > 0 && <p className="mt-2 text-sm">{w.conditions(fit.matched, fit.requested)}</p>}
              <p className="mb-5 mt-4 text-xs text-muted">{w.checked}: <time dateTime={job.checkedAt}>{date(job.checkedAt)}</time>{job.postedAt && <> · {w.posted}: <time dateTime={job.postedAt}>{date(job.postedAt)}</time></>}</p>
              <a className="mt-auto font-bold text-accent hover:underline" href={job.url} target="_blank" rel="noopener noreferrer">{w.open}</a>
            </article>
          ))}
        </div>
        {ranked.length > shown && <button className="btn btn-ghost mt-6" type="button" onClick={() => setShown(shown + PAGE_SIZE)}>{w.showMore}</button>}
        <p className="mt-4 text-xs text-muted">{w.expired}</p>
      </section>

      <section id="employers" className="scroll-mt-24 pt-12">
        <h2 className="font-display text-3xl sm:text-4xl">{w.employers}</h2>
        <p className="mt-3 max-w-3xl text-muted">{w.employersText}</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {companies.slice(0, companiesShown).map(({ best, jobs: companyJobs }) => <CompanyCard key={`${best.job.sourceId}:${best.job.company}`} job={best.job} prefs={prefs} count={companyJobs.length} />)}
        </div>
        {companies.length > companiesShown && <button className="btn btn-ghost mt-6" type="button" onClick={() => setCompaniesShown(companiesShown + 6)}>{w.moreEmployers}</button>}
        {!companies.length && <p className="mt-5 text-muted">{w.noJobs}</p>}
        <p className="card-sm mt-6 p-5 text-sm">{w.culture}</p>
      </section>

      <section className="mt-12 border-t-2 border-line pt-8">
        <h2 className="font-display text-2xl">{w.sources}</h2><p className="mt-3 text-sm text-muted">{w.coverage}</p>
        <ul className="mt-4 space-y-2 text-sm">{JOB_SOURCES.map((source) => {
          const run = data.sources.find((s) => s.id === source.id)
          return <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">{source.name} ↗</a> · {w.vacancyCount(jobs.filter((job) => job.sourceId === source.id).length)} · {run ? `${run.ok ? w.sourceOk : w.sourceError}: ${date(run.checkedAt)}` : w.sourcePending}</li>
        })}</ul>
        <details className="card-sm mt-6 p-5"><summary className="cursor-pointer font-bold">{w.method}</summary><p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{w.methodText}</p></details>
      </section>
    </div>
  )
}

function CompanyCard({ job, prefs, count }: { job: Job; prefs: WorkPreferences; count: number }) {
  const { t } = useSite()
  const w = t.work
  const fit = companyFit(job, prefs)
  const sector = jobSector(job)
  const facts = [
    { label: w.city, value: job.city, status: fit.city },
    { label: w.workplace, value: w.workplaces[job.workplace], status: fit.workplace },
    { label: w.sector, value: sector ? w.sectors[sector] : w.fitStatus.unknown, status: fit.sector },
  ]
  return (
    <article className="card min-w-0 p-6">
      <p className="text-xs font-bold text-muted">{w.vacancyCount(count)}</p>
      <h3 className="mt-2 break-words font-display text-2xl">{job.company}</h3>
      <p className="mt-3 text-sm font-bold">{fit.requested ? w.conditions(fit.matched, fit.requested) : w.noWishes}</p>
      <dl className="mt-5 space-y-4 text-sm">{facts.map((f) => <div key={f.label}><dt className="text-xs text-muted">{f.label}</dt><dd className="mt-1 font-semibold">{f.value}{f.status !== 'unset' && <span className="ml-2 text-xs font-normal">{f.status === 'match' ? '✓ ' : ''}{w.fitStatus[f.status]}</span>}</dd></div>)}</dl>
      <p className="mt-5 border-t border-line pt-4 text-xs text-muted">{w.basedOn}</p>
      <a className="mt-1 block text-sm font-bold text-accent hover:underline" href={job.url} target="_blank" rel="noopener noreferrer">{job.title} ↗</a>
    </article>
  )
}
