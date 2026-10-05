import type { Metadata } from 'next'
import { CONTACT } from '@/lib/site.ts'

export const metadata: Metadata = { title: 'Terms', alternates: { canonical: '/terms' } }

export default function Terms() {
  return (
    <div className="prose-wsis mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="font-display text-4xl">Terms</h1>
      <h2>What you get</h2>
      <p>
        whatshouldistudy gives guidance, not a guarantee. Matches are estimates based on the data you provide and on public programme data, which can be
        incomplete or out of date. Check every programme, fee and deadline with the institution before you apply.
      </p>
      <h2>The full report</h2>
      <p>
        A one-time payment unlocks the full programme report in the browser you used to pay, for 12 months, including the weekly data updates during that
        time. If something doesn’t work, contact us within 14 days for a refund.
      </p>
      <h2>Fair use</h2>
      <p>Don’t scrape the programme API or resell its output. The underlying open data remains available from its original publishers under their licences.</p>
      <h2>Data sources</h2>
      <p>
        Programme data: U.S. Department of Education College Scorecard (public domain), Discover Uni dataset (Office for Students, CC BY 4.0), Parcoursup
        open data (Licence Ouverte 2.0), OpenAlex (CC0), University Domains List (MIT).
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </div>
  )
}
