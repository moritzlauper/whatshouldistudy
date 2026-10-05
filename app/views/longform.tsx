import Link from 'next/link'
import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'
import { regionalize } from '@/lib/site/regional.ts'
import type { Locale } from '@/lib/site/config.ts'
import { getMeta } from '@/lib/server/data.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { CONTACT, SOURCE_URL } from '@/lib/site.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { Sparkle } from '../ui/shapes.tsx'

/** Who runs the site, for the privacy notice and imprint. Set NEXT_PUBLIC_OPERATOR, e.g. «Vorname Name, Zürich». */
const OPERATOR = process.env.NEXT_PUBLIC_OPERATOR
const OPERATOR_ADDRESS = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS

/** The German pages are written in Swiss spelling; Germany and Austria get theirs. */
function rz(node: ReactNode, l: Locale): ReactNode {
  if (l === 'de-CH' || l === 'en') return node
  if (typeof node === 'string') return regionalize(node, l)
  if (Array.isArray(node)) return node.map((n) => rz(n, l))
  if (isValidElement(node)) {
    const kids = (node.props as { children?: ReactNode }).children
    if (kids === undefined) return node
    return cloneElement(node, undefined, ...(Array.isArray(kids) ? kids.map((c) => rz(c, l)) : [rz(kids, l)]))
  }
  return node
}

/** Where a country's programmes come from, for «So funktioniert’s». */
function LocalData({ k }: { k: Kit }) {
  if (k.site === 'de')
    return (
      <p>
        Die deutschen Studiengänge stammen aus der Studiensuche der Bundesagentur für Arbeit, der gleichen Datenbank wie auf studiensuche.arbeitsagentur.de: Bachelor, Master, Staatsexamen und Diplom an Universitäten, Hochschulen für angewandte Wissenschaften, dualen Hochschulen und Kunsthochschulen. Staatliche Hochschulen verlangen keine Studiengebühren, nur einen Semesterbeitrag von meist 100 bis 400 Euro; Baden-Württemberg verlangt von Studierenden aus Nicht-EU-Staaten 1’500 Euro pro Semester. Private Hochschulen legen ihre Gebühren selbst fest.
      </p>
    )
  if (k.site === 'at')
    return (
      <p>
        Die österreichischen Studien stammen von studienwahl.at, dem Studienportal des Wissenschaftsministeriums: jedes Bachelor-, Master- und Diplomstudium an öffentlichen Universitäten, Fachhochschulen, Pädagogischen Hochschulen und Privatuniversitäten, mit Link zur Seite des Studiums. Öffentliche Universitäten sind für Studierende aus der EU innerhalb der Regelstudienzeit plus zwei Toleranzsemestern gratis, Studierende aus Drittstaaten zahlen 726.72 Euro pro Semester. Fachhochschulen verlangen meist bis 363.36 Euro pro Semester.
      </p>
    )
  return (
    <p>
      Die Schweizer Studiengänge stammen aus den Zahlen des Bundesamts für Statistik: Studierende pro Hochschule, Fachrichtung und Stufe, jeweils fürs neuste Studienjahr. Wo in einer Fachrichtung Bachelor- oder Master-Studierende eingeschrieben sind, gibt es dort ein Studium. Die Zahl der Studierenden steht beim Studiengang. Die Gebühr ist die Semestergebühr der Hochschule mal zwei, gerundet. Genaue Studiengangsnamen, Vertiefungen und Fristen findest du auf der Website der Hochschule. Quelle: BFS.
    </p>
  )
}

function Page({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <div className="relative">
        <Sparkle className="float-slow absolute -right-2 -top-4 hidden sm:block" size={56} color="var(--pink)" />
        <h1 className="font-display text-5xl sm:text-6xl">{title}</h1>
        {lead && <p className="mt-5 text-xl text-muted">{lead}</p>}
      </div>
      <div className="prose-wsis mt-4">{children}</div>
    </div>
  )
}

function DataSources({ k, sources, updated, sample }: { k: Kit; sources: Array<{ id: string; name: string; url: string; licence: string; count: number; ok: boolean; error?: string }>; updated?: string; sample: boolean }) {
  const de = k.locale !== 'en'
  return (
    <>
      <p>
        {sample
          ? de
            ? 'Hier läuft gerade ein kleiner Demo-Datensatz.'
            : 'This deployment currently shows a small demo dataset.'
          : updated
            ? `${de ? 'Letzte Aktualisierung' : 'Last refresh'}: ${new Date(updated).toLocaleString(k.intl, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Zurich' })}.`
            : ''}
      </p>
      <ul>
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.url}>{s.name}</a> ({s.licence}): {fmtNumber(s.count, k.intl)} {s.id.startsWith('global') ? (de ? 'Hochschulen' : 'institutions') : de ? 'Studiengänge' : 'programmes'}
            {!s.ok && s.error ? (de ? ` (letzter Lauf fehlgeschlagen: ${s.error})` : ` (last refresh failed; ${s.error})`) : ''}
          </li>
        ))}
      </ul>
    </>
  )
}

export async function HowView({ site, base }: SiteProps) {
  const k = kit(site, base)
  const { meta, sample } = await getMeta()
  const sources = meta?.sources ?? []
  if (k.locale !== 'en') {
    return rz(
      <Page title="So funktioniert’s" lead={`Drei Schritte: Wir lesen, was du schaust, hörst und baust, übersetzen das in ${FIELDS.length} Studienfelder und verrechnen es mit dem, was du uns über dich sagst. Hier steht jeder Schritt, auch was das Ganze nicht kann.`}>
        <h2>1. Deine Quellen lesen, in deinem Browser</h2>
        <p>
          Wenn du YouTube, Spotify oder Reddit verbindest, meldest du dich direkt beim Dienst an und erlaubst nur Lesezugriff. Der Schlüssel dafür bleibt in deinem Browser-Tab, und dein Browser fragt den Dienst selbst ab. Ziehst du einen Export von Google Takeout, Spotify, Instagram oder TikTok rein, wird die Datei auf deinem Gerät entpackt. Unser Server ist nie dabei.
        </p>
        <ul>
          <li>
            <strong>YouTube:</strong> Abos mit dem Datum, an dem du abonniert hast, gelikte Videos mit Datum, Tags, Kategorie und Thema, deine Playlists und Uploads. Dazu die Beschreibung und die Stichworte jedes Kanals dahinter.
          </li>
          <li>
            <strong>Google Takeout:</strong> dein ganzer Wiedergabe- und Suchverlauf, Kommentare und Abos, dazu aus «Meine Aktivitäten» deine Google-Suchen, besuchte Seiten, Maps-Suchen, Apps, Bücher und Artikel. YouTube gibt den Wiedergabeverlauf nicht über die Schnittstelle heraus, deshalb dieser Umweg. Oft stecken Jahre drin. Werbeeinträge lesen wir nicht.
          </li>
          <li>
            <strong>Instagram und TikTok:</strong> aus deinem Daten-Download die Themen, unter denen dich Instagram führt, die Konten, denen du folgst, deine Likes, Gespeichertes, Suchen, Hashtags und eigene Kommentare. Per Login geben beide das nicht heraus, deshalb der Download. Direktnachrichten lesen wir nicht.
          </li>
          <li>
            <strong>Spotify:</strong> gespeicherte Podcasts und Folgen, Hörbücher, Playlists und deine Top-Artists mit ihren Genres.
          </li>
          <li>
            <strong>Reddit:</strong> deine Communities, gespeicherte und upgevotete Posts, eigene Posts und Kommentare. Communities für Erwachsene lassen wir weg.
          </li>
          <li>
            <strong>GitHub:</strong> deine öffentlichen Repos und Sterne, mit Namen, Beschreibung, Themen und Programmiersprachen.
          </li>
        </ul>

        <h2>2. Von einzelnen Videos zu Fächern</h2>
        <p>
          Jedes Element läuft durch ein Lexikon mit mehreren tausend Begriffen auf Deutsch, Englisch, Französisch, Italienisch und Spanisch, egal ob Video, Kanal, Podcast, Subreddit, Repo oder Suche. Dazu kommen Kanäle und Creators, die eng mit einem Fach verbunden sind. Heraus kommt, wie stark das Element zu jedem Fach gehört. Vier Regeln machen das robust:
        </p>
        <ul>
          <li>
            <strong>Kanal-Kontext:</strong> Ein Video erbt die Hälfte vom Profil seines Kanals. Ein Physik-Kanal zählt also auch dann für Physik, wenn das Video «Das ändert alles» heisst.
          </li>
          <li>
            <strong>Abnehmender Ertrag:</strong> Innerhalb eines Kanals und Monats zählen <code>n</code> Videos wie <code>log₂(1+n)</code>. Ein Binge-Wochenende schlägt nicht drei Jahre stetiges Interesse.
          </li>
          <li>
            <strong>Lernen oder Unterhaltung:</strong> Vorlesungen, Erklärvideos und die Kategorie Bildung zählen bis 1.3-fach, Let’s Plays, Reactions und Compilations bis 0.7-fach. Musik dient nur dem Geschmack, nie als Hinweis auf ein Musikstudium.
          </li>
          <li>
            <strong>Bewusste Entscheidungen zählen mehr:</strong> Ein Abo wiegt zehnmal so viel wie ein einzelner Aufruf. Eigene Uploads und Repos noch mehr.
          </li>
        </ul>

        <h2>3. Interesse fair messen</h2>
        <p>Rohe Zählungen würden alle zu Sportwissenschaftler:innen machen, weil Fitness und Kochen einfach überall sind. Deshalb vergleichen wir für jedes Fach deinen Anteil mit dem, wie häufig solcher Inhalt allgemein ist:</p>
        <p>
          <code>lift = ln((dein Anteil + ε) / (Grundrate + ε))</code>
        </p>
        <p>
          Danach ziehen wir den Wert Richtung null, wenn nur wenige Elemente dahinterstehen (<code>n / (n + 4)</code>), belohnen Fächer, die über viele Monate auftauchen, und kombinieren die Quellen nach Zuverlässigkeit und Menge. Taucht ein Fach in zwei unabhängigen Quellen stark auf, gibt es einen Bonus. Sagen Reddit und YouTube dasselbe, ist das ein besserer Beleg als jede Quelle allein.
        </p>

        <h2>4. Die Psychologie</h2>
        <ul>
          <li>
            <strong>Interessen (RIASEC):</strong> Die sechs Interessentypen von John Holland (praktisch, forschend, kreativ, sozial, unternehmerisch, ordnend) stecken hinter den meisten Studien- und Berufsberatungen. Auch Explorix, das viele aus der Berufsberatung kennen, baut darauf auf. Jedes Fach hat ein RIASEC-Profil. Deins kommt aus 18 Fragen und aus den Fächern, mit denen du dich beschäftigst. Passen die beiden zusammen, sind Studierende zufriedener und brechen seltener ab.
          </li>
          <li>
            <strong>Persönlichkeit (Big Five):</strong> der Mini-IPIP (Donnellan et al., 2006), eine geprüfte Skala mit 20 frei verfügbaren Fragen. Persönlichkeit erklärt die Studienwahl schlechter als Interessen, deshalb zählt sie wenig. Ohne Fragebogen schätzen wir sie grob aus deinem Musikgeschmack und schreiben das auch so hin.
          </li>
          <li>
            <strong>Schulfächer und Werte:</strong> was du gern machst und gut kannst, und was du vom Job willst, etwa Lohn, Sicherheit, Kreativität oder Wirkung. Das vergleichen wir mit dem, worauf ein Fach aufbaut und was es bietet. Beim Lohn nutzen wir vorerst Daten zu Absolvent:innen in den USA.
          </li>
        </ul>
        <p>
          Das Resultat mischt diese Teile. Die Gewichte passen sich an: Mit viel Verlauf führt das Interesse, mit wenig zählt der Fragebogen mehr. Die Werte sind relativ. 90 heisst, dass ein Fach unter allen {FIELDS.length} für dich heraussticht, nicht dass du darin sicher Erfolg hast.
        </p>

        <h2>Was es nicht kann</h2>
        <ul>
          <li>Dein Verlauf zeigt Neugier, nicht Können oder Noten. Deshalb fragt der Fragebogen nach Schulfächern.</li>
          <li>Geteilte Konten, Autoplay und Phasen verrauschen das Bild. Die Gewichtung über Monate dämpft das, beseitigen kann sie es nicht.</li>
          <li>Inhalte in anderen Sprachen als den fünf oben verstehen wir nur teilweise. Schweizerdeutsche Titel klappen oft, aber nicht immer.</li>
          <li>Das ist ein Startpunkt, kein Urteil. Sprich mit Studierenden, schau dir Studienpläne an, geh an einen Infotag.</li>
        </ul>

        <h2 id="daten">Woher die Studiengänge kommen</h2>
        <LocalData k={k} />
        <p>Fürs Ausland kommen offene Daten aus den Nachbarländern, den USA, Grossbritannien und Frankreich dazu, für 60 weitere Länder OpenAlex. Alles wird jede Woche automatisch aktualisiert.</p>
        <DataSources k={k} sources={sources} updated={meta?.updated} sample={sample} />
        <p className="mt-10">
          <Link href={k.r.start}>Probier’s aus →</Link>
        </p>
      </Page>,
      k.locale,
    )
  }
  return (
    <Page title="How it works" lead={`Three steps: read what you consume and make, describe it in terms of ${FIELDS.length} fields of study, then combine it with what you tell us about yourself. Here is every step, including what it can’t do.`}>
      <h2>1. Reading your sources, in your browser</h2>
      <p>
        When you connect YouTube, Spotify or Reddit, you sign in with the service itself and grant read-only access. The access token stays in your browser tab; your browser calls the service directly. When you drop an export from Google Takeout, Spotify, Instagram or TikTok, the file is unpacked on your device. Our server is never involved.
      </p>
      <ul>
        <li>
          <strong>YouTube:</strong> subscriptions (with the date you subscribed), liked videos (with the date you liked them, plus tags, category and topic), your playlists and uploads, and the description and keywords of every channel behind them.
        </li>
        <li>
          <strong>Google Takeout:</strong> your full watch history and search history, comments and subscriptions, plus from «My Activity» your Google searches, pages you visited, Maps searches, apps, books and articles. YouTube doesn’t offer watch history through its API, so this is the way to get it, often years of it. Ad entries are skipped.
        </li>
        <li>
          <strong>Instagram and TikTok:</strong> from your data download, the topics Instagram files you under, the accounts you follow, your likes, saved posts, searches, hashtags and your own comments. Neither offers this through a sign-in, hence the download. We don’t read direct messages.
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
        Every item (a video, a channel, a podcast, a subreddit, a repository, a search) runs through a multilingual lexicon of several thousand terms in English, German, French, Spanish and Italian, including the names of channels and creators closely tied to a subject. The result is how strongly the item is about each field. A few rules make this robust:
      </p>
      <ul>
        <li>
          <strong>Channel context:</strong> a video inherits half of its channel’s profile, so a physics channel’s vaguely titled videos still count towards physics.
        </li>
        <li>
          <strong>Diminishing returns:</strong> within one channel and month, <code>n</code> videos weigh like <code>log₂(1+n)</code>. A weekend binge doesn’t outweigh years of steady interest.
        </li>
        <li>
          <strong>Learning vs. entertainment:</strong> lectures, explainers and the Education category count up to 1.3×; let’s-plays, reactions and compilations down to 0.7×. Music listening is used for taste only, never as interest in studying music.
        </li>
        <li>
          <strong>Deliberate choices count more:</strong> a subscription weighs 10× a single view, your own uploads and repositories even more.
        </li>
      </ul>

      <h2>3. Measuring interest fairly</h2>
      <p>Raw counts would make everyone a sports scientist: fitness and cooking are simply everywhere. So for each field we compare your share of content with how common that content is in general, as a log-lift:</p>
      <p>
        <code>lift = ln((your share + ε) / (baseline share + ε))</code>
      </p>
      <p>
        Then we shrink it towards zero when only a few items support it (<code>n / (n + 4)</code>), reward fields that show up across many months (persistence), and combine sources weighted by reliability and volume. A field that shows up strongly in two independent sources gets a bonus: your Reddit and your YouTube agreeing is better evidence than either alone.
      </p>

      <h2>4. The psychology</h2>
      <ul>
        <li>
          <strong>Interests (RIASEC):</strong> John Holland’s six interest types (Realistic, Investigative, Artistic, Social, Enterprising, Conventional) underpin most career guidance. Every field has a RIASEC profile; yours comes from 18 activity questions and from the fields you engage with. Congruence between the two is one of the best-replicated predictors of satisfaction and persistence in a major.
        </li>
        <li>
          <strong>Personality (Big Five):</strong> the Mini-IPIP (Donnellan et al., 2006), a validated 20-item public-domain scale. Personality explains less about major choice than interests do, so it gets a small weight. Without the questionnaire, music taste gives a weak estimate, clearly labelled as such.
        </li>
        <li>
          <strong>School subjects and values:</strong> what you enjoy and are good at, and what you want from work (salary, security, creativity, helping, impact), compared with what each field draws on and offers. For salary, US graduate earnings data is mixed in.
        </li>
      </ul>
      <p>
        The final match blends these components. Weights adapt: with lots of footprint data, interest leads; with little, the questionnaire carries more. Scores are relative: 90+ means a field stands out for you among all {FIELDS.length}, not that success is guaranteed.
      </p>

      <h2>Limits, honestly</h2>
      <ul>
        <li>Your footprint shows curiosity and attention, not ability or grades. That’s why the questionnaire asks about subjects.</li>
        <li>Shared accounts, autoplay and phases add noise. Persistence weighting and diminishing returns reduce it; they don’t remove it.</li>
        <li>Content in languages other than the five above is only partly understood.</li>
        <li>This is a starting point for exploring, not a verdict. Talk to students in the field, look at curricula, try an intro course.</li>
      </ul>

      <h2 id="data">Programme data</h2>
      <p>Programmes come from official open data, refreshed every week by an automated pipeline. Switzerland comes from the Federal Statistical Office: where a university has Bachelor or Master students in a subject, it teaches it.</p>
      <DataSources k={k} sources={sources} updated={meta?.updated} sample={sample} />
      <p>Fees shown are the published statutory or institutional fee for your citizenship where available, otherwise marked as approximate. Always check the programme page before applying.</p>
      <p className="mt-10">
        <Link href={k.r.start}>Try it →</Link>
      </p>
    </Page>
  )
}

export function PrivacyView({ site, base }: SiteProps) {
  const k = kit(site, base)
  if (k.locale !== 'en') {
    return rz(
      <Page title="Datenschutz" lead="Kurz: Wir speichern nichts. Dein Verlauf kommt nie bei uns an, die Analyse läuft in deinem Browser, und was sie behält, bleibt dort. Der ganze Code ist Open Source.">
        <h2>Wer verantwortlich ist</h2>
        <p>
          {OPERATOR ? `${OPERATOR}. ` : ''}Erreichbar unter <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. {k.site === 'ch' ? 'Massgebend ist das Schweizer Datenschutzgesetz (DSG). Für Nutzer:innen aus der EU gilt zusätzlich die DSGVO.' : 'Massgebend ist die Datenschutz-Grundverordnung (DSGVO), dazu das Schweizer Datenschutzgesetz (DSG).'}
        </p>

        <h2>Was wir speichern: nichts</h2>
        <p>
          Bei uns gibt es keine Datenbank, kein Konto und keine Kopie deiner Daten. Was die Analyse behält, eine Zusammenfassung, liegt nur im Speicher deines Browsers. Ein Klick auf «Alle meine Daten löschen» entfernt es. Zwei Dinge liegen nicht bei uns: Der Hoster Vercel führt kurz technische Protokolle, und wenn du bezahlst, speichert Stripe die Zahlung.
        </p>

        <h2>Open Source</h2>
        <p>
          Der ganze Code dieser Seite ist öffentlich, unter der MIT-Lizenz: <a href={SOURCE_URL}>{SOURCE_URL.replace(/^https:\/\//, '')}</a>. Dort kannst du nachlesen, welche Daten wohin gehen, und es selbst prüfen.
        </p>

        <h2>Was mit deinen Daten passiert</h2>
        <ul>
          <li>
            <strong>Verbundene Konten (YouTube, Spotify, Reddit):</strong> Du meldest dich beim Dienst selbst an. Er gibt deinem Browser einen Schlüssel mit reinem Lesezugriff. Der liegt nur im Sitzungsspeicher dieses Tabs und ist weg, wenn du ihn schliesst. Dein Browser holt die Daten direkt beim Dienst. Wir bekommen weder den Schlüssel noch die Daten.
          </li>
          <li>
            <strong>Exporte (Google Takeout, Spotify, Instagram, TikTok):</strong> Dateien, die du reinziehst, werden auf deinem Gerät gelesen und entpackt. Sie werden nicht hochgeladen.
          </li>
          <li>
            <strong>Was gespeichert bleibt:</strong> pro Quelle eine Zusammenfassung (wie viel deiner Inhalte zu welchem Fach gehört, ein paar Beispieltitel als Beleg, Zahlen), dazu deine Antworten im Fragebogen und deine Einstellungen. Alles im lokalen Speicher deines Browsers, nur auf deinem Gerät. «Alle meine Daten löschen» auf der Startseite entfernt es.
          </li>
          <li>
            <strong>Was wir bekommen:</strong> Für die Suche nach Studiengängen schickt dein Browser die Kennungen und Werte deiner Top-Fächer und deine Filter (Stufe, Länder, Budget, Herkunft). Nichts, was dich identifiziert, nichts aus deinem Verlauf.
          </li>
          <li>
            <strong>Bezahlung:</strong> läuft über Stripe. Wir erfahren, ob eine Zahlung erfolgt ist, nicht deine Kartendaten. Für die Zahlung gilt die Datenschutzerklärung von Stripe. Stripe kann Daten in die USA übermitteln.
          </li>
          <li>
            <strong>Hosting:</strong> Die Website läuft bei Vercel. Wie bei jeder Website fallen dort technische Protokolle an (IP-Adresse, Zeitpunkt, aufgerufene Seite), die Vercel kurz aufbewahrt. Aus deiner IP-Adresse leiten wir nur das Land ab, um den Preis in deiner Währung zu zeigen.
          </li>
        </ul>

        <h2>Google-Nutzerdaten</h2>
        <p>
          Die Nutzung und Weitergabe von Informationen aus Google-Schnittstellen hält sich an die <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, einschliesslich der Anforderungen zur eingeschränkten Nutzung (Limited Use). Wir verlangen nur den Lesezugriff <code>youtube.readonly</code>, um deine Abos, gelikten Videos, Playlists und Uploads zu lesen, und nutzen ihn nur, um dein Fächerprofil in deinem Browser zu berechnen. Die Daten gehen weder an uns noch an Dritte, werden nicht für Werbung genutzt und nicht zum Trainieren von KI-Modellen. Du kannst den Zugriff jederzeit unter <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> widerrufen.
        </p>
        <p>
          Diese Seite nutzt die YouTube API Services. Wenn du YouTube verbindest, gelten zusätzlich die <a href="https://www.youtube.com/t/terms">Nutzungsbedingungen von YouTube</a> und die <a href="https://policies.google.com/privacy">Datenschutzerklärung von Google</a>.
        </p>

        <h2>Cookies und Analyse</h2>
        <p>Wir setzen keine Tracking-Cookies und nutzen keine Analyse-Tools. Der Speicher im Browser dient nur den oben genannten Daten.</p>

        <h2>Deine Rechte</h2>
        <p>
          Über deine Nutzung der Analyse halten wir keine Personendaten. Es gibt bei uns also nichts herauszugeben oder zu löschen, du steuerst alles in deinem Browser. Für Zahlungsbelege oder Fragen: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Page>,
      k.locale,
    )
  }
  return (
    <Page title="Privacy" lead="Short version: we store nothing. Your history never reaches us, the analysis runs in your browser, and what it keeps stays there. All of the code is open source.">
      <h2>What we store: nothing</h2>
      <p>
        There is no database, no account and no copy of your data on our side. What the analysis keeps, a summary, lives only in your browser’s storage, and «Delete all my data» removes it. Two things are outside our hands: our host Vercel keeps short-lived technical logs, and if you pay, Stripe stores the payment.
      </p>

      <h2>Open source</h2>
      <p>
        All of this site’s code is public under the MIT licence: <a href={SOURCE_URL}>{SOURCE_URL.replace(/^https:\/\//, '')}</a>. You can read exactly which data goes where and check it yourself.
      </p>

      <h2>What happens to your data</h2>
      <ul>
        <li>
          <strong>Connected accounts (YouTube, Spotify, Reddit):</strong> you sign in with the service. It gives your browser a read-only access token, stored in this tab’s session storage only and gone when you close it. Your browser fetches your data directly from the service. We never receive the token or the data.
        </li>
        <li>
          <strong>Exports (Google Takeout, Spotify, Instagram, TikTok):</strong> files you drop are read and unpacked on your device. They are not uploaded.
        </li>
        <li>
          <strong>What is kept:</strong> a summary per source (how much of your content relates to each field, a few example titles as evidence, counts), your questionnaire answers and preferences. These are stored in your browser’s local storage, on your device only. “Delete all my data” on the start page removes them.
        </li>
        <li>
          <strong>What we receive:</strong> to look up programmes, your browser sends us the ids and scores of your top fields and your filters (level, countries, budget, citizenship category). Nothing that identifies you, and nothing from your history.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe. We receive whether a checkout session was paid, not your card details. Stripe’s privacy policy applies to the payment.
        </li>
        <li>
          <strong>Hosting:</strong> the site runs on Vercel, which keeps short-lived technical logs (IP address, time, page). We use your IP address only to infer your country and show the price in your currency.
        </li>
      </ul>

      <h2>Google user data</h2>
      <p>
        whatshouldistudy’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. We request the read-only scope <code>youtube.readonly</code> to read your subscriptions, liked videos, playlists and uploads, and use it only to compute your field-of-study profile in your browser. The data is not transferred to us or to third parties, not used for advertising, and not used to train AI models. You can revoke access at any time at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
      </p>
      <p>
        This site uses YouTube API Services. When you connect YouTube, the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a> and the <a href="https://policies.google.com/privacy">Google Privacy Policy</a> also apply.
      </p>

      <h2>Cookies and analytics</h2>
      <p>We set no tracking cookies. Browser storage is used only for the data described above.</p>

      <h2>Your rights</h2>
      <p>
        Because we don’t hold personal data about your use of the analysis, there is nothing for us to export or delete: you control it in your browser. For payment records, contact us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        {OPERATOR ? `. Controller: ${OPERATOR}.` : '.'}
      </p>
    </Page>
  )
}

export function TermsView({ site, base }: SiteProps) {
  const k = kit(site, base)
  if (k.locale !== 'en') {
    return rz(
      <Page title="AGB">
        <h2>Was du bekommst</h2>
        <p>
          {k.conf.name} gibt Orientierung, keine Garantie. Die Treffer sind Schätzungen aus den Daten, die du verbindest, und aus öffentlichen Daten zu Studiengängen. Diese können unvollständig oder veraltet sein. Prüf jeden Studiengang, jede Gebühr und jede Frist bei der Hochschule, bevor du dich anmeldest.
        </p>
        <h2>Der volle Report</h2>
        <p>
          Eine einmalige Zahlung schaltet den vollen Report frei, in dem Browser, in dem du bezahlt hast, für 12 Monate. Die wöchentlichen Aktualisierungen in dieser Zeit sind inbegriffen. Der Preis steht vor der Zahlung in deiner Währung. Klappt etwas nicht, melde dich innert 14 Tagen, dann gibt es das Geld zurück.
        </p>
        <h2>YouTube</h2>
        <p>
          Wenn du YouTube verbindest, akzeptierst du die <a href="https://www.youtube.com/t/terms">Nutzungsbedingungen von YouTube</a>. Was wir mit den Daten machen, steht in der Datenschutzerklärung.
        </p>
        <h2>Faire Nutzung</h2>
        <p>Die Schnittstelle für Studiengänge ist nicht zum automatischen Auslesen oder Weiterverkaufen gedacht. Die offenen Daten dahinter bleiben bei ihren Herausgebern unter deren Lizenzen frei verfügbar.</p>
        <h2>Datenquellen</h2>
        <p>
          Schweiz: Bundesamt für Statistik (BFS), freie Nutzung mit Quellenangabe. Deutschland: Studiensuche der Bundesagentur für Arbeit. Österreich: studienwahl.at (BMFWF). Weitere Länder: College Scorecard des US-Bildungsministeriums (gemeinfrei), Discover Uni (Office for Students, CC BY 4.0), Parcoursup (Licence Ouverte 2.0), OpenAlex (CC0), University Domains List (MIT).
        </p>
        {k.site !== 'ch' && (
          <>
            <h2>Widerrufsrecht</h2>
            <p>Du kannst den Kauf innert 14 Tagen ohne Angabe von Gründen widerrufen. Eine E-Mail an uns genügt, wir erstatten den vollen Betrag, auch wenn du den Report schon geöffnet hast.</p>
          </>
        )}
        <h2>Recht</h2>
        <p>{k.site === 'ch' ? 'Es gilt Schweizer Recht.' : 'Es gilt Schweizer Recht. Zwingende Verbraucherschutzvorschriften deines Wohnsitzstaates bleiben unberührt.'}</p>
        <h2>Kontakt</h2>
        <p>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </Page>,
      k.locale,
    )
  }
  return (
    <Page title="Terms">
      <h2>What you get</h2>
      <p>
        whatshouldistudy gives guidance, not a guarantee. Matches are estimates based on the data you provide and on public programme data, which can be incomplete or out of date. Check every programme, fee and deadline with the institution before you apply.
      </p>
      <h2>The full report</h2>
      <p>
        A one-time payment unlocks the full programme report in the browser you used to pay, for 12 months, including the weekly data updates during that time. If something doesn’t work, contact us within 14 days for a refund.
      </p>
      <h2>YouTube</h2>
      <p>
        By connecting YouTube you agree to be bound by the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>. What we do with the data is described in the privacy policy.
      </p>
      <h2>Fair use</h2>
      <p>Don’t scrape the programme API or resell its output. The underlying open data remains available from its original publishers under their licences.</p>
      <h2>Data sources</h2>
      <p>
        Programme data: U.S. Department of Education College Scorecard (public domain), Discover Uni dataset (Office for Students, CC BY 4.0), Parcoursup open data (Licence Ouverte 2.0), Swiss Federal Statistical Office (BFS, open use with attribution), Studiensuche of the German Federal Employment Agency, studienwahl.at (Austrian Federal Ministry of Science), OpenAlex (CC0), University Domains List (MIT).
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </Page>
  )
}

export function ImprintView({ site, base }: SiteProps) {
  const k = kit(site, base)
  const de = k.locale !== 'en'
  return rz(
    <Page title={de ? 'Impressum' : 'Imprint'}>
      <h2>{de ? 'Betreiber' : 'Operator'}</h2>
      <p>
        {OPERATOR ?? (de ? 'Angaben folgen.' : 'Details to follow.')}
        {OPERATOR_ADDRESS ? (
          <>
            <br />
            {OPERATOR_ADDRESS}
          </>
        ) : null}
      </p>
      <h2>{de ? 'Kontakt' : 'Contact'}</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
      <h2>{de ? 'Haftung' : 'Liability'}</h2>
      <p>
        {de
          ? 'Die Angaben zu Studiengängen stammen aus öffentlichen Daten und können unvollständig oder veraltet sein. Für Inhalte verlinkter Seiten sind deren Betreiber verantwortlich.'
          : 'Programme information comes from public data and can be incomplete or out of date. Linked sites are the responsibility of their operators.'}
      </p>
    </Page>,
    k.locale,
  )
}
