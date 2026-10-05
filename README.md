# whatshouldistudy

Find what to study from what you actually watch, read and build. The site reads
thousands of signals from a person's YouTube, Google Takeout, Spotify, Reddit and
GitHub, adds a short validated questionnaire (RIASEC interests, Mini-IPIP Big
Five, school subjects, values), matches them to 80 fields of study and then to
real programmes in the US, UK, France and, through research profiles and a
university directory, 60+ more countries.

The field results are free. The full programme list (every matching programme
with the fee for the student's citizenship, earnings, admission rates, filters,
CSV) is a one-time payment.

**Privacy model:** the analysis runs entirely in the browser. OAuth tokens stay
in the tab, exports are unpacked on the device, raw history is discarded after
analysis. The server only ever receives field ids, scores and filters.

> This project lives in the `angebunden` repository for now and is meant to move
> to its own repository. It is fully self-contained: own `package.json`,
> lockfile and `pnpm-workspace.yaml`. Only the two workflows sit in the
> repository's `.github/workflows/` (`wsis-daten.yml`, `wsis-pruefen.yml`).
> Move them along and drop the `working-directory` lines.

## Run it

```sh
cd whatshouldistudy
pnpm install
pnpm dev            # http://localhost:3000, demo data, free unlock
pnpm test           # matcher, connectors, scrapers (on fixtures)
pnpm typecheck
pnpm build
```

Without any configuration you get the questionnaire, file exports (Takeout,
Spotify), GitHub, the demo dataset in `data/sample` and free unlocks in
development. `.env.example` lists everything else.

## How the matching works

`lib/engine/` (documented in detail on `/how-it-works`):

1. **Connectors** (`lib/sources/`) turn each source into `SignalItem`s: a
   subscription, a liked video, a watched video, a search, a podcast, a
   subreddit, a repository. Each has a base weight (a subscription 3, a view
   0.3, your own repo 3–5) and, where known, a time.
2. **Classifier** (`classifier.ts`): a compiled multilingual lexicon
   (`lib/taxonomy/lexicon.ts`, ~6,400 terms in EN/DE/FR/ES/IT including creator
   and channel names) scores every item against every field; 100,000 titles take
   under a second. Separate term lists detect learning vs. entertainment.
3. **Accumulator** (`accumulate.ts`): channel context (an item inherits half its
   channel's profile), diminishing returns per channel and month (`log₂(1+n)`),
   learning weighting (0.7×–1.3×), music kept apart. Output is a small
   `SourceSummary` per source, the only thing stored (localStorage).
4. **Scoring** (`scoring.ts`): per field, the log-lift of your share against a
   popularity baseline, shrunk by evidence (`n/(n+4)`), weighted by persistence
   across months, fused over sources by reliability and volume, with a bonus for
   cross-source agreement. Combined with RIASEC congruence, Big Five tilts,
   subject fit and value fit; weights adapt to what data exists. Also produces
   hidden matches, insights and a yearly interest timeline.

The taxonomy (`lib/taxonomy/fields.ts`) gives every field a RIASEC profile, Big
Five tilts, subject demands, what it offers, careers, and codes for the data
sources (CIP for the US, CAH for the UK, ISCED-F, OpenAlex subfields).

## Data sources and their setup

| Source | What | Setup |
| --- | --- | --- |
| YouTube Data API | subscriptions, likes, playlists, uploads, channel details | Google Cloud project, enable *YouTube Data API v3*, OAuth client (web), consent screen with scope `youtube.readonly`. Until Google verifies the app (sensitive scope, a few weeks, needs the privacy page and a demo video), only listed test users can sign in. Default quota is 10,000 units/day ≈ 50–60 full scans; request more via the quota form. |
| Google Takeout | full watch + search history, comments, subscriptions | none, the user uploads the export |
| Spotify Web API | podcasts, episodes, audiobooks, artists/genres | app on developer.spotify.com. Development mode allows 25 allow-listed users; public use needs Spotify's extended quota approval, which Spotify currently grants mainly to organisations. The Spotify data export works for everyone. |
| Reddit API | communities, saved, upvoted, own posts | app of type *installed app* on reddit.com/prefs/apps |
| GitHub | public repos and stars | none (public API, 60 requests/hour per visitor IP) |

Further sources worth adding later (account access exists): Google "My Activity"
search history is already read from Takeout; Goodreads and Letterboxd CSV
exports (books and films); Steam (owned games and playtime via Steam Web API);
TikTok and Instagram data downloads (topics/interests files); Strava (sports).

## Programme database

`scrapers/` with a weekly GitHub Action (`.github/workflows/wsis-daten.yml`):

| Scraper | Coverage | Licence |
| --- | --- | --- |
| `us-scorecard.ts` | every US college: programmes by CIP and level, in-/out-of-state tuition, median earnings and debt per programme, admission rate | public domain |
| `uk-discoveruni.ts` | every UK undergraduate course (Discover Uni), with award, mode, URL, subject | CC BY 4.0 |
| `fr-parcoursup.ts` | every French first-year programme on Parcoursup, statutory fees, capacity, admission rate | Licence Ouverte 2.0 |
| `global-openalex.ts` | research profiles of universities in ~65 countries → strongest universities per field and country | CC0 |
| `global-directory.ts` | ~10,000 universities worldwide with websites | MIT |

`build.ts` merges everything into `programmes/<field>.json`,
`research/<field>.json`, `directory/<CC>.json`, `meta.json` and `stats.json`,
keeps the date each programme was first seen (so new programmes are flagged),
and keeps last week's data for any source that failed. The result is
force-pushed as a single commit to the branch `whatshouldistudy-data`; the site
reads it from `raw.githubusercontent.com` (configurable with `WSIS_DATA_URL`).
Runs on other branches only upload the result as an artifact.

Secrets for the workflow: `SCORECARD_API_KEY` (free at api.data.gov/signup,
strongly recommended), optionally `OPENALEX_API_KEY` and `OPENALEX_EMAIL`.

The scrapers read column names defensively and log the columns they find, so
when a publisher renames something the run log shows it. `pnpm data:all` runs
everything locally; `pnpm data:sample` rebuilds the demo dataset from
`scrapers/fixtures` (CI checks it is up to date).

Next countries with official open data to add: Netherlands (Studiekeuzedatabase,
licence on request), Germany (Hochschulkompass, export on request from HRK),
Switzerland, Italy (Universitaly), Spain (QEDU), Australia (QILT), Canada.

## Paywall

`/api/checkout` creates a Stripe Checkout session (plain REST, no SDK);
`/unlocked` exchanges the paid session for an HMAC-signed token
(`lib/server/token.ts`, valid 12 months) stored in the browser; `/api/programmes`
and `/api/research` require it. No database. Free tier: `/api/teaser` (counts
plus the top 3 programmes).

## Deploy on Vercel

New Vercel project from this repository with **Root Directory**
`whatshouldistudy`. Set the variables from `.env.example`. With the system
environment variables exposed (Vercel default), the data branch is found
automatically, also after moving the repository.

## Next: whatshouldiwork

The same engine works for careers: fields already carry careers, RIASEC and
values; occupations would come from O*NET (US, public domain) and ESCO (EU),
salaries from BLS / Eurostat.
