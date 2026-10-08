import type { Metadata, Viewport } from 'next'
import { SITE_URL } from '@/lib/site.ts'
import { CH_FR_IT_URL, isChFrIt, siteConf } from '@/lib/site/config.ts'
import { dict } from '@/lib/site/dict.ts'
import { ALL_MOUNTS, mountInfo } from '@/lib/site/kit.ts'
import { ICONS, ogImage, pageUrl } from '@/lib/site/meta.ts'
import { bricolage } from '../../ui/fonts.ts'
import { Shell } from '../../ui/shell.tsx'
import '../../globals.css'

/**
 * The country sites (Switzerland, Germany, Austria). Each is mounted twice:
 * /schweiz etc. on the global domain, and an internal path that proxy.ts
 * rewrites the country's own domain to, so links work on both. The Swiss
 * site's French and Italian versions are the mounts fr and it.
 */
export function generateStaticParams() {
  return ALL_MOUNTS.map((mount) => ({ mount }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ mount: string }> }): Promise<Metadata> {
  const { site, locale } = mountInfo((await params).mount)
  const c = siteConf(site, locale)
  const t = dict(locale)
  return {
    metadataBase: new URL((isChFrIt(locale) && CH_FR_IT_URL) || c.domainUrl || SITE_URL),
    title: { default: t.meta.title, template: `%s · ${c.name}` },
    description: t.meta.description,
    applicationName: c.name,
    keywords: t.meta.keywords,
    icons: ICONS,
    openGraph: { type: 'website', siteName: c.name, title: t.meta.title, description: t.meta.description, url: pageUrl(site, (r) => r.home, locale), locale: locale.replace('-', '_'), images: [ogImage(site)] },
    twitter: { card: 'summary_large_image', title: t.meta.title, description: t.meta.description, images: [ogImage(site).url] },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff6e9' },
    { media: '(prefers-color-scheme: dark)', color: '#130c28' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function CountryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ mount: string }> }) {
  const { site, base, locale } = mountInfo((await params).mount)
  return (
    <html lang={locale} data-site={site} className={bricolage.variable}>
      <body className="flex min-h-dvh flex-col">
        <Shell site={site} base={base} locale={locale}>
          {children}
        </Shell>
      </body>
    </html>
  )
}
