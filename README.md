# whatshouldistudy

Find what to study from what you actually watch, read and build. The site reads
thousands of signals from a person's YouTube, Google Takeout, Spotify, Reddit and
GitHub, adds a short validated questionnaire (RIASEC interests, Mini-IPIP Big
Five, school subjects, values), matches them to 80 fields of study and then to
real programmes in Switzerland, Germany, Austria, the US, the UK, France and,
through research profiles and a university directory, 60+ more countries.

Four sites from one codebase: the global English site and three German-language
country sites: `wasstudieren` for Switzerland (wasstudieren.ch), `findemeinstudium`
for Germany (findemeinstudium.de) and `wasstudieren` for Austria (wasstudieren.at).
The Swiss site's French and Italian versions are called `whatshouldistudy` and
live at whatshouldistudy.ch/fr and /it. Each country site lists the degree
programmes of its own universities and universities of applied sciences and
leads with them. Without a domain set they
live at `/schweiz`, `/deutschland` and `/oesterreich`.

The app serves at the domain root. `WSIS_BASE_PATH` mounts it under a path
instead (see *Deploy on Vercel*). The Swiss site also speaks French (`/fr`) and
Italian (`/it`) on its own domain; a switch in its header leads to the same page
in German, French, Italian or, on the global site, English.

The field results are free. The full programme list (every matching programme
with the fee for the student's citizenship, earnings, admission rates, filters,
CSV) is a one-time payment.

**Free programme catalogue for search engines.** Every programme can be found
for free: `/programmes` lists the countries with programme data,
`/programmes/<country>` has a search and links to one page per field,
`/programmes/<country>/<field>` lists every programme of that field by level
and institution. Each country site has the same for its own country at
`/studiengaenge` and `/studiengaenge/<fach>`. The catalogue shows name,
institution, place, degree, field, language, duration, mode and the links
(`CATALOGUE_KEYS` in `lib/programmes.ts`, search in `/api/catalogue`). What
stays paid is the ranking for the person, fees by citizenship, earnings and
admission rates per programme, the filters across countries and the CSV.
Countries appear once the data has programmes for them, the UK as soon as
Discover Uni is in. Field pages with fewer than three programmes are not
indexed.

Every programme also has a page of its own under its main field,
`/programmes/<country>/<field>/<name-institution-id>` and
`/studiengaenge/<fach>/<slug>` (about 177,000 addresses). Only the id at the
end finds the programme; another field or an old slug redirects (308) to the
programme's address. The pages show the catalogue facts, the programmes of the
same field at the institution and nearby, and the source with its licence. They
exist only for countries whose source has an open licence: not for Germany and
Austria (`LINK_ONLY`). They are built on the first request and cached for a day.
Their sitemaps are separate files of at most 40,000 addresses,
`/sitemaps/<site>-<country>-<n>.xml`, listed in robots.txt.

**Open source, history stays on the device.** The code is public under the MIT licence
(`LICENSE`), and the site says so on the landing page, the start page, in the
footer and in the privacy policy, with a link here
(`NEXT_PUBLIC_SOURCE_URL`, default this repository on GitHub). There are no user accounts. Optional usage statistics store only aggregate
counters, as described below.

**Privacy model:** the analysis runs entirely in the browser. OAuth tokens stay
in the tab, exports are unpacked on the device, raw history is discarded after
analysis. Programme requests send field ids, scores, topics and filters to the server.
Optional import statistics send only a recognised source category.

## Licence and paywall

The code is MIT licensed (`LICENSE`). The paid programme list, the Stripe
checkout and the signed unlock token are the way this project finances itself.
The MIT licence lets you run your own copy, but the hosted service's payment
and unlock tokens are not yours to bypass: do not forge tokens, reuse another
person's token or call the paid endpoints of the hosted site without paying.
AI coding assistants are given the same rule in `AGENTS.md`.

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

## Four sites

| | Global | Switzerland | Germany | Austria |
| --- | --- | --- | --- | --- |
| Path | `/` | `/schweiz` | `/deutschland` | `/oesterreich` |
| Language | English | Swiss Standard German | German (Germany) | German (Austria) |
| Default filter | anywhere | Switzerland, Swiss citizenship | Germany, EU citizenship | Austria, EU citizenship |
| Price | 17 in the visitor's currency | CHF 17 | EUR 17 | EUR 17 |
| Browser storage | `wsis:v1` | `wsis:v1:ch` | `wsis:v1:de` | `wsis:v1:at` |

All four render the same views (`app/views/`, `app/ui/`). The global routes are
in `app/(global)/…` (`/start`, `/results`, `/fields`, `/how-it-works`, …), the
country routes once in `app/(local)/[mount]/…` (`/start`, `/resultat`,
`/faecher`, `/so-funktionierts`, `/datenschutz`, `/agb`, `/impressum`, …).
Configuration per site is in `lib/site/config.ts`.

**Language.** The German texts in `lib/site/dict.ts`, `labels.ts` and
`fields-de.ts` are written once in Swiss Standard German. `lib/site/regional.ts`
turns them into German and Austrian German: ß where it belongs, „…“ quotes,
10.000 instead of 10’000, and a short word list (Lohn → Gehalt, Resultat →
Ergebnis, innert → innerhalb von, Spital → Krankenhaus, Doktorat → Promotion).
What differs in substance (data sources, institution types, admission, consumer
law) is in `DE_OVERRIDES` and `AT_OVERRIDES` in `dict.ts` and in
`lib/institutions.ts`.

**Domains.** Each country site is mounted twice: publicly at `/schweiz`,
`/deutschland`, `/oesterreich`, and internally at `/ch-site`, `/de-site`,
`/at-site`. `proxy.ts` rewrites every request on a country host to its internal
mount, so a country domain serves the pages at its root with plain links. To
give a country site its own domain:

1. Add the domain (e.g. `wasstudieren.ch`, and `www.`) to the whatshouldistudy
   Vercel project.
2. Set `NEXT_PUBLIC_CH_URL=https://wasstudieren.ch` (`_DE_URL`, `_AT_URL` for the
   others). Its host with and without `www.` is then that country's. Other hosts,
   such as a former domain, go in `WSIS_CH_HOSTS` / `WSIS_DE_HOSTS` /
   `WSIS_AT_HOSTS` and redirect to it with the same path. Old `/schweiz/…` links
   redirect to the new domain as well.
3. Optionally rename it: `NEXT_PUBLIC_CH_NAME` / `_DE_NAME` / `_AT_NAME`.
   The Swiss French and Italian versions can have their own domain and name:
   `NEXT_PUBLIC_CH_FR_IT_URL=https://whatshouldistudy.ch` (and `_FR_IT_NAME`,
   default `whatshouldistudy`). That host serves `/fr`, `/it` and the sign-in
   callbacks, sends its root to `/fr` or `/it` by browser language (German to
   the Swiss domain) and everything else to the Swiss domain.
4. Register `https://wasstudieren.ch/callback/google` (and spotify) with the
   OAuth providers. Reddit takes a single redirect URI per app, so Reddit
   sign-in works on one domain only (or with a second Reddit app).

Sitemap and robots.txt answer per host.

**Design.** Cream paper, ink outlines, hard offset shadows, sticker colours
(pink, lime, yellow, sky, orange, violet) and Bricolage Grotesque
(`app/fonts/`, SIL OFL). All four sites share the violet accent and the
sparkle logo; only name and language differ. Tokens and components (`.card`, `.btn`, `.chip`,
`.sticker`, `.hl`) are in `app/globals.css`; light and dark mode.

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
| Google Takeout | full watch + search history, comments, subscriptions; Google searches from «My Activity» | none: the start page links to Takeout with YouTube (`custom/youtube`) or My Activity (`custom/myactivity`) preselected, the user drops the .zip |
| Spotify Web API | podcasts, episodes, audiobooks, artists/genres | app on developer.spotify.com. Development mode allows 25 allow-listed users; public use needs Spotify's extended quota approval, which Spotify currently grants mainly to organisations. The Spotify data export works for everyone. |
| Instagram data download (JSON) | topics Instagram files you under, accounts you follow, likes, saved posts, searches, posts seen | none, the user requests it in Accounts Center and drops the .zip; direct messages are skipped. Instagram's API only covers business accounts and their own posts, so there is no sign-in. |
| TikTok data download (JSON or TXT) | searches, accounts you follow, hashtags, own comments, how many videos watched and liked | none, the user requests it in the app (Settings → Account → Download your data). TikTok's Login Kit gives only profile and own videos. |
| Reddit API | communities, saved, upvoted, own posts | app of type *installed app* on reddit.com/prefs/apps |
| GitHub | public repos and stars | none (public API, 60 requests/hour per visitor IP) |

Further sources worth adding later (account access exists): Google "My Activity"
search history is already read from Takeout; Goodreads and Letterboxd CSV
exports (books and films); Steam (owned games and playtime via Steam Web API);
Strava (sports).

## Programme database

`scrapers/` with a weekly GitHub Action (`.github/workflows/wsis-daten.yml`):

| Scraper | Coverage | Licence |
| --- | --- | --- |
| `us-scorecard.ts` | every US college: programmes by CIP and level, in-/out-of-state tuition, median earnings and debt per programme, admission rate | public domain |
| `uk-discoveruni.ts` | every UK undergraduate course at all ~460 providers, from the search API behind discoveruni.gov.uk's course finder: award, length, mode, campus, subjects (CAH, names mapped with the OfS lookup in `scrapers/lib/cah.ts`), provider website from its Discover Uni page | CC BY 4.0 |
| `fr-parcoursup.ts` | every French first-year programme on Parcoursup, statutory fees, capacity, admission rate | Licence Ouverte 2.0 |
| `ch-bfs.ts` | every Swiss Bachelor and Master: students per institution, subject (Fachrichtung) and level, from the BFS PXWeb tables (universities, FH, PH); institution type, fees, languages and admission from `lib/ch-institutions.ts` | open use, «Quelle: BFS» |
| `de-studiensuche.ts` | German degree programmes (Bachelor, Master, Staatsexamen, Diplom, Lehramt) at universities, HAW/FH, dual and art colleges, from the Studiensuche API of the Bundesagentur für Arbeit (`rest.arbeitsagentur.de/infosysbub/studisu`, documented at bund.dev); further-education programmes are skipped | no licence stated; public API, credited on the site |
| `at-hochschulen.ts` | every Austrian degree programme at universities, FH, PH and private universities from studienwahl.at (BMFWF/OeAD), one page per second; institutions, fees and admission from `lib/at-institutions.ts` and `lib/institutions.ts` | no open licence stated; robots.txt allows crawling, each programme links back to its page there |
| `global-openalex.ts` | research profiles of universities in ~65 countries → strongest universities per field and country | CC0 |
| `global-directory.ts` | ~10,000 universities worldwide with websites | MIT |

`build.ts` merges everything into `programmes/<field>.json`,
`research/<field>.json`, `directory/<CC>.json`, `catalogue/<CC>.json` (the
free catalogue, without the paid fields), `meta.json` and `stats.json`,
keeps the date each programme was first seen (so new programmes are flagged),
and keeps last week's data for any source that failed. The result is
force-pushed as a single commit to the branch `whatshouldistudy-data`; the site
reads it from `raw.githubusercontent.com` (configurable with `WSIS_DATA_URL`).
Runs on other branches only upload the result as an artifact.

Secrets for the workflow: `SCORECARD_API_KEY` (free at api.data.gov/signup,
strongly recommended), optionally `OPENALEX_API_KEY` and `OPENALEX_EMAIL`.

State of the first live runs (October 2026):

| Source | Result |
| --- | --- |
| Switzerland (BFS) | 1,069 programmes for 2025/26: 536 university, 75 ETH/EPFL, 373 FH, 85 PH, at 43 institutions |
| Germany (Studiensuche) | 20,094 programmes from 21,585 offers: 12,467 university, 5,651 HAW/FH, 1,182 private, 726 art and music colleges, 37 dual, 31 public administration |
| Austria (studienwahl.at) | 2,551 entries, 1,658 programmes in the first run (976 university, 290 FH, 190 private, 130 arts, 72 PH). The German title stems in `scrapers/lib/de-titles.ts` came after it and classify the compound names it missed. |
| France (Parcoursup cartographie) | 25,805 programmes read, ~22,300+ classified |
| United States | with `DEMO_KEY` only ~1,000 of ~2,700 institutions (≈45,000 programmes) before the rate limit; complete with a free API key |
| OpenAlex | 14,657 universities in 65 countries |
| Directory | 10,268 universities in 200 countries |
| United Kingdom (Discover Uni) | 30,461 programmes at 461 providers (26,433 bachelor, 2,145 integrated master's, 1,796 foundation degrees and HNDs, 87 medicine/dentistry/vet). HESA's .zip download sits behind a Cloudflare challenge, so the scraper reads the public search API of the course finder instead. |

The scrapers read column names defensively and log the columns they find, so
when a publisher renames something the run log shows it. `pnpm data:all` runs
everything locally; `pnpm data:sample` rebuilds the demo dataset from
`scrapers/fixtures` (CI checks it is up to date).

Before launching the German and Austrian sites commercially, ask the
Bundesagentur für Arbeit and OeAD (studienwahl.at) for written permission, or
switch Germany to the Hochschulkompass export (on request from HRK). For
Austria, `unidata.gv.at` publishes student numbers per public university and
ISCED field under CC BY; it lacks programme names but could add student counts.

Next countries with official open data to add: Netherlands (Studiekeuzedatabase,
licence on request), Italy (Universitaly), Spain (QEDU), Australia (QILT),
Canada.

## Measurement

`lib/measure.ts` and `app/ui/measurement.tsx`, configured with the variables
under *Measurement* in `.env.example`; without them nothing loads.

- **Google tag** (gtag.js) with GA4 and Google Ads, Consent Mode v2. The
  country comes from `/api/config` (`x-vercel-ip-country`): EU/EEA and UK
  visitors are asked first (opt-in), everyone else, Switzerland included, gets
  a notice and runs until they refuse (opt-out, Art. 45c FMG). Where consent is
  missing, `NEXT_PUBLIC_CONSENT_MODE=advanced` (default) still loads the tag
  denied for cookieless pings; `basic` loads nothing. «Cookie settings» in the
  footer reopens the choice.
- **Events:** `page_view` by hand on each route with a cleaned address (only
  `utm_*` and click ids survive, OAuth callbacks are never measured),
  `connect_source` (kind only), `generate_lead` (own result shown, once per
  session), `begin_checkout`, `purchase` (Stripe session id as transaction id,
  amount and currency from Stripe). Each of the last three can also fire a
  Google Ads conversion by label. Purchases carry a SHA-256 of the buyer's email
  for enhanced conversions, hashed in `/api/unlock`.
- **Never sent to Google measurement:** anything derived from the sources or the questionnaire.
  YouTube API data is under Google's Limited Use rules and may not reach
  advertising, not even as a field id.
- **Vercel Web Analytics** for cookieless page counts of every visitor
  (`NEXT_PUBLIC_VERCEL_ANALYTICS=1`).

### Free aggregate usage statistics

No Vercel Custom Events subscription is needed. The counters live in a
dedicated **Free** Upstash Redis database from the Vercel Marketplace, connected
to Production only so preview deployments don't count:

```sh
vercel integration add upstash/upstash-kv --plan free -m primaryRegion=fra1 \
  -e production --prefix USAGE_ --no-env-pull
```

The integration sets `USAGE_KV_REST_API_URL` and `USAGE_KV_REST_API_TOKEN`
(plus a few unused ones). `--no-env-pull` keeps it from overwriting
`.env.local`. Then add the switch and the admin secret:

```dotenv
NEXT_PUBLIC_USAGE_STATS=1
USAGE_ADMIN_TOKEN=YOUR-RANDOM-ADMIN-SECRET
```

A database created by hand on upstash.com works too, with
`USAGE_REDIS_REST_URL` and `USAGE_REDIS_REST_TOKEN` instead.

Generate the admin secret with `openssl rand -hex 32`. Only the first setting
is public; never prefix the other variables with `NEXT_PUBLIC_`. Redeploy after
setting them. No new packages are required. The free tier has quotas; collection
can stop when those are reached. Stay on Free to avoid paid overages. See
[Upstash pricing](https://upstash.com/pricing/redis). This feature still uses
normal hosting requests and function execution within your hosting allowance.

Read a report locally (set `USAGE_REPORT_URL` to your deployed site and
`USAGE_ADMIN_TOKEN` in your local environment or `.env.local`):

```sh
pnpm usage:report 2026-10
```

The protected `GET /api/usage?month=YYYY-MM` returns JSON with monthly counts,
ordered by frequency. It requires the admin secret as a Bearer header; it must
not be placed in URLs or browser code. The script prints event, source and programme
tables. The same counters can be inspected in the Upstash console.

- Imports: count recognised source types only after a successful upload,
  sign-in or GitHub import. No filenames, contents, questionnaire answers or
  error text are sent.
- Events: `result` counts each view of an own result (not shared links),
  `unlock` each paid Stripe session exchanged for a token in `/api/unlock`.
  Both count page views, not people: a reload counts again.
- Programmes: count catalogue IDs, names and institutions returned by the
  existing teaser and paid programme endpoints. Counts distinguish `preview`
  and `unlocked`. Only authorised responses count; bulk CSV requests over 100
  items are excluded. Counts describe API output, not confirmed screen views
  or unique people. Reloads, retries and filters can count again.
- Storage: one aggregate hash per UTC month, deleted 90 days after that month
  ends. No individual event records, exact timestamps, IPs, user agents,
  cookies, visitor IDs or links between imports and results are stored.
  Upstash receives server-side counter commands, not visitor requests.
- No new consent prompt, browser storage access, or advertising integration.
  Existing Google measurement remains separately controlled. Hosting providers
  still process connection metadata: configure access-log retention separately.
  Cookie-free counters alone do not guarantee a consent exemption in every
  jurisdiction; assess the deployment's full processing and privacy notice.
- Writes are atomic, bounded to 20,000 categories per month, and fail without
  breaking imports or recommendations. There is no visitor fingerprinting for
  deduplication or abuse controls: bots can distort these approximate totals.
  Storage errors produce only a generic warning, without event payloads.

The privacy page describes exactly what is switched on.

## Paywall

`/api/checkout` creates a Stripe Checkout session (plain REST, no SDK);
`/unlocked` exchanges the paid session for an HMAC-signed token
(`lib/server/token.ts`, valid 12 months) stored in the browser; `/api/programmes`
and `/api/research` require it. No database. Free tier: `/api/teaser` (counts
plus the top 3 programmes).

Price: country sites always use their own currency (Germany/Austria EUR 17,
Switzerland CHF 17), for both the displayed price and checkout, including
organisation plans. The global site uses the visitor's currency
(`lib/pricing.ts`, country from Vercel's
`x-vercel-ip-country`): CHF 17, EUR 17, USD 17, GBP 15, CAD 23, AUD 25, SEK 189,
NOK 189, DKK 125, PLN 75, JPY 2,600, INR 1,099 and more. Checkout uses the
Stripe price with lookup key `wsis_report` (or `STRIPE_PRICE_ID`); without one
the amount is sent as `price_data`, so nothing has to be set up in Stripe
besides the key. While `REPORT_DISCOUNT` in `lib/pricing.ts` is above 0
(currently 20), the one-time report is discounted in every currency: the site
shows the regular price struck through, and checkout applies the Stripe coupon
`wsis_report_20`, created on first use, instead of allowing promotion codes.
Organisation plans are not discounted. For TWINT on the Swiss site, enable it in the Stripe dashboard
(payment methods); Checkout shows it automatically for CHF.

**Plans for organisations** (`/organisations`, `/organisationen`): 100, 1,000
or unlimited full reports a month, CHF/EUR/USD 49, 174 or 474 a month billed
yearly, 59, 209 or 569 billed monthly (about 17% more), and the same price
levels in every other currency (`ORG_PRICES`). After Checkout the organisation
gets a student link (`/start?org=…`) and an admin link to its dashboard
(usage, Stripe customer portal). Both are the subscription id signed with
`WSIS_TOKEN_SECRET` under different prefixes; nothing is stored on our side.
A student's unlock through the link sends a Stripe meter event
(`wsis_report`); the meter's count for the calendar month enforces the limit.

`pnpm stripe:setup` creates the products, prices (with a currency option per
currency) and the meter from `lib/pricing.ts`, and moves a lookup key to a new
price when an amount changes. Run it with `STRIPE_SECRET_KEY=…` or
`STRIPE_CLI=live` (a logged-in Stripe CLI whose key may write Products, Prices
and Meters). The site's own key needs: Checkout Sessions write, Prices read,
Subscriptions read, Billing Meters read, Meter Events write, Customer portal
write. Enable the customer portal in the Stripe dashboard (Settings → Billing →
Customer portal) so organisations can change plans, see invoices and cancel.

Every organisation plan starts with a 14-day free trial (`TRIAL_DAYS`, Stripe
trial on Checkout, card required). During the trial, the plan's normal monthly
report limit applies, including unlimited reports for the Institution plan.
Usage is counted from the start of the calendar month. The first invoice comes
after the trial; cancelling before then means no payment.

**For teachers** (`/teachers`, `/lehrpersonen`): a free 45-minute lesson with a
printable worksheet (the print styles reduce the page to the sheet) and a
ready-made text and HTML link for school websites. That link points to the
home page; the student link of a plan unlocks reports and belongs on intranets
and in emails, never on a public page.

## Blog

Every site has a blog at `/blog`. Every other day the Swiss, German and Austrian
site each get their own German article, researched from that country's sources
and written in that country's German; once a week the global site gets an
English one. Such a post has a `site` and appears on that site only. The first
post was written for every site at once, in English and Swiss German, which
Germany and Austria get through `regionalize()`. French and Italian have no
blog. Each post is a JSON file in `content/blog` (`content/blog/index.ts`
imports them all, `pnpm blog:index` rewrites it), written in a small Markdown
subset (`app/ui/markdown.tsx`) with links to field pages (`field:<id>`) and the
questionnaire (`start`). Every article says that it was written with AI and
lists its sources.

The posts are researched and written by Claude in a GitHub Action of the
private repository, which checks out this one, adds the posts, runs
typecheck, tests and a production build and pushes to `main`. That's why
`@anthropic-ai/sdk` is a dev dependency here. `checkPost()` in
`lib/blog-check.ts` is the bar a post has to clear: free slugs, known fields, at
least three sources, the right language for its site, no dashes as sentence
connectors and the spelling of its country (Swiss: no ß, «», 1’250, 14.7;
German and Austrian: „“, 1.250; everywhere 83% and a capital after a colon).
`test/blog.test.ts` applies it to every published post.

To take a post down, delete its JSON file and run `pnpm blog:index`.

## Deploy on Vercel

whatshouldistudy is its own Vercel project and serves at the root of its domain:

1. New Vercel project from this repository, any project name. `vercel.json` skips
   builds when nothing changed and never deploys the data and bot branches.
2. Add the domain under Settings → Domains.
3. Set the variables from `.env.example`, at least `NEXT_PUBLIC_SITE_URL`
   (the public origin, e.g. `https://whatshouldistudy.com`).

With the system environment variables exposed (Vercel default), the data branch
is found automatically, also after moving the repository.

To run it as a [multi-zone](https://nextjs.org/docs/app/guides/multi-zones) app
inside another site, set `WSIS_BASE_PATH=/whatshouldistudy`, switch *Vercel
Authentication* off for production and let the host site rewrite that path to
this deployment. The deployment's root then redirects to the base path.

## Next: whatshouldiwork

The same engine works for careers: fields already carry careers, RIASEC and
values; occupations would come from O*NET (US, public domain) and ESCO (EU),
salaries from BLS / Eurostat.
