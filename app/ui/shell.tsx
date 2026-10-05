import Link from 'next/link'
import { kit, siteHref } from '@/lib/site/kit.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId, SiteProps } from '@/lib/site/config.ts'
import { Logo, Wordmark } from './logo.tsx'
import { SiteProvider } from './site-context.tsx'
import { SiteFlag, Sparkle } from './shapes.tsx'

const ALL: SiteId[] = ['global', 'ch', 'de', 'at']

/** Header, footer and the client context around every page of a site. */
export function Shell({ site, base, children }: SiteProps & { children: React.ReactNode }) {
  const k = kit(site, base)
  const { t, r, conf } = k
  return (
    <SiteProvider site={site} base={base}>
      <header className="sticky top-0 z-30 border-b-2 border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={r.home} className="flex min-w-0 items-center gap-2" aria-label={t.misc.home(conf.name)}>
            <Logo site={site} />
            <span className="truncate">
              <Wordmark parts={conf.wordmark} />
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm font-semibold sm:gap-2">
            <Link href={r.how} className="hidden rounded-full px-3 py-2 hover:bg-surface-2 sm:inline-block">
              {t.nav.how}
            </Link>
            <Link href={r.fields} className="rounded-full px-3 py-2 hover:bg-surface-2">
              {t.nav.fields}
            </Link>
            <Link href={r.start} className="btn btn-primary btn-sm ml-1">
              {t.nav.start}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="relative mt-28 overflow-hidden border-t-2 border-line bg-ink text-bg">
        <Sparkle className="float-slow absolute -right-4 top-6 opacity-90" size={90} color="var(--lime)" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 text-sm sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Logo site={site} />
              <span className="font-display text-xl">{conf.name}</span>
            </div>
            <p className="mt-4 max-w-xs opacity-75">{t.footer.about}</p>
            <p className="mt-6 text-xs font-bold uppercase tracking-wider opacity-60">{t.footer.otherSites}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL.filter((s) => s !== site).map((s) => (
                <Link key={s} href={siteHref(k, s)} className="inline-flex items-center gap-2 rounded-full border-2 border-bg/30 px-3 py-1.5 font-semibold hover:border-bg">
                  <SiteFlag site={s} size={18} />
                  {t.footer.siteNames[s] ?? SITES[s].name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href={r.how} className="opacity-80 hover:opacity-100">{t.nav.how}</Link>
            <Link href={r.fields} className="opacity-80 hover:opacity-100">{t.footer.allFields}</Link>
            <Link href={`${r.how}#${r.anchors.data}`} className="opacity-80 hover:opacity-100">{t.footer.sources}</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href={r.privacy} className="opacity-80 hover:opacity-100">{t.footer.privacy}</Link>
            <Link href={r.terms} className="opacity-80 hover:opacity-100">{t.footer.terms}</Link>
            <Link href={r.imprint} className="opacity-80 hover:opacity-100">{t.footer.imprint}</Link>
            <span className="opacity-60">{t.footer.local}</span>
          </div>
        </div>
        <div className="border-t border-bg/15">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs opacity-60 sm:px-6">
            <span>{t.misc.dataCredit}</span>
            <span>{t.misc.madeIn}</span>
          </div>
        </div>
      </footer>
    </SiteProvider>
  )
}
