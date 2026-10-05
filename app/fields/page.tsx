import type { Metadata } from 'next'
import Link from 'next/link'
import { FIELDS, GROUP_LABELS } from '@/lib/taxonomy/fields.ts'
import type { FieldGroup } from '@/lib/taxonomy/fields.ts'
import { getStats } from '@/lib/server/data.ts'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'All fields of study',
  description: `${FIELDS.length} fields of study explained: what you learn, who they suit, where they lead, and how many programmes we track worldwide.`,
  alternates: { canonical: '/fields' },
}

export default async function Fields() {
  const stats = await getStats()
  const groups = Object.keys(GROUP_LABELS) as FieldGroup[]
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">Fields of study</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        The {FIELDS.length} fields we match you to. Not sure which is yours?{' '}
        <Link href="/start" className="text-accent underline-offset-2 hover:underline">
          Find out
        </Link>
        .
      </p>
      {groups.map((g) => (
        <section key={g} className="mt-12">
          <h2 className="font-display text-2xl">{GROUP_LABELS[g]}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <Link key={f.id} href={`/fields/${f.id}`} className="rounded-2xl border border-line bg-surface p-5 hover:border-accent/50">
                <div className="font-semibold">{f.name}</div>
                <p className="mt-1.5 text-sm text-muted">{f.blurb}</p>
                {stats[f.id]?.programmes ? <p className="mt-3 text-xs text-muted">{stats[f.id].programmes.toLocaleString('en')} programmes tracked</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
