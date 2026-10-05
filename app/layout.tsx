import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from '@/lib/site.ts'
import { Logo } from './components/logo.tsx'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'what should I study',
    'which degree is right for me',
    'college major quiz',
    'study programme finder',
    'university course finder',
    'career test',
    'RIASEC',
    'Big Five',
    'study abroad',
  ],
  openGraph: { type: 'website', siteName: SITE_NAME, title: `${SITE_NAME}: ${TAGLINE}`, description: DESCRIPTION, url: '/' },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: DESCRIPTION },
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0e13' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label={`${SITE_NAME} home`}>
              <Logo />
              <span className="hidden sm:inline">
                whatshouldi<span className="text-accent">study</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/how-it-works" className="rounded-lg px-3 py-2 text-muted hover:text-ink">
                How it works
              </Link>
              <Link href="/fields" className="rounded-lg px-3 py-2 text-muted hover:text-ink">
                Fields
              </Link>
              <Link href="/start" className="ml-1 rounded-full bg-ink px-4 py-2 font-medium text-bg hover:opacity-90">
                Start
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-24 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:grid-cols-3 sm:px-6">
            <div>
              <div className="flex items-center gap-2 font-semibold text-ink">
                <Logo /> whatshouldistudy
              </div>
              <p className="mt-3 max-w-xs">Your digital footprint plus a short, validated questionnaire, matched to fields of study and real programmes.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
              <Link href="/fields" className="hover:text-ink">All fields of study</Link>
              <Link href="/how-it-works#data" className="hover:text-ink">Programme data sources</Link>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/privacy" className="hover:text-ink">Privacy</Link>
              <Link href="/terms" className="hover:text-ink">Terms</Link>
              <span>Analysis runs in your browser. We never see your history.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
