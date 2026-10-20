# whatshouldistudy

Find a programme at a specific university with a short questionnaire, optionally
supplemented by your own data. The questionnaire covers RIASEC interests (four
custom items per area plus an attention check), school subjects and values;
the 20 Mini-IPIP Big Five items are optional. Results are available with at least
two interest answers per area or imported data, without personality answers.
Personality remains a questionnaire step and counts towards the overall progress
(67 entries, including optional questions). The
custom interest scale is not yet validated in a study. Results match 80 fields
to programmes in the available country datasets. Germany and Austria currently
link to official programme searches; their own programme readers are pending.
The paid report reveals the best field and programme and offers an optional AI
comparison of programme pages with the person's profile.

**Professional documentation:** `/fachinformationen` on country sites
(`/schweiz/fachinformationen` locally), `/professional` on the global site.
The manual covers administration, scoring, item keys, evidence status, data
flows and retention, adviser self-study, and a proposed validation protocol.
It does not claim psychometric validation or institutional approval.
No representative German-speaking norms have been established for this
implementation. Big Five results therefore show reverse-keyed item means
(1–5), requiring all 20 valid responses, rather than approximate percentiles.
In questionnaire mode personality affects neither the field ranking nor hidden
suggestions or their reasons. Old shared profiles without means are not
converted into new scores. The personal AI endpoint requires `consent: true`
in addition to the existing paid access check.

**Separate questionnaire session:** `/beratung` on country sites
(`/schweiz/beratung` locally), `/counselling` globally. Available from the manual,
teacher and organisation pages. It starts empty, uses tab memory only and shows
descriptive profiles after all 24 interest items. It does not mount imports,
personal AI, measurement or organisation capture, and does not expose the paid
programme ranking. Entry uses a full page navigation to unload previously loaded
scripts. Explicit print/JSON copies are personal data; ending a session does not
delete downloaded files. Page requests and hosting logs still require review.

**Research preparation:** [pilot protocol](docs/validation/PILOT_PROTOCOL.md),
[research decisions and unresolved rights](docs/validation/RESEARCH_DECISIONS.md),
and [institutional dossier](docs/validation/INSTITUTIONAL_REVIEW.md).
`npm run validation:bundle` records exact forms for each language, scoring/source
checksums and an unreviewed field-profile template. Review version IDs before
regenerating; `npm run validation:check` (also in tests) detects drift. Keep
completed independent reviews separately from the generated template.
Catalogue releases must be archived separately before a study. Result wire
version 1 is unchanged; new `method` metadata identifies the procedure, while
old shared links without it remain unversioned. Its locale is the current display
language, not proof of the language used for older saved responses. No external test items, norms
or restricted research datasets were adopted, and no study has been launched.

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

**Was arbeiten? — free Swiss job explorer.** The results page links to
`/wasarbeiten` (or `/schweiz/wasarbeiten` under the global domain). It reuses
the same browser-local questionnaire and effective interest summaries, including
an already enabled content analysis. No new upload, AI call, payment or profile
transmission is needed. Shared results are not imported into the viewer's profile.
The study paywall and its endpoints remain separate.

The page combines 25 editorial career directions with current Swiss job adverts.
Career suggestions compare activity interests, enjoyed school subjects, work
priorities and existing interest summaries; they do not assess qualifications.
Employer fit compares the preferred city, work arrangement and sector with one
specific opening. It neither invents a company culture nor combines conditions
from different vacancies. Extra preferences live in the existing site store and
are removed by its normal data deletion. Interface text is available in DE/EN/FR/IT.

Run `npm run data:jobs` to refresh `data/jobs/current.json`, or
`node scrapers/jobs.ts --previous previous/jobs.json --out output/jobs.json`.
The scraper reads public career pages for Swissquote, Swiss Medical Network and
Nexthink, plus the public job feeds embedded in the Coop group, federal government
and SBB career portals. It reads all pagination levels, observes robots.txt, waits
at least 1.5 seconds between requests, and stores only job facts and original links,
not descriptions or contact details. The central SmartRecruiters API is excluded
because its robots.txt disallows this reader. Switzerland must be explicit in the
work country or (for Coop apprenticeships without a country) a Swiss canton.
Foreign postings, speculative applications and trial visits are excluded.
Publications with the same requisition ID are merged. Each source must return a
complete list; truncated, repeated or changing pages fail without deleting the
previous source snapshot. These employer groups are still a selection of the market.

The 13 October 2026 snapshot contains 2,954 adverts across 93 employer names and
organisational units, including 964 apprenticeships, internships and trainee roles.
Coop contributes 2,235, the federal government 421, SBB 147, Swissquote 37,
Swiss Medical Network 110 and Nexthink 4. Counts and training places are shown
separately in the interface. Subsidiaries of a diversified group get their own
sector; unknown employers are not assigned the sector of the parent group.

To refresh a subset, use e.g. `--sources Coop,Bund,SBB`. Other configured sources
retain their original statuses and check dates. The loader accepts larger feeds
with a bounded native HTTP request and hourly memory cache, avoiding Next's 2 MB
fetch-cache limit. Employer cards are paginated as well as job cards.

`.github/workflows/wsis-jobs.yml` refreshes daily at 04:41 UTC and when scraper
code changes on main. It publishes the separate `whatshouldistudy-jobs` branch
without triggering a Vercel deployment. The app reads its `jobs.json` with hourly
page revalidation and memory caching; `WSIS_JOBS_URL` can override the full URL. Until that branch exists,
the bundled real snapshot is used with its original check dates. Complete reads
remove closed jobs; failed or unexpectedly incomplete reads retain the previous
source and its old timestamps. Expired jobs and jobs unchecked for seven days are
hidden even if a refresh fails. Source status and check dates are visible on the page.

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
Austria (`LINK_ONLY`); `PROGRAMME_PAGES_PENDING` can hold back others. Sources
without an open licence are not used at all until their publisher agrees in
writing (`PERMISSION_PENDING` in `scrapers/build.ts`): studyprogrammes.ch, the
Studiensuche of the Bundesagentur für Arbeit and studienwahl.at. Switzerland
then has the BFS data (free use with attribution), and for the largest
universities their own programme lists (`ch-hochschulen.ts`), one page per field of
study at an institution; Germany and Austria get pages per field that link to
the official search. Reports and school plans are on sale in both countries;
the landing page, report checkout and school plans disclose that individual
German and Austrian programmes are not included. Selecting only DE/AT returns
no individual programmes. The paid report includes the top field with evidence
and matching programmes from the covered countries. Field pages list the programmes as links to these pages,
on the global site a few per country. They are built on the first request and
cached for a day.
Their sitemaps are separate files of at most 40,000 addresses,
`/sitemaps/<site>-<country>-<n>.xml`, listed in robots.txt.

**Open source, local analysis by default.** The code is public under the MIT licence
(`LICENSE`), and the site says so on the landing page, the start page, in the
footer and in the privacy policy, with a link here
(`NEXT_PUBLIC_SOURCE_URL`, default this repository on GitHub). There are no user accounts. Optional usage statistics store only aggregate
counters, as described below.

**Privacy model:** the default analysis runs in the browser. OAuth tokens stay
in the tab and exports are unpacked on the device. Parsed Google activity and YouTube export data
stays in local IndexedDB for the optional AI step; other raw imports are discarded
after analysis. Removing the YouTube source or deleting all data clears that record. Programme requests send field ids, scores, topics and filters to the server.
Optional import statistics send only a recognised source category.
The separate, explicit AI content step previews a bounded sample of titles and
channel context from a user-selected Takeout export, then sends it through our
server to Infomaniak (Swiss AI infrastructure). API-fetched YouTube metadata never enters this sample.
We do not store or log these requests. The original and AI summaries stay locally.

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
| Price | 9 CHF/EUR/USD | CHF 9 | EUR 9 | EUR 9 |
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

### Optional semantic content analysis

The unlocked result has a separate «Understand my viewing with AI» control.
It prepares the existing YouTube import locally, including after a reload or
checkout return. Review the sample, then explicitly agree to send it; there is
no separate file picker. Parsed export signals are saved in IndexedDB, separately
for each site, and replaced or deleted with the source. If browser storage is
unavailable, the import remains usable in memory for the current visit. Imports
from older versions only have summaries and need one import through the start
page. Existing AI summaries remain usable without it. A local before/after table
shows the top ten field ranks and points, including when the order is unchanged.

`contentPlan` selects at most 240 distinct records, including up to 60
subscriptions and 60 recurring channels, with recent videos spread across
channels. Each includes only its title, channel name and up to four example
titles. Account identifiers, URLs, dates, watch counts, searches, comments,
music-listening entries and API metadata are excluded from the request.
`/api/content-analysis` requires the existing unlock and consent flag, processes
40 records per batch, and charges the existing AI and purchase budgets.
Gemma at Infomaniak interprets the content against the known subject taxonomy, can abstain,
and must not infer political beliefs or other sensitive traits of the viewer.

Each direct reading replaces the keyword classification of that title. A
recurring channel subject provides half-strength context to other videos in
that channel, explicitly marked as such in the evidence; it cannot override
an individually reviewed video. A virtual channel record never adds activity.
Repetition, dates, subscriptions and the usual questionnaire weighting remain
in the local scoring. Semantic subjects also reach programme-content matching.
This is a sample-based interpretation, not a transcript analysis or validated
measure of study suitability. The original summary remains available; disabling
or deleting the AI summary restores it. Failed or cancelled batches do not
replace a previous result.

## Data sources and their setup

| Source | What | Setup |
| --- | --- | --- |
| YouTube Data API | subscriptions, likes, playlists, uploads, channel details | Google Cloud project, enable *YouTube Data API v3*, OAuth client (web), consent screen with scope `youtube.readonly`. Until Google verifies the app (sensitive scope, a few weeks, needs the privacy page and a demo video), only listed test users can sign in. Default quota is 10,000 units/day ≈ 50–60 full scans; request more via the quota form. |
| Google Takeout | YouTube history, Google searches and readable Google News article titles from My Activity; separate YouTube exports remain supported | none: one main link preselects My Activity (`custom/my_activity`); upload the .zip (all split parts together). Other imports are collapsed under optional sources. |
| Spotify Web API | podcasts, episodes, audiobooks, artists/genres | app on developer.spotify.com. Development mode allows 25 allow-listed users; public use needs Spotify's extended quota approval, which Spotify currently grants mainly to organisations. The Spotify data export works for everyone. |
| Instagram data download (JSON) | topics Instagram files you under, accounts you follow, likes, saved posts, searches, posts seen | none, the user requests it in Accounts Center and drops the .zip; direct messages are skipped. Instagram's API only covers business accounts and their own posts, so there is no sign-in. |
| TikTok data download (JSON or TXT) | searches, accounts you follow, hashtags, own comments, how many videos watched and liked | none, the user requests it in the app (Settings → Account → Download your data). TikTok's Login Kit gives only profile and own videos. |
| Reddit API | communities, saved, upvoted, own posts | app of type *installed app* on reddit.com/prefs/apps |
| GitHub | public repos and stars | none (public API, 60 requests/hour per visitor IP) |

My Activity is the default import. YouTube leads; Google searches and News are supplementary (source weight 0.15 versus 0.85 for the YouTube export). URL-only and unavailable video titles are excluded, including from optional AI context. News titles are classified locally. The first AI selection (up to 240 entries) uses only YouTube; the explicit maximum run (up to 1,000 entries) can include up to 200 readable News titles after preview and consent. Google searches are never sent to this content analysis. AI News results replace the corresponding Google summary, keeping its lower source weight; disabling AI restores both originals. Activity weight halves every two calendar years; activity six or more calendar years old remains historical but no longer affects current interests. This is a product heuristic, not a validated psychological norm. Reimport older saved summaries to apply the new title filtering.

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
| `ch-hochschulen.ts` | the degree programmes as ETH Zürich, EPFL, the universities of Zürich, Bern, Basel, Luzern, St. Gallen, Fribourg, Geneva and Lausanne, ZHAW, FHNW, BFH and HSLU list them on their own websites: name, level, teaching language, credits, duration, specialisations, link. Facts only, no descriptions; one request every 1.5 s. Replaces the BFS row for the same institution, level and field | facts from public pages, each with a link to the source |
| `ch-studyprogrammes.ts` | **not run** until swissuniversities agrees: its legal notice reserves public or commercial use of its content. The Swiss catalogue uses the BFS data only | none stated |
| `de-studiensuche.ts` | **not run** until the Bundesagentur für Arbeit agrees: its Studiensuche API states no licence for reuse. The country pages link to its search instead | none stated |
| `at-hochschulen.ts` | **not run** until the publisher of studienwahl.at agrees: no licence for reuse. The country pages link to its search instead | none stated |
| `kr-academyinfo.ts` | every South Korean department and major at universities, colleges and graduate schools from 대학알리미 (academyinfo.go.kr): degree, duration, location, official subject classification | free use without restrictions («이용허락범위 제한 없음»): the Ministry of Education publishes the same department list on data.go.kr (dataset 15139338) |
| `au-cricos.ts` | every current Australian bachelor's, master's and doctoral course open to international students (CRICOS, data.gov.au): field of education, duration, city, international tuition | CC BY 2.5 AU |
| `fi-opintopolku.ts` | every Finnish degree programme at universities and universities of applied sciences (Opintopolku / Studyinfo.fi): level, ISCED-F field, offering institution, language | CC BY 4.0 |
| `nl-duo.ts` | every accredited Dutch programme at WO and HBO institutions (DUO «HO Opleidingsoverzicht»): place, study form, language, credits, English name, website; field from the names | CC BY |
| `no-dbh.ts` | every Norwegian degree programme (DBH table 347, HK-dir): level, credits, language, NUS code mapped to ISCED-F with Statistics Norway's KLASS correspondence | NLOD 2.0, credit «DBH» |
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

The landing hero offers checkout first for Google Ads arrivals, with the local
one-time price and AI analysis explicitly included. Detection uses nonempty
`gclid`, `gbraid`, `wbraid`, or `utm_source=google` with a paid medium (`cpc`,
`ppc`, `paidsearch`, `paid_search`, `paid-search`, `cpm`, `display`). It reads
only the current URL, stores nothing, and does not depend on analytics consent.
Other arrivals keep the free-start hero; sales-paused sites keep their normal
entry. Both variants use the existing checkout and paid unlock flow.
Preview locally at `/schweiz?utm_source=google&utm_medium=cpc`.

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

If Vercel Bot Protection is enabled, also set `VERCEL_AUTOMATION_BYPASS_SECRET`
in `.env.local` to the project's **Settings → Deployment Protection → Protection
Bypass for Automation** secret. The script sends it in the
`x-vercel-protection-bypass` header, alongside the separate admin authorization.
Vercel's browser challenge otherwise returns HTTP 429 before `/api/usage` runs;
retrying cannot solve that challenge. See
[Vercel's automation access documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
Keep both secrets private and out of URLs. This requires no app deployment.

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
and `/api/research` require it. No database. Free tier: `/api/teaser` (aggregate
counts and fields only, excluding the top field; no programme records).
The best programme appears directly below the top field in results; its details
are fetched through `/api/programmes` only after unlock.

After payment, `/api/stripe/webhook` emails the buyer a personal access link using
the Checkout email address and the existing Infomaniak SMTP settings. This runs
independently of the browser redirect. The email does not contain questionnaire
answers: it explains how to reopen the report in the original browser or complete
the questionnaire if no profile is present. Checkout records the interface locale
for German, English, French or Italian email copy.

Register a Stripe webhook for `checkout.session.completed` and
`checkout.session.async_payment_succeeded`, pointing to the canonical HTTPS
`/api/stripe/webhook` URL. Set its `STRIPE_WEBHOOK_SECRET` in the deployment.
The endpoint verifies the raw-body signature and timestamp, ignores unpaid,
subscription and unrelated-site sessions, and preserves the existing paid-session
check on the access link. SMTP or Redis failures return 503 so Stripe retries.
The existing USAGE Redis stores only a SHA-256 session identifier and a sent marker
for 400 days, plus a short concurrent-delivery lock. SMTP cannot guarantee exactly
once delivery if a process stops after the mail is accepted but before the marker
is saved; retries prefer a possible duplicate over a missing access email.
Ensure Vercel Bot Protection allows Stripe to reach this signed endpoint. Test
deliveries must reach the handler, not a browser challenge.

Owner recovery: `POST /api/stripe/recover-email` with the existing
`Authorization: Bearer <USAGE_ADMIN_TOKEN>` and JSON `{ "session_id": "cs_…",
"locale": "it-CH" }` rechecks the actual session in Stripe and sends to its
recorded buyer only. The optional locale corrects old Swiss language redirects.
It uses the same duplicate protection; it cannot grant access to an unpaid session.

Price: country sites always use their own currency (Germany/Austria EUR 9,
Switzerland CHF 9), for both the displayed price and checkout, including
organisation plans. The global site uses the visitor's currency
(`lib/pricing.ts`, country from Vercel's
`x-vercel-ip-country`): CHF 9, EUR 9, USD 9, GBP 15, CAD 23, AUD 25, SEK 189,
NOK 189, DKK 125, PLN 75, JPY 2,600, INR 1,099 and more. Checkout uses the
Stripe price with lookup key `wsis_report` (or `STRIPE_PRICE_ID`) only when
its amount matches the displayed price in the selected currency. Otherwise
the amount is sent as `price_data`, so an old Stripe price cannot override
the current price. The one-time report has a fixed price with no discount,
struck-through price or promotion codes. Run `pnpm stripe:setup` to update
the stored Stripe prices as well. For TWINT on the Swiss site, enable it in the Stripe dashboard
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

## Facts database (international programme pages)

`.github/workflows/wsis-fakten.yml` (after each successful data refresh or by hand, on main only) has Claude
Haiku 5.5 at Anthropic read public programme pages for CH, FR, GB, NL, NO, FI, AU,
KR and US (`scrapers/programme-facts.ts`,
rules and prompt in `scrapers/lib/facts.ts`). robots.txt is respected, one request
goes out every 1.5 seconds, including robots and redirects. A reading is refreshed
when the page text or the reader version changes: the hash and version are kept,
the page text is not. Named specialisations and distinctive statements require
literal source evidence; incomplete or duplicate response batches are retried
once and otherwise retain previous readings. Spending is capped per run (`--max-usd`).

Distinctive points are translated into DE/FR/IT/EN, and `/api/facts` selects the
reader's language. Original statements remain private alongside their translations.
Legacy points without translations are omitted
from the display until backfilled; they never silently fall back to another language.
Deploy the updated ingestion code before running the facts workflow with
`translate_only: true` (start with `country: CH`, `limit: 0`, `max_usd: 1`). This
translates stored statements without fetching university pages or changing scores,
source hashes or reading dates. The same per-country spending cap applies; rerun
until the log reports zero remaining. Failed batches keep their previous readings,
and successful translations are skipped on subsequent runs. Apply to the other
countries as well. The local equivalent, using a private readings file, is:

```sh
pnpm data:facts --translate-only --previous facts-prev/facts.json --out facts-out/facts.json --country CH --limit 0 --max-usd 1
```

Do not commit either readings file. The existing authenticated workflow stores
the output privately and reads it back to verify all fields and translations.
Its Vercel automation header uses the repository secret
`VERCEL_AUTOMATION_BYPASS_SECRET`; GitHub OIDC authentication remains required.
Other running server instances may retain cached readings
for an hour; paid API responses are cached in the browser for up to ten minutes.

The readings are never published. The job writes them to the site's private
database (`lib/facts-store.ts`: `FACTS_REDIS_REST_*`, or the counter database
`USAGE_*` if that is all there is) through `/api/facts/ingest`. The job proves who it
is with its GitHub Actions token (`lib/actions-oidc.ts`: this repository, main, this
workflow); the site refuses everything else. No database secret is kept in GitHub.
The site reads the readings through `/api/facts` (paid) and ranks the list in the
browser against the answers. The optional step «include my answers» (off by default,
after consent) sends the interest profile, weighted lexical topics and favourite
school subjects with up to 60 matches to `/api/personal-fit`, in requests of up to
20 matches each, including smaller lists and programmes without readings. The server
computes the numbers by fixed rules on the same calibrated scale as the browser.
With a sufficient reading, the AI can adjust that content score by at most 30
points and explain the connections in up to three sentences. Without one, it uses
the server's catalogue name, assigned fields and listed focus areas to explain
the limited connection; these explanations never change the points. They appear
in the programme details with their basis identified. Missing or unusable readings
do not disable the comparison. Lexical topics are mapped to the field IDs
used in stored readings. Missing readings have neutral content (50) in a list
with readings; a list without readings retains the questionnaire scores.
Programme ordering respects the person’s strongest fields first, using the
programme’s primary field rather than an incidental secondary tag. Within a
field, the profile counts 80 % and the content reading 20 %. A generic activity
or school-subject overlap is shown as a limited resemblance, never as proof of
interest in the programme’s subject; duplicate explanations and the standalone
AI fit grade are omitted.

BFH offers are read through the official public search with all result pages,
instead of the slow sitemap. Empty or sharply shrinking university/level groups
retain their previous catalogue entries while other universities refresh.
Programme languages and study modes remain unknown unless their source states them.

Secret: `ANTHROPIC_API_KEY` (GitHub Actions), already configured in this repository.
Only public programme information goes to this offline reader, never user profiles.

The workflow accepts `ALL` or one country (`UK` is normalized to `GB`). Each country
has its own job, cached page index and reading cursor; one failure does not stop the
others. Defaults: 150 reading attempts and at most USD 1 **per country** (USD 9
for ALL), after the weekly catalogue refresh and after scraper changes. Missing pages are found through institution sitemaps, at most
five institutions and 100 pages per institution per run; successive runs rotate
institutions and page batches. This builds coverage incrementally, not a promise
that every listed programme already has a reading. DE/AT remain excluded.

Discovery stores URLs only when the title identifies the programme and the degree
level, and rechecks that evidence when reading. Ambiguous matches remain unknown.
Official Discover Uni and Parcoursup programme records are also accepted; Studyinfo
uses its public education JSON record because its HTML is a JavaScript shell.
Norwegian institution codes are joined to HK-dir’s checked website list because
DBH omits the documented website column. DUO website origins support Dutch discovery.

Local example: `pnpm data:pages -- --data scrapers/dist --country US`, then
`pnpm data:facts -- --data scrapers/dist --country US --pages scrapers/out/pages-US.json
--out scrapers/out/facts-US.json --limit 150 --max-usd 1`. Readings stay private;
the page index contains only public URLs, titles and progress timestamps.


## Infomaniak AI and data processing

Interactive AI calls use `google/gemma-4-31B-it` at Infomaniak: export content
classification, personal programme comparisons and public description translations.
The offline reader for public programme pages uses Anthropic on the owner’s request;
see the facts database section above.
There is no runtime fallback to another provider. Gemma is a Google-developed model;
the inference endpoint is Infomaniak, not Google. The separate private blog
automation described below is outside this migration.

Set `INFOMANIAK_API_TOKEN` and `INFOMANIAK_PRODUCT_ID` in `.env.local` and in
each Vercel deployment environment that should run interactive AI. Local credentials do not configure
Vercel or GitHub automatically. Never use `NEXT_PUBLIC_` for these values.
`ANTHROPIC_API_KEY` is used by the offline public-page reader and the explicitly
invoked benchmark; it is not used for personal analyses.
Daily and per-purchase dollar budgets remain in place; Gemma costs are reserved
at a deliberately conservative 2 USD/CHF, not represented as an actual exchange
rate. The offline reader reserves conservative $1/$5-per-million-token estimates
(above Haiku 5.5’s current prices), retaining reservations on failed requests. Personal comparison groups get up to 40 seconds, with any retry
bounded by a shared 50-second deadline. Offline facts use groups of three and
a 120-second timeout.

Privacy review, 2026-10-13:

- Infomaniak's [DPA/AVV](https://www.infomaniak.com/documents/privacy/DPA/Data_Processing_Agreement_%28DPA%29.pdf)
  states that it forms part of the general terms. Retain the terms applicable
  to the organisation's account; this code change does not sign a new agreement
  or verify the account's contractual records. Its general transfer clause alone
  is not an exclusive Switzerland guarantee.
- The [AI product commitment](https://www.infomaniak.com/de/hosting/ai-services)
  specifies Swiss infrastructure. Advertising is scoped to AI processing at
  Infomaniak, not all website processing (Vercel, Stripe and other processors).
- [LLM API terms, article 6](https://welcome.infomaniak.com/api/components/cgu/latest?id=87&locale=en_GB)
  exclude training with prompts/responses but allow temporary processing and
  operational/billing metadata. No documented zero-retention request setting
  was found. `cache: 'no-store'` controls our fetch cache, not provider retention.
- Requests are stateless, contain no conversation/user IDs, forbid redirects,
  and are not cached or logged with their content. Personal results stay in the
  browser. Cost counters contain usage amounts and hashed purchase references,
  not prompts. Public programme readings and translations are stored for reuse.
- Consent text names Infomaniak; the remembered consent key changes. Existing
  content analyses remain local, but cannot automatically trigger a comparison
  with the new provider until the person agrees. Pending content batches from
  the old provider are not resumed as part of a new analysis.

The repeatable synthetic comparison is `scripts/ai-comparison.mjs`. An explicit
`--run --with-gemma --provider infomaniak-gemma --repeats 1 --out <new-folder>`
uses the production Infomaniak transport. Reports contain invented data only.
Existing reports retain their original provider settings and prompts.

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

The posts are researched and written with AI in a GitHub Action of the
private repository, which checks out this one, adds the posts, runs
typecheck, tests and a production build and pushes to `main`. That separate
automation configures its own provider and is not part of the website's
Infomaniak migration. The comparison script's provider SDK is a development-only
dependency. `checkPost()` in
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
