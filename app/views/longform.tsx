import Link from 'next/link'
import { USAGE_STATS } from '@/lib/usage-stats.ts'
import { productMeasureText } from '@/lib/site/product-measure-text.ts'
import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'
import { regionalize } from '@/lib/site/regional.ts'
import type { Locale } from '@/lib/site/config.ts'
import { getMeta } from '@/lib/server/data.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { CONTACT, SOURCE_URL } from '@/lib/site.ts'
import { CONSENT_MODE, GOOGLE_TAG, VERCEL_ANALYTICS } from '@/lib/measure.ts'
import { kit } from '@/lib/site/kit.ts'
import type { Kit } from '@/lib/site/kit.ts'
import type { SiteProps } from '@/lib/site/config.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { Sparkle } from '../ui/shapes.tsx'

/** Who runs the site, for the privacy notice and imprint. Set NEXT_PUBLIC_OPERATOR, e.g. «Vorname Name, Zürich». */
const OPERATOR = process.env.NEXT_PUBLIC_OPERATOR
const OPERATOR_ADDRESS = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS
/** A second fast way to reach us besides email (§ 5 DDG), e.g. a phone number. */
const OPERATOR_PHONE = process.env.NEXT_PUBLIC_OPERATOR_PHONE
/** Swiss UID (CHE-…) or VAT number, if there is one. */
const OPERATOR_UID = process.env.NEXT_PUBLIC_OPERATOR_UID
/** Representative in the EU under Art. 27 GDPR: name and address. */
const EU_REPRESENTATIVE = process.env.NEXT_PUBLIC_EU_REPRESENTATIVE

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
  const de = k.locale.startsWith('de-')
  const fr = k.locale === 'fr-CH'
  return (
    <>
      <p>
        {sample
          ? de
            ? 'Hier läuft gerade ein kleiner Demo-Datensatz.'
            : fr ? 'Un petit jeu de démonstration est affiché pour le moment.' : k.locale === 'it-CH' ? 'Al momento è visualizzato un piccolo set di dati dimostrativi.' : 'This deployment currently shows a small demo dataset.'
          : updated
            ? `${de ? 'Letzte Aktualisierung' : fr ? 'Dernière mise à jour' : k.locale === 'it-CH' ? 'Ultimo aggiornamento' : 'Last refresh'}: ${new Date(updated).toLocaleString(k.intl, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Zurich' })}.`
            : ''}
      </p>
      <ul>
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.url}>{s.name}</a> ({s.licence}): {fmtNumber(s.count, k.intl)} {s.id.startsWith('global') ? (de ? 'Hochschulen' : fr ? 'hautes écoles' : k.locale === 'it-CH' ? 'scuole universitarie' : 'institutions') : de ? 'Studiengänge' : fr ? 'formations' : k.locale === 'it-CH' ? 'corsi' : 'programmes'}
            {!s.ok && s.error ? (de ? ` (letzter Lauf fehlgeschlagen: ${s.error})` : fr ? ` (échec de la dernière mise à jour : ${s.error})` : k.locale === 'it-CH' ? ` (ultimo aggiornamento non riuscito: ${s.error})` : ` (last refresh failed; ${s.error})`) : ''}
          </li>
        ))}
      </ul>
    </>
  )
}

export async function HowView({ site, base, locale }: SiteProps) {
  const k = kit(site, base, locale)
  const { meta, sample } = await getMeta()
  const sources = meta?.sources ?? []
  if (k.locale === 'fr-CH') {
    return (
      <Page title="Comment ça marche" lead={`Nous analysons tes activités numériques, les comparons à ${FIELDS.length} domaines d’études et les mettons en regard de tes réponses. Voici les étapes et les limites du résultat.`}>
        <h2>1. Tes sources restent dans ton navigateur</h2>
        <p>Lorsque tu connectes YouTube, Spotify ou Reddit, tu t’authentifies directement auprès du service. Le jeton de lecture reste dans ton navigateur et les données sont récupérées depuis ton appareil. Les fichiers Google Takeout, Spotify, Instagram et TikTok sont également lus localement. Ils ne sont pas envoyés à notre serveur.</p>
        <ul>
          <li><strong>YouTube et Google :</strong> abonnements, vidéos aimées, playlists, historique de visionnage et recherches, ainsi que les pages, cartes et applications répertoriées dans Google Takeout.</li>
          <li><strong>Spotify :</strong> podcasts, épisodes enregistrés, livres audio, playlists et artistes les plus écoutés.</li>
          <li><strong>Instagram et TikTok :</strong> comptes suivis, recherches, thèmes, hashtags, publications aimées et enregistrées selon les données fournies par la plateforme.</li>
          <li><strong>Reddit et GitHub :</strong> communautés, publications enregistrées ou votées, dépôts publics et projets suivis.</li>
        </ul>
        <h2>2. Des signaux aux domaines d’études</h2>
        <p>Chaque élément est comparé à un lexique multilingue et à des thèmes associés aux domaines. Un abonnement ou un projet créé pèse davantage qu’une consultation isolée. Nous tenons compte de la répétition dans le temps, puis comparons la part de chaque domaine à sa fréquence générale. Les signaux provenant de sources différentes peuvent se renforcer.</p>
        <h2>3. Tes réponses complètent l’analyse</h2>
        <ul>
          <li><strong>Intérêts :</strong> le modèle RIASEC de John Holland décrit six types d’intérêts. Le questionnaire et les thèmes de ton historique contribuent à ton profil.</li>
          <li><strong>Personnalité :</strong> le Mini-IPIP de Donnellan et ses collègues (2006) contient 20 questions issues de l’International Personality Item Pool. La personnalité pèse moins que les intérêts dans le calcul.</li>
          <li><strong>Matières et priorités :</strong> tes matières préférées, tes points forts et ce que tu recherches dans un métier sont comparés aux contenus des domaines.</li>
        </ul>
        <h2>4. Ce que le résultat ne dit pas</h2>
        <ul>
          <li>Ton historique indique ce qui t’intéresse, pas tes notes ni tes compétences.</li>
          <li>Les comptes partagés, la lecture automatique et les intérêts passagers peuvent fausser le profil.</li>
          <li>Les contenus dans d’autres langues que le français, l’anglais, l’allemand, l’italien et l’espagnol sont moins bien reconnus.</li>
          <li>Le résultat est un point de départ. Vérifie les plans d’études et échange avec des étudiants avant de choisir.</li>
        </ul>
        <h2 id="donnees">Données sur les formations</h2>
        <p>Pour la Suisse, les données de l’Office fédéral de la statistique indiquent les effectifs par haute école, domaine et niveau. Une formation est répertoriée lorsqu’un établissement compte des étudiants en Bachelor ou en Master dans le domaine. Vérifie les intitulés, spécialisations et délais sur le site de l’établissement.</p>
        <DataSources k={k} sources={sources} updated={meta?.updated} sample={sample} />
        <p>Les frais affichés sont ceux publiés par l’établissement pour ta catégorie de nationalité, ou une estimation signalée comme telle. Confirme toujours les montants et conditions sur le site officiel.</p>
        <p className="mt-10"><Link href={k.r.start}>Essayer →</Link></p>
      </Page>
    )
  }
  if (k.locale === 'it-CH') {
    return (
      <Page title="Come funziona" lead={`Analizziamo le tue attività digitali, le confrontiamo con ${FIELDS.length} aree di studio e le mettiamo in relazione con le tue risposte. Ecco i passaggi e i limiti del risultato.`}>
        <h2>1. Le tue fonti restano nel browser</h2>
        <p>Quando colleghi YouTube, Spotify o Reddit, accedi direttamente al servizio. Il token di sola lettura resta nel browser e i dati vengono richiesti dal tuo dispositivo. Anche i file di Google Takeout, Spotify, Instagram e TikTok vengono letti localmente, senza essere caricati sul nostro server.</p>
        <ul>
          <li><strong>YouTube e Google:</strong> iscrizioni, video apprezzati, playlist, cronologia di visione e ricerche, oltre alle pagine, alle mappe e alle app presenti in Google Takeout.</li>
          <li><strong>Spotify:</strong> podcast, episodi salvati, audiolibri, playlist e artisti più ascoltati.</li>
          <li><strong>Instagram e TikTok:</strong> account seguiti, ricerche, temi, hashtag, post apprezzati e salvati, secondo i dati forniti dalla piattaforma.</li>
          <li><strong>Reddit e GitHub:</strong> comunità, post salvati o votati, repository pubblici e progetti seguiti.</li>
        </ul>
        <h2>2. Dai segnali alle aree di studio</h2>
        <p>Ogni elemento viene confrontato con un lessico multilingue e con i temi associati alle aree. Un’iscrizione o un progetto creato pesa più di una visita isolata. Consideriamo la ricorrenza nel tempo e confrontiamo la quota di ogni area con la sua frequenza generale. Segnali provenienti da fonti diverse possono rafforzarsi.</p>
        <h2>3. Le tue risposte completano l’analisi</h2>
        <ul>
          <li><strong>Interessi:</strong> il modello RIASEC di John Holland descrive sei tipi di interesse. Al profilo contribuiscono il questionario e i temi della tua cronologia.</li>
          <li><strong>Personalità:</strong> il Mini-IPIP di Donnellan e colleghi (2006) contiene 20 domande tratte dall’International Personality Item Pool. Nel calcolo la personalità pesa meno degli interessi.</li>
          <li><strong>Materie e priorità:</strong> confrontiamo le materie che ti piacciono, i tuoi punti di forza e ciò che cerchi in un lavoro con i contenuti delle aree.</li>
        </ul>
        <h2>4. Cosa non indica il risultato</h2>
        <ul>
          <li>La cronologia indica i tuoi interessi, non i voti o le competenze.</li>
          <li>Account condivisi, riproduzione automatica e interessi temporanei possono influenzare il profilo.</li>
          <li>I contenuti in lingue diverse da italiano, inglese, tedesco, francese e spagnolo vengono riconosciuti meno bene.</li>
          <li>Il risultato è un punto di partenza. Consulta i piani di studio e parla con gli studenti prima di scegliere.</li>
        </ul>
        <h2 id="dati">Dati sui corsi</h2>
        <p>Per la Svizzera, i dati dell’Ufficio federale di statistica mostrano gli iscritti per scuola universitaria, area e livello. Un corso è elencato quando un istituto ha studenti Bachelor o Master nell’area. Verifica nomi, indirizzi e scadenze sul sito dell’istituto.</p>
        <DataSources k={k} sources={sources} updated={meta?.updated} sample={sample} />
        <p>Le tasse mostrate corrispondono agli importi pubblicati per la tua categoria di cittadinanza oppure sono indicate come stime. Verifica sempre importi e requisiti sul sito ufficiale.</p>
        <p className="mt-10"><Link href={k.r.start}>Prova →</Link></p>
      </Page>
    )
  }
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
            <strong>Google Takeout:</strong> dein ganzer Wiedergabe- und Suchverlauf, Kommentare und Abos, dazu aus «Meine Aktivitäten» deine Google-Suchen, besuchte Seiten, Maps-Suchen, Apps, Bücher und Artikel. YouTube gibt den Wiedergabeverlauf nicht über die Schnittstelle heraus, deshalb dieser Umweg. Oft stecken Jahre drin. Werbeeinträge lesen wir nicht. Bist du im selben Tab mit YouTube angemeldet, fragt dein Browser bei YouTube die öffentlichen Angaben zu deinen bis zu 2'500 neusten Videos und 300 meistgeschauten Kanälen ab: Kategorie, Tags, Beschreibung und YouTubes eigene Themen. Dafür gehen die Video- und Kanal-Kennungen an YouTube, nicht an uns.
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
          <strong>Google Takeout:</strong> your full watch history and search history, comments and subscriptions, plus from «My Activity» your Google searches, pages you visited, Maps searches, apps, books and articles. YouTube doesn’t offer watch history through its API, so this is the way to get it, often years of it. Ad entries are skipped. If you are signed in with YouTube in the same tab, your browser asks YouTube for the public details of up to 2,500 of your newest videos and your 300 most watched channels: category, tags, description and YouTube’s own topics. The video and channel ids go to YouTube for that, not to us.
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

export function PrivacyView({ site, base, locale }: SiteProps) {
  const k = kit(site, base, locale)
  if (k.locale === 'fr-CH') {
    return (
      <Page title="Confidentialité" lead="Nous ne conservons pas ton historique. L’analyse se déroule dans ton navigateur et les résumés restent sur ton appareil.">
        <p><strong>Traduction :</strong> en cas de divergence, la version allemande fait foi.</p>
        <h2>Responsable</h2>
        <p>{OPERATOR ? `${OPERATOR}. ` : ''}Contact : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Le droit suisse de la protection des données s’applique. Le RGPD s’applique également lorsque la législation européenne le prévoit.</p>
        <h2>Ce que nous conservons</h2>
        <p>Nous n’avons ni compte ni base de données contenant tes réponses. Le résumé de l’analyse, tes réponses au questionnaire et tes préférences sont enregistrés dans le stockage local de ton navigateur. Tu peux tout supprimer depuis la page de démarrage. L’hébergeur Vercel conserve brièvement des journaux techniques. Stripe traite les paiements si tu achètes le rapport complet.</p>
        <h2>Sources connectées et fichiers</h2>
        <p>Pour YouTube, Spotify et Reddit, tu t’authentifies directement auprès du service. Le jeton de lecture reste dans la mémoire de session de l’onglet et disparaît lorsque tu le fermes. Ton navigateur récupère les données auprès du service. Les exports de Google Takeout, Spotify, Instagram et TikTok sont lus et décompressés sur ton appareil. Nous ne recevons ni ces fichiers ni les jetons.</p>
        <h2>Recherche de formations</h2>
        <p>Pour rechercher des formations, ton navigateur transmet les identifiants et scores de tes domaines principaux, jusqu’à 80 thèmes pondérés et tes filtres de recherche. Il ne transmet ni titres consultés, ni recherches, ni chaînes, ni noms permettant de t’identifier. Nous ne conservons pas cette requête.</p>
        <h2>Paiements et hébergement</h2>
        <p>Stripe traite le paiement et nous indique s’il a abouti, sans nous transmettre les données de ta carte. Le site est hébergé par Vercel, qui peut enregistrer temporairement l’adresse IP, l’heure et la page consultée. Nous utilisons l’adresse IP uniquement pour déterminer le pays et afficher la devise correspondante.</p>
        <h2>Données Google et YouTube</h2>
        <p>Notre utilisation des données Google respecte la <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, y compris les règles Limited Use. Nous demandons uniquement l’autorisation de lecture <code>youtube.readonly</code> afin de calculer ton profil dans ton navigateur. Ces données ne nous sont pas transmises, ne servent pas à la publicité et ne servent pas à entraîner des modèles d’IA. Tu peux révoquer l’accès sur <a href="https://myaccount.google.com/permissions">les autorisations de ton compte Google</a>. Les <a href="https://www.youtube.com/t/terms">conditions YouTube</a> et la <a href="https://policies.google.com/privacy">politique de confidentialité de Google</a> s’appliquent également.</p>
        <h2>Liens partagés</h2>
        <p>Le résultat partagé est placé après le caractère « # » dans le lien. Cette partie n’est pas envoyée aux serveurs. Toute personne disposant du lien peut voir les domaines, les scores et le profil qu’il contient. Le partage est facultatif.</p>
        <h2>Cookies et mesure</h2>
      {USAGE_STATS && <p>{productMeasureText(k.locale)}</p>}
        {!GOOGLE_TAG && !VERCEL_ANALYTICS && !USAGE_STATS && <p>Nous n’utilisons ni cookies de suivi ni outil d’analyse d’audience.</p>}
        {VERCEL_ANALYTICS && (
          <p>Vercel Web Analytics compte les pages vues sans cookies et sans identifiant qui te reconnaîtrait d’un jour à l’autre. Vercel reçoit pour cela la page consultée, la page de provenance, ton pays et le type d’appareil. Nous retirons auparavant de l’adresse les éléments comme les codes de connexion ou les numéros de paiement. Base juridique : notre intérêt légitime à savoir comment le site est utilisé (art. 6, al. 1, let. f RGPD).</p>
        )}
        {GOOGLE_TAG && (
          <>
            <p>Pour savoir quelles publicités amènent des visiteurs et combien d’entre eux achètent le rapport, nous utilisons Google Analytics et Google Ads de Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Irlande). Google dépose pour cela des cookies et apprend quelles pages tu consultes et si tu affiches un résultat, commences un achat ou paies, avec le montant et la devise. S’y ajoutent ton adresse IP et des informations sur le navigateur et l’appareil. Lors d’un achat, un hachage (SHA-256) de ton adresse e-mail est transmis à Google Ads afin d’attribuer l’achat à une annonce. L’adresse elle-même n’est pas transmise.</p>
            <p>Ton historique, tes sources, tes réponses, tes domaines et ton résultat n’entrent jamais dans cette mesure. Nous n’utilisons pas les données de l’interface YouTube à des fins publicitaires.</p>
            <p>La mesure dépend de l’endroit où tu te trouves. Depuis l’UE, l’EEE et le Royaume-Uni, nous ne déposons des cookies Google qu’avec ton consentement (art. 6, al. 1, let. a RGPD).{' '}
              {CONSENT_MODE === 'advanced'
                ? 'Sans consentement, la balise Google envoie seulement des signaux sans cookies, par exemple qu’une page a été consultée, à partir desquels Google fait des estimations.'
                : 'Sans consentement, la balise Google ne se charge pas.'}{' '}
              Depuis la Suisse et tous les autres pays, la mesure est active tant que tu ne la refuses pas (art. 45c LTC). Tu peux modifier ton choix à tout moment via « Paramètres des cookies » en bas de chaque page.</p>
            <p>Google peut transférer des données aux États-Unis et est certifié selon le EU-US Data Privacy Framework, y compris pour la Suisse. L’utilisation des données par Google est décrite sur <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>.</p>
          </>
        )}
        <h2>Tes droits et les mineurs</h2>
        <p>Nous ne détenons pas de données personnelles issues de l’analyse et ne pouvons donc pas exporter ou supprimer des données que nous ne possédons pas. Tu gères les données dans ton navigateur. Tu peux saisir l’autorité de protection des données de ton pays, en Suisse le Préposé fédéral à la protection des données et à la transparence. Pour toute question : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Si tu as moins de 16 ans, parles-en à tes parents avant de connecter des comptes ou d’effectuer un achat. En Autriche, cet âge est de 14 ans.</p>
      </Page>
    )
  }
  if (k.locale === 'it-CH') {
    return (
      <Page title="Privacy" lead="Non conserviamo la tua cronologia. L’analisi avviene nel browser e i riepiloghi restano sul tuo dispositivo.">
        <p><strong>Traduzione:</strong> in caso di differenze, fa fede la versione tedesca.</p>
        <h2>Titolare del trattamento</h2>
        <p>{OPERATOR ? `${OPERATOR}. ` : ''}Contatto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Si applica la legge svizzera sulla protezione dei dati. Il GDPR si applica inoltre quando previsto dalla normativa europea.</p>
        <h2>Cosa conserviamo</h2>
        <p>Non abbiamo account né banche dati con le tue risposte. Il riepilogo dell’analisi, le risposte al questionario e le preferenze vengono salvati nella memoria locale del browser. Puoi eliminarli dalla pagina iniziale. Il servizio di hosting Vercel conserva per poco tempo log tecnici. Se acquisti il report completo, Stripe gestisce il pagamento.</p>
        <h2>Account collegati e file</h2>
        <p>Per YouTube, Spotify e Reddit accedi direttamente al servizio. Il token di sola lettura resta nella memoria di sessione della scheda e scompare quando la chiudi. Il browser recupera i dati dal servizio. Gli export di Google Takeout, Spotify, Instagram e TikTok vengono letti e decompressi sul tuo dispositivo. Non riceviamo i file né i token.</p>
        <h2>Ricerca dei corsi</h2>
        <p>Per cercare i corsi, il browser invia gli identificativi e i punteggi delle tue aree principali, fino a 80 temi con il relativo peso e i filtri di ricerca. Non invia titoli consultati, ricerche, canali o nomi che possano identificarti. Non conserviamo la richiesta.</p>
        <h2>Pagamenti e hosting</h2>
        <p>Stripe gestisce il pagamento e ci comunica se è andato a buon fine, senza trasmetterci i dati della carta. Il sito è ospitato da Vercel, che può registrare temporaneamente indirizzo IP, ora e pagina visitata. Usiamo l’indirizzo IP solo per determinare il Paese e mostrare la valuta corretta.</p>
        <h2>Dati Google e YouTube</h2>
        <p>L’uso dei dati Google rispetta la <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, comprese le regole Limited Use. Richiediamo solo l’autorizzazione di lettura <code>youtube.readonly</code> per calcolare il profilo nel browser. I dati non ci vengono trasmessi, non sono usati per pubblicità né per addestrare modelli di IA. Puoi revocare l’accesso nelle <a href="https://myaccount.google.com/permissions">autorizzazioni del tuo account Google</a>. Si applicano anche i <a href="https://www.youtube.com/t/terms">termini di YouTube</a> e l’<a href="https://policies.google.com/privacy">informativa privacy di Google</a>.</p>
        <h2>Link condivisi</h2>
        <p>Il risultato condiviso si trova dopo il carattere «#» nel link. Questa parte non viene inviata ai server. Chiunque abbia il link può vedere aree, punteggi e profilo inclusi. La condivisione è facoltativa.</p>
        <h2>Cookie e misurazione</h2>
      {USAGE_STATS && <p>{productMeasureText(k.locale)}</p>}
        {!GOOGLE_TAG && !VERCEL_ANALYTICS && !USAGE_STATS && <p>Non usiamo cookie di tracciamento né strumenti di analisi.</p>}
        {VERCEL_ANALYTICS && (
          <p>Vercel Web Analytics conta le pagine visitate senza cookie e senza un identificativo che ti riconosca da un giorno all’altro. Per farlo Vercel riceve la pagina visitata, la pagina di provenienza, il tuo Paese e il tipo di dispositivo. Prima togliamo dall’indirizzo parti come codici di accesso o numeri di pagamento. Base giuridica: il nostro interesse legittimo a sapere come viene usato il sito (art. 6 par. 1 lett. f GDPR).</p>
        )}
        {GOOGLE_TAG && (
          <>
            <p>Per sapere quali annunci portano visitatori e quanti di loro acquistano il report, usiamo Google Analytics e Google Ads di Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Irlanda). Google imposta a questo scopo dei cookie e viene a sapere quali pagine visiti e se guardi un risultato, inizi un acquisto o paghi, con importo e valuta. A ciò si aggiungono il tuo indirizzo IP e informazioni su browser e dispositivo. In caso di acquisto, a Google Ads viene inviato un hash (SHA-256) del tuo indirizzo e-mail, per attribuire l’acquisto a un annuncio. L’indirizzo stesso non viene trasmesso.</p>
            <p>La tua cronologia, le tue fonti, le tue risposte, le tue aree e il tuo risultato non entrano mai in questa misurazione. Non usiamo i dati dell’interfaccia di YouTube per la pubblicità.</p>
            <p>La misurazione dipende da dove ti trovi. Dall’UE, dal SEE e dal Regno Unito impostiamo i cookie di Google solo con il tuo consenso (art. 6 par. 1 lett. a GDPR).{' '}
              {CONSENT_MODE === 'advanced'
                ? 'Senza consenso, il tag di Google invia solo segnali senza cookie, ad esempio che una pagina è stata visitata, da cui Google fa delle stime.'
                : 'Senza consenso, il tag di Google non viene caricato.'}{' '}
              Dalla Svizzera e da tutti gli altri Paesi la misurazione è attiva finché non la rifiuti (art. 45c LTC). Puoi cambiare la tua scelta in qualsiasi momento tramite «Impostazioni cookie» in fondo a ogni pagina.</p>
            <p>Google può trasferire dati negli Stati Uniti ed è certificata secondo l’EU-US Data Privacy Framework, anche per la Svizzera. Come Google usa i dati è spiegato su <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>.</p>
          </>
        )}
        <h2>Diritti e minori</h2>
        <p>Non deteniamo dati personali derivati dall’analisi e quindi non possiamo esportare o cancellare dati che non possediamo. Gestisci tutto nel browser. Puoi rivolgerti all’autorità per la protezione dei dati del tuo Paese; in Svizzera, all’Incaricato federale della protezione dei dati e della trasparenza. Per domande: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Se hai meno di 16 anni, parlane con i tuoi genitori prima di collegare account o acquistare. In Austria l’età è 14 anni.</p>
      </Page>
    )
  }
  if (k.locale !== 'en') {
    return rz(
      <Page title="Datenschutz" lead="Dein Verlauf kommt nie bei uns an, die Analyse läuft in deinem Browser, und was sie behält, bleibt dort. Der ganze Code ist Open Source.">
        <h2>Wer verantwortlich ist</h2>
        <p>
          {OPERATOR ? `${OPERATOR}. ` : ''}Erreichbar unter <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. {k.site === 'ch' ? 'Massgebend ist das Schweizer Datenschutzgesetz (DSG). Für Nutzer:innen aus der EU gilt zusätzlich die DSGVO.' : 'Massgebend ist die Datenschutz-Grundverordnung (DSGVO), dazu das Schweizer Datenschutzgesetz (DSG).'}
        </p>

        <h2>Was wir speichern: nichts</h2>
        <p>
          Bei uns gibt es keine Datenbank, kein Konto und keine Kopie deiner Daten. Was die Analyse behält, eine Zusammenfassung, liegt nur im Speicher deines Browsers. Ein Klick auf «Alle meine Daten löschen» entfernt es. Zwei Dinge liegen nicht bei uns: Der Hoster Vercel führt kurz technische Protokolle, und wenn du bezahlst, speichert Stripe die Zahlung.
          {GOOGLE_TAG && ' Dazu bekommt Google Messdaten zu unserer Werbung, wie unten unter «Cookies und Messung» beschrieben.'}
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
            <strong>Was wir bekommen:</strong> Für die Suche nach Studiengängen schickt dein Browser die Kennungen und Werte deiner Top-Fächer, bis zu 80 Themenwörter mit einer Gewichtung (etwa «theater» 0.8, damit einzelne Studiengänge nach deinen Themen sortiert werden) und deine Filter (Stufe, Länder, Budget, Herkunft), im Inhalt der Anfrage, nicht in der Adresse. Keine Titel, keine Suchanfragen, keine Kanäle, nichts, was dich identifiziert. Wir speichern die Anfrage nicht.
          </li>
          <li>
            <strong>Bezahlung:</strong> läuft über Stripe. Wir erfahren, ob eine Zahlung erfolgt ist, nicht deine Kartendaten. Für die Zahlung gilt die Datenschutzerklärung von Stripe. Stripe kann Daten in die USA übermitteln.
          </li>
          <li>
            <strong>Abos für Organisationen:</strong> Schliesst eine Schule oder Beratungsstelle ein Abo ab, speichert Stripe deren Namen, Rechnungsadresse, Steuernummer und E-Mail für Rechnungen. Schaltest du den Report über den Link deiner Schule frei, melden wir Stripe nur, dass das Abo einen Report verbraucht hat, zusammen mit einer zufälligen Kennung deines Browsers, damit du im selben Monat nicht doppelt zählst. Wer du bist und was dein Ergebnis ist, erfährt weder deine Schule noch Stripe.
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

        <h2>Geteilte Links</h2>
        <p>
          Wenn du dein Resultat teilst, steckt es im Link nach dem «#». Diesen Teil schicken Browser an keinen Server, auch nicht an uns. Er enthält deine Fächer, Prozente und dein Profil, keine Videos, Suchen oder Namen. Wer den Link hat, sieht diese Angaben. Teilen ist freiwillig.
        </p>

        <h2>Cookies und Messung</h2>
      {USAGE_STATS && <p>{productMeasureText(k.locale)}</p>}
        {!GOOGLE_TAG && !VERCEL_ANALYTICS && !USAGE_STATS && <p>Wir setzen keine Tracking-Cookies und nutzen keine Analyse-Tools.</p>}
        {VERCEL_ANALYTICS && (
          <p>
            Vercel Web Analytics zählt Seitenaufrufe ohne Cookies und ohne Kennung, die dich über mehrere Tage wiedererkennt. Vercel erfährt dafür die aufgerufene Seite, die verweisende Seite, dein Land und den Gerätetyp. Teile der Adresse wie Anmeldecodes oder Zahlungsnummern schneiden wir vorher ab.
          </p>
        )}
        {GOOGLE_TAG && (
          <>
            <p>
              Um zu sehen, welche Werbung Leute hierher bringt und wie viele davon den Report kaufen, nutzen wir Google Analytics und Google Ads von Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Irland). Google setzt dafür Cookies und erfährt, welche Seiten du aufrufst und ob du ein Resultat ansiehst, den Kauf beginnst oder bezahlst, mit Betrag und Währung. Dazu kommen deine IP-Adresse und Angaben zu Browser und Gerät. Bei einem Kauf geht ausserdem ein Hash deiner E-Mail-Adresse (SHA-256) an Google Ads, damit Google den Kauf einer Anzeige zuordnen kann. Die Adresse selbst geht nicht an Google.
            </p>
            <p>
              Dein Verlauf, deine Quellen, deine Antworten, deine Fächer und dein Resultat fliessen nie in diese Messung ein. Daten aus der YouTube-Schnittstelle nutzen wir nicht für Werbung.
            </p>
            <p>
              Ob die Messung läuft, hängt davon ab, wo du bist. Aus der EU, dem EWR und Grossbritannien setzen wir Google-Cookies erst, wenn du zustimmst.{' '}
              {CONSENT_MODE === 'advanced'
                ? 'Ohne Zustimmung schickt der Google-Tag nur Signale ohne Cookies, etwa dass eine Seite aufgerufen wurde, aus denen Google Zahlen hochrechnet.'
                : 'Ohne Zustimmung lädt der Google-Tag nicht.'}{' '}
              Aus der Schweiz und allen anderen Ländern läuft die Messung, bis du sie ablehnst. Deine Wahl änderst du jederzeit über «Cookie-Einstellungen» unten auf jeder Seite.
            </p>
            <p>
              Google kann Daten in die USA übermitteln und ist unter dem EU-US Data Privacy Framework zertifiziert, auch für die Schweiz. Wie Google die Daten nutzt, steht unter <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>.
            </p>
          </>
        )}
        <p>Den Speicher im Browser (localStorage) nutzen wir sonst nur für die oben genannten Daten{GOOGLE_TAG ? ' und deine Cookie-Wahl' : ''}. Du löschst ihn mit «Alle meine Daten löschen».</p>

        <h2>Rechtsgrundlagen</h2>
        <p>
          Die Analyse in deinem Browser und die Suche nach Studiengängen erfolgen, weil du sie anforderst (Art. 6 Abs. 1 lit. b DSGVO). Die Bezahlung dient dem Vertrag und den Aufbewahrungspflichten (lit. b und c). Die technischen Protokolle beim Hoster dienen dem sicheren Betrieb (lit. f). Vercel und Stripe sind unter dem EU-US Data Privacy Framework zertifiziert, auch für die Schweiz.
          {GOOGLE_TAG && ' Die Messung mit Google stützt sich in der EU, im EWR und in Grossbritannien auf deine Einwilligung (lit. a, in Deutschland zusätzlich § 25 TDDDG, in Österreich § 165 TKG), in der Schweiz auf Art. 45c FMG mit der Möglichkeit, abzulehnen.'}
          {VERCEL_ANALYTICS && ' Die Besuchszählung von Vercel dient unserem berechtigten Interesse zu wissen, wie die Seite genutzt wird (lit. f).'}
        </p>
        {EU_REPRESENTATIVE && (
          <>
            <h2>Vertreter in der EU</h2>
            <p>{EU_REPRESENTATIVE}</p>
          </>
        )}

        <h2>Bist du unter 16?</h2>
        <p>In Österreich gilt das ab 14. Sprich mit deinen Eltern, bevor du Konten verbindest oder etwas kaufst. Exporte, die du reinziehst, bleiben ohnehin auf deinem Gerät.</p>

        <h2>Deine Rechte</h2>
        <p>
          Über deine Nutzung der Analyse halten wir keine Personendaten. Es gibt bei uns also nichts herauszugeben oder zu löschen, du steuerst alles in deinem Browser. Du kannst dich bei einer Aufsichtsbehörde beschweren: in der Schweiz beim EDÖB, in der EU bei der Datenschutzbehörde deines Landes. Für Zahlungsbelege oder Fragen: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Page>,
      k.locale,
    )
  }
  return (
    <Page title="Privacy" lead="Your history never reaches us, the analysis runs in your browser, and what it keeps stays there. All of the code is open source.">
      <h2>What we store: nothing</h2>
      <p>
        There is no database, no account and no copy of your data on our side. What the analysis keeps, a summary, lives only in your browser’s storage, and «Delete all my data» removes it. Two things are outside our hands: our host Vercel keeps short-lived technical logs, and if you pay, Stripe stores the payment.
        {GOOGLE_TAG && ' Google also receives measurement data about our ads, as described under «Cookies and measurement» below.'}
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
          <strong>What we receive:</strong> to look up programmes, your browser sends us the ids and scores of your top fields, up to 80 topic words with a weight (say “theatre” 0.8, so single programmes can be sorted by your topics) and your filters (level, countries, budget, citizenship category). No titles, no searches, no channels, nothing that identifies you. We don’t store the request.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe. We receive whether a checkout session was paid, not your card details. Stripe’s privacy policy applies to the payment.
        </li>
        <li>
          <strong>Plans for organisations:</strong> when a school or counselling service subscribes, Stripe stores its name, billing address, tax number and email for invoices. If you unlock the report through your school’s link, we only tell Stripe that the plan used one report, with a random id of your browser so you don’t count twice in the same month. Neither your school nor Stripe learns who you are or what your result is.
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

      <h2>Cookies and measurement</h2>
      {USAGE_STATS && <p>{productMeasureText(k.locale)}</p>}
      {!GOOGLE_TAG && !VERCEL_ANALYTICS && !USAGE_STATS && <p>We set no tracking cookies and use no analytics tools.</p>}
      {VERCEL_ANALYTICS && (
        <p>
          Vercel Web Analytics counts page views without cookies and without an identifier that recognises you across days. Vercel sees the page, the referring page, your country and the device type. We cut parts of the address such as sign-in codes or payment ids before sending.
        </p>
      )}
      {GOOGLE_TAG && (
        <>
          <p>
            To see which ads bring people here and how many of them buy the report, we use Google Analytics and Google Ads by Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Ireland). Google sets cookies for this and learns which pages you open and whether you view a result, start checkout or pay, with amount and currency, along with your IP address and browser and device details. When you buy, a hash of your email address (SHA-256) also goes to Google Ads so Google can match the purchase to an ad. The address itself does not.
          </p>
          <p>Your history, your sources, your answers, your fields and your result never go into this measurement. Data from the YouTube API is not used for advertising.</p>
          <p>
            Whether it runs depends on where you are. From the EU, the EEA and the UK we set Google cookies only after you agree.{' '}
            {CONSENT_MODE === 'advanced'
              ? 'Without consent the Google tag sends only cookieless signals, such as that a page was opened, which Google uses to estimate totals.'
              : 'Without consent the Google tag does not load.'}{' '}
            From Switzerland and all other countries measurement runs until you refuse it. You can change your choice at any time under «Cookie settings» at the bottom of every page.
          </p>
          <p>
            Google may transfer data to the US and is certified under the EU-US Data Privacy Framework. How Google uses the data: <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>.
          </p>
        </>
      )}
      <p>Otherwise browser storage is used only for the data described above{GOOGLE_TAG ? ' and your cookie choice' : ''}.</p>

      <h2>Your rights</h2>
      <p>
        Because we don’t hold personal data about your use of the analysis, there is nothing for us to export or delete: you control it in your browser. For payment records, contact us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        {OPERATOR ? `. Controller: ${OPERATOR}.` : '.'}
      </p>
    </Page>
  )
}

export function TermsView({ site, base, locale }: SiteProps) {
  const k = kit(site, base, locale)
  if (k.locale === 'fr-CH') {
    return (
      <Page title="Conditions">
        <p><strong>Traduction :</strong> en cas de divergence, la version allemande fait foi.</p>
        <h2>Service</h2><p>{k.conf.name} fournit une orientation, pas une garantie. Les correspondances sont des estimations fondées sur tes données et sur des informations publiques qui peuvent être incomplètes ou obsolètes. Vérifie les formations, les frais et les délais auprès de l’établissement avant de déposer ta candidature.</p>
        <h2>Rapport complet</h2><p>Un paiement unique débloque le rapport complet dans le navigateur utilisé lors de l’achat, pour une durée de 12 mois. Les mises à jour hebdomadaires sont incluses. En cas de problème, contacte-nous dans les 14 jours pour demander un remboursement.</p>
        <h2>YouTube et utilisation équitable</h2><p>En connectant YouTube, tu acceptes ses <a href="https://www.youtube.com/t/terms">conditions d’utilisation</a>. N’extrais pas automatiquement les données de l’interface des formations et ne revends pas ses résultats. Les données ouvertes restent disponibles auprès de leurs éditeurs selon leurs licences.</p>
        <h2>Sources des données</h2><p>Suisse : Office fédéral de la statistique et studyprogrammes.ch (swissuniversities). Allemagne : Bundesagentur für Arbeit. Autriche : studienwahl.at (ministère fédéral). Autres sources : College Scorecard, Discover Uni, Parcoursup, OpenAlex et University Domains List, selon les licences indiquées par leurs éditeurs.</p>
        <h2>Droit applicable et contact</h2><p>Le droit suisse s’applique, sous réserve des règles impératives de protection des consommateurs. Contact : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </Page>
    )
  }
  if (k.locale === 'it-CH') {
    return (
      <Page title="Condizioni">
        <p><strong>Traduzione:</strong> in caso di differenze, fa fede la versione tedesca.</p>
        <h2>Servizio</h2><p>{k.conf.name} offre un orientamento, non una garanzia. Le corrispondenze sono stime basate sui dati forniti e su informazioni pubbliche che possono essere incomplete o non aggiornate. Prima di candidarti, verifica corsi, tasse e scadenze presso l’istituto.</p>
        <h2>Report completo</h2><p>Un pagamento unico sblocca il report completo nel browser usato per l’acquisto per 12 mesi. Gli aggiornamenti settimanali sono inclusi. Se qualcosa non funziona, contattaci entro 14 giorni per chiedere un rimborso.</p>
        <h2>YouTube e uso corretto</h2><p>Collegando YouTube accetti i suoi <a href="https://www.youtube.com/t/terms">termini di servizio</a>. Non estrarre automaticamente i dati dall’interfaccia dei corsi e non rivendere i risultati. I dati aperti restano disponibili presso gli editori originali secondo le relative licenze.</p>
        <h2>Fonti dei dati</h2><p>Svizzera: Ufficio federale di statistica e studyprogrammes.ch (swissuniversities). Germania: Bundesagentur für Arbeit. Austria: studienwahl.at (ministero federale). Altre fonti: College Scorecard, Discover Uni, Parcoursup, OpenAlex e University Domains List, secondo le licenze dei rispettivi editori.</p>
        <h2>Legge applicabile e contatto</h2><p>Si applica il diritto svizzero, fatte salve le norme inderogabili di tutela dei consumatori. Contatto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </Page>
    )
  }
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
          Schweiz: Bundesamt für Statistik (BFS: Studierende, Absolventenbefragung), freie Nutzung mit Quellenangabe; Studienangebote von studyprogrammes.ch (swissuniversities). Deutschland: Studiensuche der Bundesagentur für Arbeit. Österreich: studienwahl.at (BMFWF). Weitere Länder: College Scorecard des US-Bildungsministeriums (gemeinfrei), Discover Uni (Office for Students, CC BY 4.0), Parcoursup (Licence Ouverte 2.0), OpenAlex (CC0), University Domains List (MIT).
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
        Programme data: U.S. Department of Education College Scorecard (public domain), Discover Uni dataset (Office for Students, CC BY 4.0), Parcoursup open data (Licence Ouverte 2.0), Swiss Federal Statistical Office (BFS: enrolment and graduate survey, open use with attribution), studyprogrammes.ch (swissuniversities), Studiensuche of the German Federal Employment Agency, studienwahl.at (Austrian Federal Ministry of Science), OpenAlex (CC0), University Domains List (MIT).
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </Page>
  )
}

export function ImprintView({ site, base, locale }: SiteProps) {
  const k = kit(site, base, locale)
  if (k.locale === 'fr-CH' || k.locale === 'it-CH') {
    const fr = k.locale === 'fr-CH'
    return (
      <Page title={fr ? 'Mentions légales' : 'Note legali'}>
        <p><strong>{fr ? 'Traduction :' : 'Traduzione:'}</strong> {fr ? 'en cas de divergence, la version allemande fait foi.' : 'in caso di differenze, fa fede la versione tedesca.'}</p>
        <h2>{fr ? 'Éditeur et responsable du contenu' : 'Editore e responsabile dei contenuti'}</h2>
        <p>{OPERATOR ?? (fr ? 'Informations à compléter.' : 'Informazioni da completare.')}{OPERATOR_ADDRESS ? <><br />{OPERATOR_ADDRESS}</> : null}</p>
        <h2>{fr ? 'Contact' : 'Contatto'}</h2><p><a href={`mailto:${CONTACT}`}>{CONTACT}</a>{OPERATOR_PHONE ? <><br />{fr ? 'Téléphone' : 'Telefono'}: {OPERATOR_PHONE}</> : null}</p>
        {OPERATOR_UID && <><h2>{fr ? 'Numéro d’identification' : 'Numero identificativo'}</h2><p>{OPERATOR_UID}</p></>}
        <h2>{fr ? 'Activité' : 'Attività'}</h2><p>{fr ? 'Orientation en ligne pour les études : analyse de données personnelles dans le navigateur et suggestions de domaines et de formations.' : 'Orientamento online agli studi: analisi dei dati personali nel browser e suggerimenti di aree e corsi di studio.'}</p>
        {EU_REPRESENTATIVE && <><h2>{fr ? 'Représentant dans l’UE (art. 27 RGPD)' : 'Rappresentante nell’UE (art. 27 GDPR)'}</h2><p>{EU_REPRESENTATIVE}</p></>}
        <h2>{fr ? 'Responsabilité' : 'Responsabilità'}</h2><p>{fr ? 'Les informations sur les formations proviennent de données publiques et peuvent être incomplètes ou obsolètes. Le contenu des sites liés relève de leurs éditeurs.' : 'Le informazioni sui corsi provengono da dati pubblici e possono essere incomplete o non aggiornate. I contenuti dei siti collegati sono responsabilità dei rispettivi gestori.'}</p>
      </Page>
    )
  }
  const de = k.locale !== 'en'
  return rz(
    <Page title={de ? 'Impressum' : 'Imprint'}>
      <p>
        {de
          ? 'Angaben nach § 5 DDG (Deutschland), § 5 ECG und § 25 MedienG (Österreich) sowie Art. 3 Abs. 1 lit. s UWG (Schweiz).'
          : 'Information under § 5 DDG (Germany), § 5 ECG and § 25 MedienG (Austria) and Art. 3(1)(s) UWG (Switzerland).'}
      </p>
      <h2>{de ? 'Anbieter und Medieninhaber' : 'Provider'}</h2>
      <p>
        {OPERATOR ? `${OPERATOR}, ${de ? 'Einzelunternehmen' : 'sole proprietorship'}` : de ? 'Angaben folgen.' : 'Details to follow.'}
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
        {OPERATOR_PHONE ? (
          <>
            <br />
            {de ? 'Telefon' : 'Phone'}: {OPERATOR_PHONE}
          </>
        ) : null}
      </p>
      {OPERATOR_UID && (
        <>
          <h2>{de ? 'Unternehmens-Identifikationsnummer' : 'Business ID'}</h2>
          <p>{OPERATOR_UID}</p>
        </>
      )}
      <h2>{de ? 'Unternehmensgegenstand' : 'Business purpose'}</h2>
      <p>
        {de
          ? 'Online-Studienorientierung: Auswertung eigener Daten im Browser und Vorschläge für Studienfächer und Studiengänge.'
          : 'Online study guidance: analysing your own data in your browser and suggesting fields of study and programmes.'}
      </p>
      {EU_REPRESENTATIVE && (
        <>
          <h2>{de ? 'Vertreter in der EU (Art. 27 DSGVO)' : 'EU representative (Art. 27 GDPR)'}</h2>
          <p>{EU_REPRESENTATIVE}</p>
        </>
      )}
      <h2>{de ? 'Streitbeilegung' : 'Dispute resolution'}</h2>
      <p>
        {de
          ? 'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'
          : 'We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.'}
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
