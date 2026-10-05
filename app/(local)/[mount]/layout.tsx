import type { Metadata, Viewport } from 'next'
import { SITE_URL, siteUrl, withBase } from '@/lib/site.ts'
import { SITES } from '@/lib/site/config.ts'
import { dict } from '@/lib/site/dict.ts'
import { ALL_MOUNTS, mountInfo } from '@/lib/site/kit.ts'
import { bricolage } from '../../ui/fonts.ts'
import { Shell } from '../../ui/shell.tsx'
import '../../globals.css'

/**
 * The country sites (Switzerland, Germany, Austria). Each is mounted twice:
 * /schweiz etc. on the global domain, and an internal path that proxy.ts
 * rewrites the country's own domain to, so links work on both.
 */
export function generateStaticParams() {
  return ALL_MOUNTS.map((mount) => ({ mount }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ mount: string }> }): Promise<Metadata> {
  const { site } = mountInfo((await params).mount)
  const c = SITES[site]
  const t = dict(c.locale)
  return {
    metadataBase: new URL(c.domainUrl || SITE_URL),
    title: { default: t.meta.title, template: `%s · ${c.name}` },
    description: t.meta.description,
    applicationName: c.name,
    keywords: t.meta.keywords,
    icons: { icon: withBase(`/icon-${site}.svg`) },
    openGraph: { type: 'website', siteName: c.name, title: t.meta.title, description: t.meta.description, url: siteUrl(site), locale: c.ogLocale },
    twitter: { card: 'summary_large_image', title: c.name, description: t.meta.description },
    alternates: { canonical: siteUrl(site) },
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
  const { site, base } = mountInfo((await params).mount)
  return (
    <html lang={SITES[site].intl} data-site={site} className={bricolage.variable}>
      <body className="flex min-h-dvh flex-col">
        <Shell site={site} base={base}>
          {children}
        </Shell>
      </body>
    </html>
  )
}
