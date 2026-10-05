import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BIG5_LABELS, FIELDS, FIELD_BY_ID, GROUP_LABELS, RIASEC_KEYS, RIASEC_LABELS, SUBJECT_LABELS, VALUE_KEYS, VALUE_LABELS } from '@/lib/taxonomy/fields.ts'
import type { Big5Key, SubjectKey } from '@/lib/taxonomy/fields.ts'
import { riasecCode } from '@/lib/engine/questionnaire.ts'
import { getMeta, getStats } from '@/lib/server/data.ts'
import { countryName, flag } from '@/lib/countries.ts'
import { Hexagon } from '../../components/hexagon.tsx'

export const revalidate = 86400

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const f = FIELD_BY_ID[id]
  if (!f) return {}
  return {
    title: `Should I study ${f.name}?`,
    description: `${f.blurb} Who ${f.name} suits, which school subjects it draws on, where it leads, and programmes worldwide.`,
    alternates: { canonical: `/fields/${id}` },
  }
}

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const f = FIELD_BY_ID[id]
  if (!f) notFound()
  const [stats, { meta }] = await Promise.all([getStats(), getMeta()])
  const s = stats[id]
  const byCountry = Object.entries(meta?.counts[id] ?? {}).sort((a, b) => b[1] - a[1])
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

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
      <Link href="/fields" className="text-sm text-muted hover:text-ink">
        ← All fields · {GROUP_LABELS[f.group]}
      </Link>
      <h1 className="mt-3 font-display text-4xl sm:text-6xl">{f.name}</h1>
      <p className="mt-4 max-w-3xl text-xl text-muted">{f.blurb}</p>

      <div className="mt-10 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="font-semibold">Who it suits</h2>
          <div className="mt-2 flex items-center gap-4">
            <Hexagon profile={f.riasec} size={170} />
            <div className="text-sm">
              <div className="font-display text-3xl">{riasecCode(f.riasec)}</div>
              <ul className="mt-2 grid gap-1 text-muted">
                {[...riasecCode(f.riasec)].map((k) => (
                  <li key={k}>{RIASEC_LABELS[k as (typeof RIASEC_KEYS)[number]].short}</li>
                ))}
              </ul>
            </div>
          </div>
          {traits.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Students in this field tend to be a bit more{' '}
              {traits.map(([k, v]) => (v > 0 ? BIG5_LABELS[k].high.split(',')[0] : BIG5_LABELS[k].low.split(',')[0])).join(', ')} than average.
            </p>
          )}
        </div>
        <div className="grid gap-4">
          <div className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="font-semibold">Builds on</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {subjects.map(([k, d]) => (
                <span key={k} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
                  {SUBJECT_LABELS[k as SubjectKey]} <span className="text-muted">{'●'.repeat(Math.round((d ?? 0) * 3))}</span>
                </span>
              ))}
            </div>
            {offers.length > 0 && (
              <>
                <h2 className="mt-5 font-semibold">Typically offers</h2>
                <p className="mt-1 text-sm text-muted">{offers.map((k) => VALUE_LABELS[k]).join(' · ')}</p>
              </>
            )}
          </div>
          <div className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="font-semibold">Where it leads</h2>
            <p className="mt-1 text-sm text-muted">{f.careers.join(' · ')}</p>
            {s?.usMedianEarnings && (
              <p className="mt-3 text-sm">
                US median earnings one year after a bachelor’s: <strong>${Math.round(s.usMedianEarnings).toLocaleString('en')}</strong>
                <span className="text-muted"> (College Scorecard)</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {byCountry.length > 0 && (
        <section className="mt-10 rounded-3xl border border-line bg-surface p-6">
          <h2 className="font-semibold">{(s?.programmes ?? 0).toLocaleString('en')} programmes tracked</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {byCountry.map(([cc, n]) => (
              <span key={cc} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
                {flag(cc)} {countryName(cc)} <span className="text-muted">{n.toLocaleString('en')}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl">Related fields</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => (
            <Link key={r.id} href={`/fields/${r.id}`} className="rounded-2xl border border-line bg-surface p-4 hover:border-accent/50">
              <div className="font-medium">{r.name}</div>
              <div className="mt-1 text-xs text-muted">{GROUP_LABELS[r.group]}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-3xl bg-ink p-8 text-bg sm:p-10">
        <h2 className="font-display text-3xl">Is {f.name} right for you?</h2>
        <p className="mt-3 max-w-2xl opacity-75">Find out from what you actually watch, read and build, plus a five-minute questionnaire. Free, and it runs in your browser.</p>
        <Link href="/start" className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-medium text-accent-ink">
          Find my field
        </Link>
      </div>
    </div>
  )
}
