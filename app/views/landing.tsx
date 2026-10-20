import Link from 'next/link'
import { getMeta } from '@/lib/server/data.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { CH_INSTITUTIONS } from '@/lib/ch-institutions.ts'
import { admissionText, SCHOOL_TYPES, TYPE_STYLE, typeLabel } from '@/lib/institutions.ts'
import { AT_INSTITUTIONS } from '@/lib/at-institutions.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import { SALES_PAUSED, isLocal } from '@/lib/site/config.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { emoji, fieldName, fmtNumber } from '@/lib/site/labels.ts'
import { Hexagon } from '../ui/hexagon.tsx'
import { Marquee } from '../ui/marquee.tsx'
import { Price } from '../ui/price.tsx'
import { LandingCheckout } from '../ui/landing-checkout.tsx'
import { GoogleAdsEntry, GoogleAdsVariant } from '../ui/google-ads-entry.tsx'
import { PayWithTwint } from '../ui/twint.tsx'
import { Blob, Burst, Pill, Ring, Sparkle, Squiggle } from '../ui/shapes.tsx'
import { GitHubMark } from '../ui/trust.tsx'
import { JsonLd, homeLd } from '../ui/json-ld.tsx'
import { SOURCE_URL } from '@/lib/site.ts'
import type { LandingSource } from '@/lib/site/dict.ts'

/** A spread of fields for the browse card, so it does not show six kinds of computing. */
const SAMPLE_FIELDS = ['psychology', 'medicine', 'computer-science', 'law', 'architecture', 'biology']

export async function Landing({ site, base, locale: selectedLocale }: SiteProps) {
  const k = kit(site, base, selectedLocale)
  const { t, r, locale, intl } = k
  const { meta, sample } = await getMeta()
  const local = isLocal(site)
  const country = k.conf.country
  // A country site counts its own country.
  const own = country ? meta?.byCountry?.[country] : undefined
  const programmes = local ? (own?.programmes ?? 0) : (meta?.totals.programmes ?? 0)
  const institutions = local ? (own?.institutions ?? 0) : (meta?.totals.institutions ?? 0)
  const sources = t.landing.sources.filter((s) => s.id !== 'questionnaire')
  const sourceCard = (s: LandingSource) => (
    <div key={s.id} className="card card-pop flex flex-col overflow-hidden">
      <div className={`${s.badge === 'optional' ? '' : 'on-color '}flex items-center justify-between gap-3 border-b-2 border-line px-6 py-4`} style={{ background: `var(--${s.color})` }}>
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-surface text-xl text-ink" aria-hidden="true">
            {s.glyph}
          </span>
          <span className="font-display text-2xl">{s.name}</span>
        </span>
        {s.badge === 'best' && <span className="rounded-full border-2 border-line bg-surface px-2.5 py-0.5 text-xs font-extrabold text-ink">{t.start.best}</span>}
        {s.badge === 'optional' && <span className="rounded-full border-2 border-soft-line px-2.5 py-0.5 text-xs font-semibold text-muted">{t.start.optional}</span>}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="font-semibold">{s.how}</p>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.what}</p>
        {s.id === 'takeout' ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="https://takeout.google.com/settings/takeout/custom/my_activity" target="_blank" rel="noreferrer" className="btn btn-ink btn-sm">{t.start.request.activity} ↗</a>
            <Link href={`${r.start}#${r.anchors.sources}`} className="btn btn-ghost btn-sm">{t.start.fileReady} →</Link>
          </div>
        ) : <span className="chip mt-5 self-start">{s.n}</span>}
      </div>
    </div>
  )

  return (
    <>
      <JsonLd data={homeLd(site, t.landing.faq)} />
      {/* Hero */}
      <section className="dots relative overflow-hidden border-b-2 border-line">
        <div aria-hidden="true" className="pointer-events-none absolute right-4 top-10 hidden md:block">
          <Burst className="spin-slow" size={130} color="var(--yellow)" />
        </div>
        <Ring className="float absolute -left-6 bottom-16 hidden md:block" size={86} color="var(--sky)" style={{ ['--r' as string]: '0deg' }} />
        <Sparkle className="float-slow absolute left-[46%] top-8 hidden lg:block" size={44} color="var(--pink)" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-start gap-14 px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:pt-20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="sticker max-w-full" style={{ background: 'var(--lime)' }}>
                <span aria-hidden="true" className="shrink-0">✦</span> <GoogleAdsVariant ads={t.landing.aiReport}>{t.landing.badge}</GoogleAdsVariant>
              </p>
              <a href="#swiss-ai" className="sticker max-w-full text-left transition-transform hover:-translate-y-0.5" style={{ background: 'var(--pink)', transform: 'rotate(-1.5deg)' }}>
                <span aria-hidden="true" className="shrink-0">🇨🇭</span> {t.landing.swissAi.badge}
              </a>
            </div>
            <h1 className="mt-7 font-display text-[2.5rem] sm:text-5xl lg:text-6xl">
              <span className="block text-accent">{t.landing.h1a}</span>
              {t.landing.h1b} <span className="hl">{t.landing.h1c}</span> {t.landing.h1d}
            </h1>
            <Squiggle className="mt-4" size={150} />
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{t.landing.lead(FIELDS.length)}</p>
            <GoogleAdsEntry>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={r.start} className="btn btn-primary btn-lg">
                  {t.landing.cta} <span aria-hidden="true">→</span>
                </Link>
                <a href="#swiss-ai" className="btn btn-ghost btn-lg">
                  {t.landing.cta2}
                </a>
              </div>
              {!SALES_PAUSED[site] && <a href="#pricing" className="mt-4 inline-block text-sm font-semibold text-accent underline underline-offset-4">
                {t.landing.aiReport}: <Price site={site} /> · {t.landing.oneTime}
              </a>}
              {!SALES_PAUSED[site] && <PayWithTwint className="mt-3" />}
            </GoogleAdsEntry>
            {programmes > 0 && (
              <Link href={r.programmes} className="mt-7 inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface px-4 py-1.5 text-sm font-semibold hover:-translate-y-0.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sample ? 'bg-yellow' : 'bg-good'}`} aria-hidden="true" />
                {(sample ? t.landing.demoTotals : t.landing.totals)(fmtNumber(programmes, intl), fmtNumber(institutions, intl))} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <HeroCard k={k} />
        </div>
      </section>

      {/* Ribbons */}
      <section className="relative overflow-hidden py-10" aria-label={t.landing.marquee}>
        <Marquee locale={locale} tilt={-2} />
        <div className="-mt-3">
          <Marquee locale={locale} tilt={1.5} reverse offset={20} color="var(--lime)" textColor="var(--on-color)" />
        </div>
      </section>

      {/* Answer the questionnaire, then what the report gives you: programmes and the AI comparison. */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {t.landing.cols.map((step, i) => (
            <div key={step.title} className="card card-pop on-color flex flex-col p-7" style={{ background: ['var(--yellow)', 'var(--pink)', 'var(--sky)'][i], transform: `rotate(${[-1.2, 0.8, -0.6][i]}deg)` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-display text-5xl opacity-30">0{i + 1}</div>
                <span className="mt-1 rounded-full border-2 border-line bg-surface px-3 py-0.5 text-right text-xs font-extrabold text-ink">{step.tag}</span>
              </div>
              <h2 className="mt-2 font-display text-3xl">{step.title}</h2>
              <p className="mt-3 leading-relaxed text-muted">{step.text}</p>
              <ul className="mt-5 grid gap-2.5 border-t-2 border-on-color/20 pt-5 text-sm leading-relaxed">
                {step.points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span className="font-extrabold" aria-hidden="true">✓</span> {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {!SALES_PAUSED[site] && (
          <p className="mt-8 text-center font-semibold">
            {t.landing.colsNote[0]} <a href="#pricing" className="text-accent underline underline-offset-4"><Price site={site} /></a> {t.landing.colsNote[1]}
          </p>
        )}
      </section>

      {/* Concrete AI benefits; importing history remains optional. */}
      <section id="swiss-ai" aria-labelledby="swiss-ai-title" className="scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="card relative mx-auto max-w-6xl overflow-hidden bg-accent-soft p-6 sm:p-10 lg:p-12">
          <Sparkle className="absolute right-8 top-10 hidden lg:block" size={64} color="var(--pink)" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-4">
              <p className="sticker" style={{ background: 'var(--pink)' }}><span aria-hidden="true">🇨🇭</span> {t.landing.swissAi.badge}</p>
              <p className="text-sm font-semibold text-muted">{t.landing.swissAi.optional}</p>
            </div>
            <h2 id="swiss-ai-title" className="mt-7 max-w-3xl font-display text-4xl sm:text-5xl">{t.landing.swissAi.title}</h2>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{t.landing.swissAi.intro}</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {t.landing.swissAi.uses.map((use, i) => (
                <li key={use} className="card-flat p-5 sm:p-6">
                  <span className="on-color mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-line font-display text-xl" style={{ background: ['var(--pink)', 'var(--sky)', 'var(--lime)'][i] }} aria-hidden="true">0{i + 1}</span>
                  <h3 className="font-display text-2xl">{t.landing.swissAi.stepTitles[i]}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{use}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link href={r.start} className="btn btn-primary">{t.landing.swissAi.cta} <span aria-hidden="true">→</span></Link>
              <Link href={r.privacy} className="font-semibold text-accent underline">{t.landing.swissAi.details} →</Link>
            </div>
            <p className="mt-6 max-w-4xl text-sm leading-relaxed text-muted">{t.landing.swissAi.retention}</p>
          </div>
        </div>
      </section>

      {/* Browse without the analysis */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl sm:text-5xl">{t.landing.explore.title}</h2>
          <p className="mt-4 text-lg text-muted">{t.landing.explore.sub}</p>
        </div>
        <div className={`mt-10 grid gap-5 ${programmes > 0 ? 'md:grid-cols-2' : ''}`}>
          <Link href={r.fields} className="card card-pop on-color group flex flex-col p-7 hover:-translate-y-0.5" style={{ background: 'var(--lime)' }}>
            <span className="font-display text-3xl">{t.landing.explore.fieldsTitle}</span>
            <span className="mt-3 flex-1 leading-relaxed text-muted">{t.landing.explore.fieldsText(FIELDS.length)}</span>
            <span className="mt-5 flex flex-wrap gap-2" aria-hidden="true">
              {SAMPLE_FIELDS.map((id) => (
                <span key={id} className="rounded-full border-2 border-line bg-surface px-3 py-1 text-sm font-semibold text-ink">
                  {emoji(id)} {fieldName(id, locale)}
                </span>
              ))}
            </span>
            <span className="mt-6 font-semibold">
              {t.landing.explore.fieldsCta} <span aria-hidden="true">→</span>
            </span>
          </Link>
          {programmes > 0 && (
            <Link href={r.programmes} className="card card-pop on-color group flex flex-col p-7 hover:-translate-y-0.5" style={{ background: 'var(--sky)' }}>
              <span className="font-display text-3xl">{t.landing.explore.programmesTitle}</span>
              <span className="mt-3 flex-1 leading-relaxed text-muted">{t.landing.explore.programmesText(fmtNumber(programmes, intl), fmtNumber(institutions, intl))}</span>
              <span className="mt-6 font-semibold">
                {t.landing.explore.programmesCta} <span aria-hidden="true">→</span>
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* Sources */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl sm:text-5xl">{t.landing.sourcesTitle}</h2>
          <p className="mt-4 text-lg text-muted">{t.landing.sourcesSub}</p>
        </div>
        <div className="mt-10">
          {sources.filter((s) => s.id === 'takeout').map(sourceCard)}
        </div>
        <details className="group mt-5 text-sm text-muted">
          <summary className="card-sm flex cursor-pointer list-none items-center justify-between gap-4 bg-accent-soft px-5 py-4 text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-lg font-bold">{t.start.optionalSources}</span>
              <span className="mt-1 block text-sm text-muted">{t.start.optionalSourcesHint}</span>
            </span>
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-lime text-2xl text-on-color transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3">{t.start.optionalYoutube}</p>
          <a href="https://takeout.google.com/settings/takeout/custom/youtube" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline">{t.start.request.youtube} ↗</a>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sources.filter((s) => s.id !== 'takeout').map(sourceCard)}
          </div>
        </details>
      </section>

      {local && country && <SchoolTypes k={k} country={country} counts={own?.byType ?? {}} />}

      {/* Privacy */}
      <section className="px-4 py-14 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border-2 border-line bg-ink text-bg" style={{ boxShadow: '8px 8px 0 var(--accent)' }}>
          <Blob className="absolute -bottom-16 -right-10 opacity-90" size={220} color="var(--accent)" />
          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <p className="sticker" style={{ background: 'var(--lime)' }}>🔒 {site === 'ch' ? 'DSG' : site === 'global' ? 'GDPR' : 'DSGVO'}</p>
              <h2 className="mt-5 font-display text-4xl sm:text-5xl">{t.landing.privacyTitle}</h2>
              <p className="mt-5 leading-relaxed opacity-80">{t.landing.privacyBody}</p>
            </div>
            <ul className="grid content-center gap-3">
              {t.landing.privacyPoints.map((x) => (
                <li key={x} className="flex items-center gap-3 rounded-2xl border-2 border-bg/25 bg-bg/5 px-5 py-4 font-semibold">
                  <span className="on-color flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-line bg-lime text-sm" aria-hidden="true">
                    ✓
                  </span>
                  {x}
                </li>
              ))}
              <li>
                <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border-2 border-bg/25 bg-bg/5 px-5 py-4 font-semibold hover:border-bg">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-bg/40 bg-bg text-ink">
                    <GitHubMark />
                  </span>
                  {t.trust.point} · <span className="underline">{t.trust.viewCode} ↗</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="max-w-3xl font-display text-4xl sm:text-5xl">{t.landing.priceTitle}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card p-8">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-3xl">{t.landing.free}</h3>
              <span className="font-display text-4xl">0</span>
            </div>
            <ul className="mt-6 grid gap-3">
              {t.landing.freeList.map((x) => (
                <li key={x} className="flex gap-3">
                  <span className="text-good" aria-hidden="true">✓</span> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="card relative bg-accent p-8 text-accent-ink" style={{ transform: 'rotate(0.6deg)' }}>
            <div className="absolute -top-10 right-0 rotate-12 sm:-right-6">
              <Burst size={132} color="var(--yellow)" />
              <span className="absolute inset-0 flex flex-col items-center justify-center text-center font-display text-xl leading-none text-on-color">
                <Price site={site} />
              </span>
            </div>
            <h3 className="pr-20 font-display text-3xl">{t.landing.full}</h3>
            <p className="mt-1 pr-20 text-sm font-semibold opacity-80">{t.landing.oneTime}</p>
            {SALES_PAUSED[site] && (
              <p className="mt-3 rounded-xl bg-surface p-3 text-sm font-semibold text-ink">{t.salesPaused}</p>
            )}
            <ul className="mt-6 grid gap-3">
              {t.landing.fullList.map((x) => (
                <li key={x} className="flex gap-3">
                  <span aria-hidden="true">★</span> {x}
                </li>
              ))}
            </ul>
            {t.reportScope && <p className="mt-5 rounded-xl bg-surface p-4 text-sm font-semibold text-ink">{t.reportScope}</p>}
            {!SALES_PAUSED[site] && <LandingCheckout />}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-4xl sm:text-5xl">{t.landing.faqTitle}</h2>
        <div className="mt-8 grid gap-4">
          {t.landing.faq.map(([q, a]) => (
            <details key={q} className="card-sm group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {q}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-line bg-yellow text-on-color transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final call */}
      <section className="px-4 pt-6 sm:px-6">
        <div className="card on-color relative mx-auto max-w-6xl overflow-hidden bg-lime px-8 py-14 text-center sm:py-20">
          <Sparkle className="float absolute left-8 top-8" size={56} color="var(--pink)" />
          <Pill className="float-slow absolute -right-6 bottom-10 rotate-[-20deg]" size={140} color="var(--sky)" />
          <Burst className="spin-slow absolute -bottom-10 left-1/4 hidden sm:block" size={90} color="var(--yellow)" />
          <h2 className="relative font-display text-4xl sm:text-6xl">{t.landing.h1a}</h2>
          <Link href={r.start} className="btn btn-ink btn-lg relative mt-8">
            {t.landing.finalCta} <span aria-hidden="true">→</span>
          </Link>
          <p className="relative mt-6 text-sm text-muted">{t.landing.next}</p>
        </div>
      </section>
    </>
  )
}

/** An example result, stacked like trading cards. */
function HeroCard({ k }: { k: Kit }) {
  const { t, locale } = k
  return (
    <div className="relative mx-auto w-full max-w-[26rem] px-2 sm:px-0">
      <div className="card absolute inset-x-2 inset-y-0 translate-x-2 translate-y-3 rotate-[3deg] bg-pink" aria-hidden="true" />
      <div className="card absolute inset-x-2 inset-y-0 -translate-x-2 translate-y-1 rotate-[-2deg] bg-sky" aria-hidden="true" />
      <div className="card relative p-4 sm:rotate-[-1deg] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
          <span className="chip-soft">{t.landing.example}</span>
          <span>{t.landing.exampleSignals}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Hexagon profile={[0.92, 0.88, 0.35, 0.12, 0.3, 0.5]} size={104} label={t.misc.profileLabel} />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-muted">{t.landing.code}</div>
            <div className="font-display text-4xl">RIC</div>
            <div className="text-xs text-muted">{t.landing.codeSub}</div>
          </div>
        </div>
        <div className="mt-3 rounded-xl border-2 border-line bg-accent-soft p-3">
          <p className="text-xs font-bold text-muted">{t.landing.exampleProgrammeLabel}</p>
          <p className="mt-1 break-words font-display text-lg leading-snug sm:text-xl">{t.landing.exampleProgramme}</p>
          <p className="mt-1 text-sm font-semibold">EPFL · Lausanne</p>
        </div>
        <ol className="mt-3 grid gap-2">
          {t.landing.exampleRows.map(([id, score, why], i) => (
            <li key={id} className="rounded-xl border-2 border-line px-3 py-2 sm:py-2.5" style={{ background: i === 0 ? 'var(--accent-soft)' : undefined }}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                  <span className="shrink-0 text-base" aria-hidden="true">{emoji(id)}</span>
                  {fieldName(id, locale)}
                </span>
                <span className="on-color shrink-0 rounded-full border-2 border-line bg-lime px-2 py-0.5 text-xs font-extrabold">{score}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{why}</p>
            </li>
          ))}
        </ol>
        <div className="on-color mt-3 rounded-xl border-2 border-dashed border-line bg-yellow p-2.5 text-xs">
          <span className="font-bold">🔮 {t.landing.hiddenLabel}</span> {t.landing.hiddenText}
        </div>
      </div>
    </div>
  )
}

/** Country sites: the kinds of higher education and who gets in. */
function SchoolTypes({ k, country, counts }: { k: Kit; country: string; counts: Record<string, number> }) {
  const { t } = k
  // Switzerland and Austria have curated institution lists; Germany counts programmes from the data.
  const list = country === 'CH' ? CH_INSTITUTIONS : country === 'AT' ? AT_INSTITUTIONS : null
  const count = (type: string) => (list ? list.filter((i) => i.type === type).length : (counts[type] ?? 0))
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl">
        <h2 className="font-display text-4xl sm:text-5xl">{t.landing.typesTitle}</h2>
        <p className="mt-4 text-lg text-muted">{t.landing.typesSub}</p>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOOL_TYPES[country].map((type, i) => (
          <div key={type} className="card on-color p-6" style={{ background: TYPE_STYLE[type].color, transform: `rotate(${[-1, 0.7, -0.5, 1][i]}deg)` }}>
            <div className="text-3xl" aria-hidden="true">{TYPE_STYLE[type].glyph}</div>
            <h3 className="mt-3 hyphens-auto break-words font-display text-2xl">{typeLabel(type, country, k.locale === 'fr-CH' ? 'fr' : k.locale === 'it-CH' ? 'it' : 'de')}</h3>
            {count(type) > 0 && <p className="mt-1 text-sm font-bold">{t.landing.typesCount(count(type))}</p>}
            <p className="mt-3 text-sm leading-relaxed text-muted">{admissionText(country, type, k.locale === 'fr-CH' ? 'fr' : k.locale === 'it-CH' ? 'it' : 'de')}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
