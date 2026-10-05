import Link from 'next/link'
import { getMeta } from '@/lib/server/data.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { Hexagon } from './components/hexagon.tsx'

export const revalidate = 3600

const SOURCES = [
  {
    name: 'YouTube',
    how: 'Sign in with Google (read-only)',
    what: 'Every subscription with the date you subscribed, every liked video with tags and topic, your playlists and uploads, plus the description of every channel behind them.',
    typical: '500–5,000 signals',
  },
  {
    name: 'Google Takeout',
    how: 'Drop the file you download from Google',
    what: 'Your complete YouTube watch and search history, often years and tens of thousands of videos, plus your comments and Google searches. The richest source by far.',
    typical: '5,000–100,000 signals',
  },
  {
    name: 'Spotify',
    how: 'Sign in or drop your data export',
    what: 'Podcasts, saved episodes and audiobooks say what you want to understand. Your music taste adds a light personality signal.',
    typical: '200–20,000 signals',
  },
  {
    name: 'Reddit',
    how: 'Sign in (read-only)',
    what: 'The communities you joined, what you saved and upvoted, what you posted. r/AskHistorians says a lot.',
    typical: '100–3,000 signals',
  },
  {
    name: 'GitHub',
    how: 'Just your username',
    what: 'What you build and what you star, the strongest signal there is for people who make things.',
    typical: '20–600 signals',
  },
  {
    name: 'Questionnaire',
    how: '5 minutes, all optional',
    what: 'Holland interests (RIASEC), the 20-item Mini-IPIP Big Five, the school subjects you enjoy, and what you want from work.',
    typical: '60 answers',
  },
]

const FAQ = [
  {
    q: 'Do you store my YouTube history?',
    a: 'No. The analysis runs in your browser. Your history goes straight from Google to your device, gets turned into a summary (how much of what you watch is about each field), and the raw data is thrown away. Our server never sees it. The summary stays in your browser until you delete it.',
  },
  {
    q: 'Is this a real psychological test?',
    a: 'The questionnaire uses established instruments: Holland’s RIASEC interest model (the basis of most career guidance) and the Mini-IPIP, a validated 20-item Big Five scale. The footprint analysis is our own model, and the how-it-works page explains every step, including its limits.',
  },
  {
    q: 'Which countries do you cover?',
    a: 'Programme by programme: the United States (every accredited college, from the Department of Education), the United Kingdom (every undergraduate course) and France (every Parcoursup programme). For 60+ other countries, including all of Europe, we show the universities strongest in your fields based on their research output, plus a directory of every university. More countries are added as official data becomes available.',
  },
  {
    q: 'What does the paid report add?',
    a: 'The free result shows your profile and your best fields with explanations. The full report lists every matching programme in the countries you pick, with the fee that applies to you, graduate earnings where published, admission rates, links to apply, and the research-strong universities elsewhere. One payment, valid for 12 months, data refreshed weekly.',
  },
  {
    q: 'Can I use it without connecting anything?',
    a: 'Yes. The questionnaire alone gives a solid result. Every source you add makes it sharper: the confidence indicator on your result tells you how much the match is based on.',
  },
]

export default async function Home() {
  const { meta } = await getMeta()
  const totals = meta?.totals

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-good" /> Free · No sign-up · Runs in your browser
          </p>
          <h1 className="font-display text-4xl leading-[1.08] sm:text-6xl">
            What should you study? Ask the <em className="text-accent">10,000 choices</em> you’ve already made.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Not another quiz about what you think you like. We read what you actually watch, listen to, follow and build, add five minutes of validated
            psychology, and match you to {FIELDS.length} fields of study and real programmes around the world.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/start" className="rounded-full bg-accent px-6 py-3 font-medium text-accent-ink shadow-sm hover:opacity-90">
              Find my field
            </Link>
            <Link href="/how-it-works" className="rounded-full border border-line bg-surface px-6 py-3 font-medium hover:border-ink/30">
              How it works
            </Link>
          </div>
          {totals && totals.programmes > 0 && (
            <p className="mt-6 text-sm text-muted">
              {totals.programmes.toLocaleString('en')} programmes at {totals.institutions.toLocaleString('en')} institutions, refreshed weekly.
            </p>
          )}
        </div>
        <HeroCard />
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            ['Quizzes ask', 'what you think you like. Answers are shaped by what sounds good, what your parents said, and how you feel today.'],
            ['Your footprint shows', 'what you actually spend your attention on, month after month. Years of history don’t care how a question is phrased.'],
            ['We combine both', 'because a footprint can’t know your grades, your values or that you secretly love chemistry. Each part covers the other’s blind spots.'],
          ].map(([t, d]) => (
            <div key={t}>
              <h2 className="font-display text-2xl">{t}</h2>
              <p className="mt-3 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl sm:text-4xl">Connect what you like. Skip what you don’t.</h2>
        <p className="mt-3 max-w-2xl text-muted">Every source is optional and read-only. The more you add, the sharper the picture.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s) => (
            <div key={s.name} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{s.name}</h3>
                <span className="text-xs text-muted">{s.typical}</span>
              </div>
              <p className="mt-1 text-sm text-accent">{s.how}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.what}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-bg">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl">Your data stays yours.</h2>
            <p className="mt-4 leading-relaxed opacity-75">
              The whole analysis runs in your browser. Sign-ins are read-only and their tokens never touch our server. Exports are unpacked on your device.
              What’s kept is a summary, in your browser, deleted with one click. To show programmes we only ever send your top fields and filters, never
              anything about you.
            </p>
          </div>
          <ul className="grid gap-3 text-sm">
            {[
              'No account, no email, no tracking cookies',
              'Read-only access, revoked whenever you like',
              'Raw history is discarded after analysis',
              'Every step of the model is documented',
            ].map((x) => (
              <li key={x} className="flex items-center gap-3 rounded-xl border border-bg/15 px-4 py-3">
                <span className="text-good">✓</span> {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl sm:text-4xl">Free result. Full report when you’re ready.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-7">
            <h3 className="text-xl font-semibold">Free</h3>
            <ul className="mt-5 grid gap-2.5 text-sm text-muted">
              {[
                'Your best fields of study, with the evidence behind each',
                'Hidden matches you’d never have looked at',
                'Interest profile (RIASEC) and Big Five',
                'How your interests moved over the years',
                'How many programmes match, and where',
              ].map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-accent bg-surface p-7">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-semibold">Full report</h3>
              <span className="text-sm text-muted">one-time, 12 months</span>
            </div>
            <ul className="mt-5 grid gap-2.5 text-sm text-muted">
              {[
                'Every matching programme, ranked for you',
                'The tuition fee that applies to your nationality',
                'Graduate earnings, debt and admission rates where published',
                'Research-strong universities in 60+ countries',
                'Filters, search, CSV export, new programmes flagged',
              ].map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <h2 className="font-display text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-6 py-4">
              <summary className="cursor-pointer list-none font-medium">
                <span className="mr-2 inline-block text-accent transition group-open:rotate-45">+</span>
                {f.q}
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/start" className="rounded-full bg-accent px-7 py-3.5 font-medium text-accent-ink hover:opacity-90">
            Start now, it’s free
          </Link>
          <p className="mt-4 text-sm text-muted">Coming next from the same team: whatshouldiwork.</p>
        </div>
      </section>
    </>
  )
}

/** Illustrative result card for the hero. */
function HeroCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-accent/15 via-coral/10 to-transparent blur-2xl" />
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-ink/5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Example result</span>
          <span>14,382 signals · 4 sources</span>
        </div>
        <div className="mt-5 flex items-center gap-5">
          <Hexagon profile={[0.92, 0.88, 0.35, 0.12, 0.3, 0.5]} size={128} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Interest code</div>
            <div className="font-display text-3xl">RIC</div>
            <div className="text-sm text-muted">Builder · Thinker · Organiser</div>
          </div>
        </div>
        <ol className="mt-6 grid gap-3">
          {[
            ['Aerospace Engineering', 97, 'Everyday Astronaut, Scott Manley · 214 videos over 31 months'],
            ['Mechanical Engineering', 94, 'Stuff Made Here, r/CNC · your 3 repos'],
            ['Physics', 88, 'PBS Space Time · 2 podcasts'],
          ].map(([name, score, why], i) => (
            <li key={name as string} className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  <span className="mr-2 text-muted">{i + 1}</span>
                  {name}
                </span>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent">{score}</span>
              </div>
              <p className="mt-1.5 text-xs text-muted">{why}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm">
          <span className="font-medium">Hidden match:</span> <span className="text-muted">Industrial Design. You rarely watch it, but your profile fits.</span>
        </div>
      </div>
    </div>
  )
}
