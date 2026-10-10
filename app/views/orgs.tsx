import Link from 'next/link'
import { CONTACT } from '@/lib/site.ts'
import { kit } from '@/lib/site/kit.ts'
import { SALES_PAUSED } from '@/lib/site/config.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { OrgPlans } from '../ui/org-plans.tsx'
import { Sparkle } from '../ui/shapes.tsx'

/** Plans for schools and counselling services. */
export function OrgsView({ site, base, locale: lang }: SiteProps) {
  const { locale, r } = kit(site, base, lang)
  const o = orgsText(locale)
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="relative max-w-3xl">
          <Sparkle className="float-slow absolute -right-10 -top-4 hidden sm:block" size={56} color="var(--pink)" />
          <h1 className="font-display text-5xl sm:text-6xl">{o.title}</h1>
          <p className="mt-5 text-xl text-muted">{o.lead}</p>
          <p className="mt-4 font-semibold">
            {o.teachers.teaser}{' '}
            <Link href={r.teachers} className="text-accent underline-offset-2 hover:underline">
              {`${o.teachers.link}\u00a0→`}
            </Link>
          </p>
        </div>
        <div className="mt-10">
          <OrgPlans />
        </div>
      </section>

      {/* Where the plans are not on sale, how to buy one and its FAQ go too. */}
      {!SALES_PAUSED[site] && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-4xl sm:text-5xl">{o.stepsTitle}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {o.steps.map((step, i) => (
              <li key={step} className="card-sm p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-yellow font-display text-xl text-on-color">{i + 1}</span>
                <p className="mt-4 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {!SALES_PAUSED[site] && (
          <>
            <h2 className="font-display text-4xl sm:text-5xl">{o.faqTitle}</h2>
            <div className="mt-8 grid gap-4">
              {o.faq.map(([q, a]) => (
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
          </>
        )}
        <p className="mt-10 text-muted">
          {o.contact}{' '}
          <a href={`mailto:${CONTACT}`} className="font-bold text-accent underline-offset-2 hover:underline">
            {CONTACT}
          </a>
          .
        </p>
      </section>
    </>
  )
}
