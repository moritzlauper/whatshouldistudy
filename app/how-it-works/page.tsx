import type { Metadata } from 'next'
import Link from 'next/link'
import { getMeta } from '@/lib/server/data.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'How it works',
  description: 'The model behind whatshouldistudy: what we read from each source, how interest is measured, the psychology we use, and where the programme data comes from.',
  alternates: { canonical: '/how-it-works' },
}

export default async function HowItWorks() {
  const { meta, sample } = await getMeta()
  return (
    <div className="prose-wsis mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">How it works</h1>
      <p className="mt-4 text-lg">
        Three steps: read what you consume and make, describe it in terms of {FIELDS.length} fields of study, then combine it with what you tell us about
        yourself. Here is every step, including what it can’t do.
      </p>

      <h2>1. Reading your sources, in your browser</h2>
      <p>
        When you connect YouTube, Spotify or Reddit, you sign in with the service itself and grant read-only access. The access token stays in your
        browser tab; your browser calls the service directly. When you drop a Google Takeout or Spotify export, the file is unpacked on your device. Our
        server is never involved.
      </p>
      <ul>
        <li>
          <strong>YouTube:</strong> subscriptions (with the date you subscribed), liked videos (with the date you liked them, plus tags, category and
          topic), your playlists and uploads, and the description and keywords of every channel behind them.
        </li>
        <li>
          <strong>Google Takeout:</strong> your full watch history and search history, comments and subscriptions. YouTube doesn’t offer watch history
          through its API, so this is the way to get it, often years of it.
        </li>
        <li>
          <strong>Spotify:</strong> saved podcasts and episodes, audiobooks, playlists, and your top and followed artists with their genres.
        </li>
        <li>
          <strong>Reddit:</strong> the communities you joined, saved and upvoted posts, your own posts and comments (adult communities are skipped).
        </li>
        <li>
          <strong>GitHub:</strong> your public repositories and stars: names, descriptions, topics and languages.
        </li>
      </ul>

      <h2>2. From items to fields</h2>
      <p>
        Every item (a video, a channel, a podcast, a subreddit, a repository, a search) runs through a multilingual lexicon of several thousand terms in
        English, German, French, Spanish and Italian, including the names of channels and creators closely tied to a subject. The result is how strongly
        the item is about each field. A few rules make this robust:
      </p>
      <ul>
        <li>
          <strong>Channel context:</strong> a video inherits half of its channel’s profile, so a physics channel’s vaguely titled videos still count
          towards physics.
        </li>
        <li>
          <strong>Diminishing returns:</strong> within one channel and month, <code>n</code> videos weigh like <code>log₂(1+n)</code>. A weekend binge
          doesn’t outweigh years of steady interest.
        </li>
        <li>
          <strong>Learning vs. entertainment:</strong> lectures, explainers and the Education category count up to 1.3×; let’s-plays, reactions and
          compilations down to 0.7×. Music listening is used for taste only, never as interest in studying music.
        </li>
        <li>
          <strong>Deliberate choices count more:</strong> a subscription weighs 10× a single view, your own uploads and repositories even more.
        </li>
      </ul>

      <h2>3. Measuring interest fairly</h2>
      <p>
        Raw counts would make everyone a sports scientist: fitness and cooking are simply everywhere. So for each field we compare your share of content
        with how common that content is in general, as a log-lift:
      </p>
      <p>
        <code>lift = ln((your share + ε) / (baseline share + ε))</code>
      </p>
      <p>
        Then we shrink it towards zero when only a few items support it (<code>n / (n + 4)</code>), reward fields that show up across many months
        (persistence), and combine sources weighted by reliability and volume. A field that shows up strongly in two independent sources gets a bonus:
        your Reddit and your YouTube agreeing is better evidence than either alone.
      </p>

      <h2>4. The psychology</h2>
      <ul>
        <li>
          <strong>Interests (RIASEC):</strong> John Holland’s six interest types (Realistic, Investigative, Artistic, Social, Enterprising,
          Conventional) underpin most career guidance. Every field has a RIASEC profile; yours comes from 18 activity questions and from the fields you
          engage with. Congruence between the two is one of the best-replicated predictors of satisfaction and persistence in a major.
        </li>
        <li>
          <strong>Personality (Big Five):</strong> the Mini-IPIP (Donnellan et al., 2006), a validated 20-item public-domain scale. Personality explains
          less about major choice than interests do, so it gets a small weight. Without the questionnaire, music taste gives a weak estimate, clearly
          labelled as such.
        </li>
        <li>
          <strong>School subjects and values:</strong> what you enjoy and are good at, and what you want from work (salary, security, creativity,
          helping, impact…), compared with what each field draws on and offers. For salary, US graduate earnings data is mixed in.
        </li>
      </ul>
      <p>
        The final match blends these components. Weights adapt: with lots of footprint data, interest leads; with little, the questionnaire carries more.
        Scores are relative: 90+ means a field stands out for you among all {FIELDS.length}, not that success is guaranteed.
      </p>

      <h2>Limits, honestly</h2>
      <ul>
        <li>Your footprint shows curiosity and attention, not ability or grades. That’s why the questionnaire asks about subjects.</li>
        <li>Shared accounts, autoplay and phases add noise. Persistence weighting and diminishing returns reduce it; they don’t remove it.</li>
        <li>Content in languages other than the five above is only partly understood.</li>
        <li>This is a starting point for exploring, not a verdict. Talk to students in the field, look at curricula, try an intro course.</li>
      </ul>

      <h2 id="data">Programme data</h2>
      <p>
        Programmes come from official open data, refreshed every week by an automated pipeline.{' '}
        {sample ? 'This deployment currently shows a small demo dataset.' : meta ? `Last refresh: ${new Date(meta.updated).toUTCString()}.` : ''}
      </p>
      <ul>
        {(meta?.sources ?? []).map((s) => (
          <li key={s.id}>
            <a href={s.url}>{s.name}</a> ({s.licence}): {s.count.toLocaleString('en')} {s.id.startsWith('global') ? 'institutions' : 'programmes'}
            {!s.ok && s.error ? ` (last refresh failed; ${s.error})` : ''}
          </li>
        ))}
      </ul>
      <p>
        Fees shown are the published statutory or institutional fee for your citizenship where available, otherwise marked as approximate. Always check
        the programme page before applying.
      </p>

      <p className="mt-10">
        <Link href="/start">Try it →</Link>
      </p>
    </div>
  )
}
