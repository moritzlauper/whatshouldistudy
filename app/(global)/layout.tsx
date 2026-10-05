import type { Metadata, Viewport } from 'next'
import { SITE_NAME, SITE_URL } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { bricolage } from '../ui/fonts.ts'
import { Shell } from '../ui/shell.tsx'
import '../globals.css'

const t = dict('en')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: t.meta.title, template: `%s · ${SITE_NAME}` },
  description: t.meta.description,
  applicationName: SITE_NAME,
  keywords: t.meta.keywords,
  icons: { icon: '/icon.svg' },
  openGraph: { type: 'website', siteName: SITE_NAME, title: t.meta.title, description: t.meta.description, url: '/', locale: 'en' },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: t.meta.description },
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff6e9' },
    { media: '(prefers-color-scheme: dark)', color: '#130c28' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-site="global" className={bricolage.variable}>
      <body className="flex min-h-dvh flex-col">
        <Shell site="global" base="">
          {children}
        </Shell>
      </body>
    </html>
  )
}
