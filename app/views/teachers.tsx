import Link from 'next/link'
import { formatPrice, priceFor } from '@/lib/pricing.ts'
import { kit } from '@/lib/site/kit.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { pageUrl } from '@/lib/site/meta.ts'
import { schoolLink, teachersText } from '@/lib/site/teachers-text.ts'
import { CopyField, CopyRow } from '../ui/copy-field.tsx'
import { PrintButton } from '../ui/print-button.tsx'
import { Sparkle } from '../ui/shapes.tsx'

/** Writing lines per worksheet question. */
const LINES = [3, 3, 3, 3, 2]

/** A free lesson on choosing a degree, its worksheet and the link for school websites. */
export function TeachersView({ site, base, locale: lang }: SiteProps) {
  const { t, r, locale, intl, conf } = kit(site, base, lang)
  const tt = teachersText(locale)
  const start = pageUrl(site, (x) => x.start, locale).replace(/^https?:\/\//, '')
  const price = formatPrice(priceFor(conf.country, conf.currency), intl)
  const link = schoolLink(tt, conf.name, pageUrl(site, (x) => x.home, locale))
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="relative max-w-3xl">
          <Sparkle className="float-slow absolute -right-10 -top-4 hidden sm:block" size={56} color="var(--lime)" />
          <span className="chip on-color bg-lime">{tt.free}</span>
          <h1 className="mt-4 font-display text-5xl sm:text-6xl">{tt.title}</h1>
          <p className="mt-5 text-xl text-muted">{tt.lead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#worksheet" className="btn btn-primary btn-lg">
              {tt.sheetTitle}
            </a>
            <Link href={r.start} className="btn btn-ghost btn-lg">
              {t.nav.start} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-4xl sm:text-5xl">{tt.flowTitle}</h2>
        <ol className="mt-8 grid gap-4">
          {tt.flow(start).map((step) => (
            <li key={step.title} className="card-sm flex flex-col gap-3 p-6 sm:flex-row sm:gap-6">
              <span className="chip on-color shrink-0 self-start bg-yellow">{tt.minutes(step.min)}</span>
              <div>
                <h3 className="font-display text-2xl">{step.title}</h3>
                <p className="mt-2 leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h2 className="font-display text-3xl">{tt.notesTitle}</h2>
        <ul className="mt-5 grid gap-3 leading-relaxed">
          {tt.notes(price).map((n) => (
            <li key={n} className="flex gap-3">
              <span aria-hidden="true">✓</span> {n}
            </li>
          ))}
        </ul>
      </section>

      <section id="worksheet" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-4xl sm:text-5xl">{tt.sheetTitle}</h2>
          <PrintButton label={tt.print} />
        </div>
        <p className="mt-2 text-muted print:hidden">{tt.sheetLead}</p>
        <div className="sheet card mt-8 p-6 sm:p-10">
          <h3 className="font-display text-3xl">{tt.sheet.heading}</h3>
          <div className="mt-6 grid grid-cols-2 gap-6 text-sm font-semibold">
            <p className="border-b-2 border-line pb-1">{tt.sheet.name}</p>
            <p className="border-b-2 border-line pb-1">{tt.sheet.date}</p>
          </div>
          <ol className="mt-8 grid gap-7">
            {tt.sheet.questions.map((q, i) => (
              <li key={q} className="break-inside-avoid">
                <p className="font-semibold">
                  {i + 1}. {q}
                </p>
                {Array.from({ length: LINES[i] ?? 2 }, (_, n) => (
                  <div key={n} className="h-8 border-b border-line/40" />
                ))}
              </li>
            ))}
          </ol>
          <p className="mt-8 text-xs text-muted">{start}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <CopyField label={tt.linkTitle} hint={tt.linkLead}>
          <CopyRow label={tt.textLabel} value={link.text} copy={tt.copy} copied={tt.copied} />
          <CopyRow label={tt.htmlLabel} value={link.html} copy={tt.copy} copied={tt.copied} />
        </CopyField>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="card bg-accent p-7 text-accent-ink">
          <h2 className="font-display text-3xl">{tt.pilotTitle}</h2>
          <p className="mt-3 leading-relaxed opacity-90">{tt.pilotText}</p>
          <Link href={r.orgs} className="btn btn-lime btn-lg mt-6">
            {tt.pilotCta} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </>
  )
}
