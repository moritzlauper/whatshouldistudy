import type { Metadata } from 'next'
import { CONTACT } from '@/lib/site.ts'

export const metadata: Metadata = { title: 'Privacy', alternates: { canonical: '/privacy' } }

export default function Privacy() {
  return (
    <div className="prose-wsis mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="font-display text-4xl">Privacy</h1>
      <p className="mt-4 text-lg">Short version: your history never reaches us. The analysis runs in your browser, and what it keeps stays there.</p>

      <h2>What happens to your data</h2>
      <ul>
        <li>
          <strong>Connected accounts (YouTube, Spotify, Reddit):</strong> you sign in with the service. It gives your browser a read-only access token,
          stored in this tab’s session storage only and gone when you close it. Your browser fetches your data directly from the service. We never receive
          the token or the data.
        </li>
        <li>
          <strong>Exports (Google Takeout, Spotify):</strong> files you drop are read and unpacked on your device. They are not uploaded.
        </li>
        <li>
          <strong>What is kept:</strong> a summary per source (how much of your content relates to each field, a few example titles as evidence, counts),
          your questionnaire answers and preferences. These are stored in your browser’s local storage, on your device only. “Delete all my data” on the
          start page removes them.
        </li>
        <li>
          <strong>What we receive:</strong> to look up programmes, your browser sends us the ids and scores of your top fields and your filters (level,
          countries, budget, citizenship category). Nothing that identifies you, and nothing from your history.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe. We receive whether a checkout session was paid, not your card details. Stripe’s privacy policy
          applies to the payment.
        </li>
      </ul>

      <h2>Google user data</h2>
      <p>
        whatshouldistudy’s use and transfer of information received from Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use
        requirements. We request the read-only scope <code>youtube.readonly</code> to read your subscriptions, liked videos, playlists and uploads, and
        use it only to compute your field-of-study profile in your browser. The data is not transferred to us or to third parties, not used for
        advertising, and not used to train AI models. You can revoke access at any time at{' '}
        <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
      </p>

      <h2>Cookies and analytics</h2>
      <p>We set no tracking cookies. Browser storage is used only for the data described above.</p>

      <h2>Your rights</h2>
      <p>
        Because we don’t hold personal data about your use of the analysis, there is nothing for us to export or delete: you control it in your browser.
        For payment records, contact us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </div>
  )
}
