'use client'

import { formatPrice, priceForSite } from '@/lib/pricing.ts'
import { reportOfferText } from '@/lib/site/report-offer.ts'
import { SALES_PAUSED } from '@/lib/site/config.ts'
import { useConfig } from './price.tsx'
import { useSite } from './site-context.tsx'

/** Explains the paid analysis before the free result's sharing and settings. */
export function ReportOffer() {
  const { site, locale, intl, r, t } = useSite()
  const config = useConfig(site)
  const offer = reportOfferText(locale)
  return <section className="card mt-7 bg-accent p-6 text-accent-ink sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <h2 className="max-w-2xl font-display text-3xl sm:text-4xl">{offer.title}</h2>
      {!SALES_PAUSED[site] && <span className="chip on-color bg-lime">{offer.price(formatPrice(config?.price ?? priceForSite(site), intl))}</span>}
    </div>
    <p className="mt-3 max-w-3xl opacity-90">{offer.intro}</p>
    <ol className="mt-6 grid gap-3 md:grid-cols-3">
      {offer.features.map((feature, i) => <li key={feature.title} className="rounded-2xl border-2 border-current/20 p-4">
        <span className="font-display text-2xl" aria-hidden="true">0{i + 1}</span>
        <h3 className="mt-2 font-bold">{feature.title}</h3>
        <p className="mt-2 text-sm opacity-90">{feature.text}</p>
      </li>)}
    </ol>
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <a href={`#${r.anchors.unlock}`} className="btn btn-lime max-w-full whitespace-normal text-center">{offer.cta}</a>
      <p className="max-w-xl text-xs opacity-85">{offer.consent}</p>
    </div>
    {t.reportScope && <p className="mt-4 text-sm">{t.reportScope}</p>}
  </section>
}
