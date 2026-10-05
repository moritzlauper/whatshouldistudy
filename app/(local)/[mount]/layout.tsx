import type { Metadata, Viewport } from 'next'
import { CH_URL, SITE_URL, chUrl } from '@/lib/site.ts'
import { CH_NAME } from '@/lib/site/config.ts'
import { dict } from '@/lib/site/dict.ts'
import { CH_MOUNTS, chBase } from '@/lib/site/kit.ts'
import { bricolage } from '../../ui/fonts.ts'
import { Shell } from '../../ui/shell.tsx'
import '../../globals.css'

/**
 * The Swiss site. Mounted at /schweiz on the global domain, and at an internal
 * path that proxy.ts rewrites the Swiss domain to, so links work on both.
 */
export function generateStaticParams() {
  return [{ mount: CH_MOUNTS.public }, { mount: CH_MOUNTS.domain }]
}
export const dynamicParams = false

const t = dict('de')

export const metadata: Metadata = {
  metadataBase: new URL(CH_URL || SITE_URL),
  title: { default: t.meta.title, template: `%s · ${CH_NAME}` },
  description: t.meta.description,
  applicationName: CH_NAME,
  keywords: t.meta.keywords,
  icons: { icon: '/icon-ch.svg' },
  openGraph: { type: 'website', siteName: CH_NAME, title: t.meta.title, description: t.meta.description, url: chUrl(), locale: 'de_CH' },
  twitter: { card: 'summary_large_image', title: CH_NAME, description: t.meta.description },
  alternates: { canonical: chUrl() },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff6e9' },
    { media: '(prefers-color-scheme: dark)', color: '#130c28' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function SwissLayout({ children, params }: { children: React.ReactNode; params: Promise<{ mount: string }> }) {
  const { mount } = await params
  return (
    <html lang="de-CH" data-site="ch" className={bricolage.variable}>
      <body className="flex min-h-dvh flex-col">
        <Shell site="ch" base={chBase(mount)}>
          {children}
        </Shell>
      </body>
    </html>
  )
}
