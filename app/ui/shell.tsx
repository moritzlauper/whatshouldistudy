import Link from 'next/link'
import { kit } from '@/lib/site/kit.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { SITE_URL } from '@/lib/site.ts'
import { Logo, Wordmark } from './logo.tsx'
import { SiteProvider } from './site-context.tsx'
import { Sparkle, SwissFlag } from './shapes.tsx'

/** Header, footer and the client context around every page of a site. */
export function Shell({ site, base, children }: SiteProps & { children: React.ReactNode }) {
  const { t, r, conf } = kit(site, base)
  // The other site: the Swiss domain (or /schweiz) from the global one, and back.
  const chUrl = process.env.NEXT_PUBLIC_CH_URL?.replace(/\/$/, '') || '/schweiz'
  const sister = site === 'global' ? chUrl : base ? '/' : SITE_URL
  return (
    <SiteProvider site={site} base={base}>
      <header className="sticky top-0 z-30 border-b-2 border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={r.home} className="flex items-center gap-2" aria-label={t.misc.home(conf.name)}>
            <Logo site={site} />
            <Wordmark parts={conf.wordmark} />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
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
            <a href={sister} className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-bg/30 px-4 py-2 font-semibold hover:border-bg">
              {site === 'global' ? <SwissFlag size={20} /> : <span aria-hidden="true">🌍</span>}
              {t.footer.sister}
            </a>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href={r.how} className="opacity-80 hover:opacity-100">{t.nav.how}</Link>
            <Link href={r.fields} className="opacity-80 hover:opacity-100">{t.footer.allFields}</Link>
            <Link href={`${r.how}#${r.anchors.data}`} className="opacity-80 hover:opacity-100">{t.footer.sources}</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href={r.privacy} className="opacity-80 hover:opacity-100">{t.footer.privacy}</Link>
            <Link href={r.terms} className="opacity-80 hover:opacity-100">{t.footer.terms}</Link>
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
