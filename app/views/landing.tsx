import Link from 'next/link'
import { getMeta } from '@/lib/server/data.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { CH_INSTITUTIONS } from '@/lib/ch-institutions.ts'
import { ADMISSION, SCHOOL_TYPES, TYPE_STYLE, typeLabel } from '@/lib/institutions.ts'
import { AT_INSTITUTIONS } from '@/lib/at-institutions.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import { isLocal } from '@/lib/site/config.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { emoji, fieldName, fmtNumber } from '@/lib/site/labels.ts'
import { Hexagon } from '../ui/hexagon.tsx'
import { Marquee } from '../ui/marquee.tsx'
import { Price } from '../ui/price.tsx'
import { Blob, Burst, Pill, Ring, Sparkle, Squiggle } from '../ui/shapes.tsx'
import { GitHubMark, TrustStickers } from '../ui/trust.tsx'
import { JsonLd, homeLd } from '../ui/json-ld.tsx'
import { SOURCE_URL } from '@/lib/site.ts'
import { isConfigured } from '@/lib/sources/oauth.ts'

export async function Landing({ site, base }: SiteProps) {
  const k = kit(site, base)
  const { t, r, locale, intl } = k
  const { meta } = await getMeta()
  const local = isLocal(site)
  const country = k.conf.country
  // A country site counts its own country.
  const own = country ? meta?.byCountry?.[country] : undefined
  const programmes = local ? (own?.programmes ?? 0) : (meta?.totals.programmes ?? 0)
  const institutions = local ? (own?.institutions ?? 0) : (meta?.totals.institutions ?? 0)
  // Reddit only once this deployment has an approved Reddit app, as on the start page.
  const sources = t.landing.sources.filter((s) => s.id !== 'reddit' || isConfigured('reddit'))

  return (
    <>
      <JsonLd data={homeLd(site, t.landing.faq)} />
      {/* Hero */}
      <section className="dots relative overflow-hidden border-b-2 border-line">
        <Burst className="spin-slow absolute -right-6 top-10 hidden md:block" size={130} color="var(--yellow)" />
        <Ring className="float absolute -left-6 bottom-16 hidden md:block" size={86} color="var(--sky)" style={{ ['--r' as string]: '0deg' }} />
        <Sparkle className="float-slow absolute left-[46%] top-8 hidden lg:block" size={44} color="var(--pink)" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="sticker" style={{ background: 'var(--lime)' }}>
                <span aria-hidden="true">✦</span> {t.landing.badge}
              </p>
              <TrustStickers stored={t.trust.nothingStored} openSource={t.trust.openSource} />
            </div>
            <h1 className="mt-7 font-display text-[2.7rem] sm:text-6xl lg:text-7xl">
              <span className="block text-accent">{t.landing.h1a}</span>
              {t.landing.h1b} <span className="hl">{t.landing.h1c}</span> {t.landing.h1d}
            </h1>
            <Squiggle className="mt-4" size={150} />
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{t.landing.lead(FIELDS.length)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={r.start} className="btn btn-primary btn-lg">
                {t.landing.cta} <span aria-hidden="true">→</span>
              </Link>
              <Link href={r.how} className="btn btn-ghost btn-lg">
                {t.landing.cta2}
              </Link>
            </div>
            {programmes > 0 && (
              <p className="mt-7 inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface px-4 py-1.5 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-good" aria-hidden="true" />
                {t.landing.totals(fmtNumber(programmes, intl), fmtNumber(institutions, intl))}
              </p>
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

      {/* Quiz vs footprint */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {t.landing.cols.map(([title, text], i) => (
            <div key={title} className="card card-pop on-color p-7" style={{ background: ['var(--yellow)', 'var(--pink)', 'var(--sky)'][i], transform: `rotate(${[-1.2, 0.8, -0.6][i]}deg)` }}>
              <div className="font-display text-5xl opacity-30">0{i + 1}</div>
              <h2 className="mt-2 font-display text-3xl">{title}</h2>
              <p className="mt-3 leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl sm:text-5xl">{t.landing.sourcesTitle}</h2>
          <p className="mt-4 text-lg text-muted">{t.landing.sourcesSub}</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s, i) => (
            <div key={s.id} className={`card card-pop flex flex-col overflow-hidden ${i === sources.length - 1 && sources.length % 3 === 1 ? 'sm:col-span-2 lg:col-span-1 lg:col-start-2' : ''}`}>
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
                <span className="chip mt-5 self-start">{s.n}</span>
              </div>
            </div>
          ))}
        </div>
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
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
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
            <div className="absolute -top-8 right-0 rotate-12 sm:-right-5">
              <Burst size={118} color="var(--yellow)" />
              <span className="absolute inset-0 flex flex-col items-center justify-center text-center font-display text-xl leading-none text-on-color">
                <Price site={site} />
              </span>
            </div>
            <h3 className="font-display text-3xl">{t.landing.full}</h3>
            <p className="mt-1 text-sm font-semibold opacity-80">{t.landing.oneTime}</p>
            <ul className="mt-6 grid gap-3">
              {t.landing.fullList.map((x) => (
                <li key={x} className="flex gap-3">
                  <span aria-hidden="true">★</span> {x}
                </li>
              ))}
            </ul>
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
    <div className="relative mx-auto w-full max-w-md">
      <div className="card absolute inset-0 translate-x-4 translate-y-5 rotate-[5deg] bg-pink" aria-hidden="true" />
      <div className="card absolute inset-0 -translate-x-3 translate-y-2 rotate-[-4deg] bg-sky" aria-hidden="true" />
      <div className="card relative rotate-[-1deg] p-6">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span className="chip-soft">{t.landing.example}</span>
          <span>{t.landing.exampleSignals}</span>
        </div>
        <div className="mt-5 flex items-center gap-5">
          <Hexagon profile={[0.92, 0.88, 0.35, 0.12, 0.3, 0.5]} size={124} label={t.misc.profileLabel} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">{t.landing.code}</div>
            <div className="font-display text-5xl">RIC</div>
            <div className="text-sm text-muted">{t.landing.codeSub}</div>
          </div>
        </div>
        <ol className="mt-6 grid gap-3">
          {t.landing.exampleRows.map(([id, score, why], i) => (
            <li key={id} className="rounded-2xl border-2 border-line p-3.5" style={{ background: i === 0 ? 'var(--accent-soft)' : undefined }}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-bold">
                  <span className="text-xl" aria-hidden="true">{emoji(id)}</span>
                  {fieldName(id, locale)}
                </span>
                <span className="on-color rounded-full border-2 border-line bg-lime px-2.5 py-0.5 text-sm font-extrabold">{score}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{why}</p>
            </li>
          ))}
        </ol>
        <div className="on-color mt-4 rounded-2xl border-2 border-dashed border-line bg-yellow p-3.5 text-sm">
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
            <h3 className="mt-3 hyphens-auto break-words font-display text-2xl">{typeLabel(type, country, 'de')}</h3>
            {count(type) > 0 && <p className="mt-1 text-sm font-bold">{t.landing.typesCount(count(type))}</p>}
            <p className="mt-3 text-sm leading-relaxed text-muted">{ADMISSION[country]?.[type]?.de}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
