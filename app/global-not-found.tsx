import type { Metadata } from 'next'
import { bricolage } from './ui/fonts.ts'
import { Burst } from './ui/shapes.tsx'
import './globals.css'

export const metadata: Metadata = { title: '404', robots: { index: false } }

/** Shared by both sites, so it speaks both languages. */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={bricolage.variable}>
      <body className="dots flex min-h-dvh items-center justify-center px-4">
        <div className="card max-w-md p-10 text-center">
          <Burst className="spin-slow mx-auto" size={90} color="var(--yellow)" />
          <h1 className="mt-6 font-display text-6xl">404</h1>
          <p className="mt-3 text-lg">This page doesn’t exist.</p>
          <p className="text-muted">Diese Seite gibt es nicht.</p>
          <div className="mt-7 flex justify-center gap-3">
            <a href="/" className="btn btn-primary btn-sm">
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
