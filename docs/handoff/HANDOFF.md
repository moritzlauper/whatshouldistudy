# Übergabe (Stand 12.10.2026)

Für die nächste Person oder den nächsten Agenten, die hier weiterarbeiten. Zuerst `AGENTS.md` lesen, die Regeln dort gelten (Paywall nicht umgehen, Next.js-Doku in `node_modules/next/dist/docs/`).

## Österreich: offene Studiengangsdaten (28.10.2026)

- Antwort von studienwahl.at auf die Anfrage: Die Daten zum Studienangebot stehen als offene Daten auf data.gv.at, Lizenz CC BY 4.0. Der Datensatz heisst «Studiengänge», veröffentlichende Stelle ist das BMFWF. Alle drei Distributionen nennen `https://creativecommons.org/licenses/by/4.0/`. Das habe ich im Browser auf data.gv.at selbst geprüft. Die Seite trägt «Aktualisiert: 14. November 2024». Ob der Stand aktuell ist, habe ich nicht ausgewertet.
- Maschinenlesbarer Abruf laut Antwort: `https://extapp.noc-science.at/apex/shibb/api/v1/studien` (JSON, 2'556 Einträge). Die Distributionen auf data.gv.at habe ich nicht heruntergeladen. Dass Endpunkt und Datensatz identisch sind, ist deshalb nicht bestätigt.
- `scrapers/at-hochschulen.ts` liest das JSON mit einem Abruf statt die HTML-Liste auf studienwahl.at zu lesen. Lauf am 28.10.2026: 2'364 Programme aus 2'556 Datensätzen (1'047 Universitäten, 593 FH, 356 Kunsthochschulen, 253 Privat, 115 PH). Doktorate, Lizentiate und Weiterbildung bleiben aussen vor, wie vorher.
- Österreich ist nicht mehr `LINK_ONLY`. `at-studienwahl` steht in `PROGRAMME_SOURCES` mit Quellenangabe CC BY 4.0 in `SOURCES` (`scrapers/build.ts`) und hat einen Workflow-Schritt. Deutschland bleibt im Link-Modus.
- Verlinkung pro Programm: Studienseite der Hochschule (`studieninfourl_de`, sonst `uniurl_de`), sonst die Suche auf studienwahl.at.
- Texte: Angepasst sind die Österreich- und Deutschland-Texte in `lib/site/dict.ts` und `app/views/longform.tsx`. Die Kosten für Österreich bleiben Richtwerte je Hochschultyp (`lib/at-institutions.ts`).
- Demo-Daten neu gebaut mit `node scrapers/build.ts --sample`, Fixture `scrapers/fixtures/at-studienwahl.json` mit 60 Einträgen neu erzeugt.
- Offen: Das Validierungs-Manifest ist nicht neu erzeugt. Die Prüfsumme von `app/ui/questionnaire-form.tsx` war schon vor dieser Änderung veraltet (Commit 233783d). Vor `npm run validation:bundle` muss die Fragebogen-Änderung geprüft werden. Bis dahin schlägt der Test «release manifest matches» fehl, wie schon vorher.
- Offen: Ob der Lauf im Workflow durchgeht und die AT-Zahlen dort gleich ausfallen, zeigt der nächste Wochenlauf. Einzelne Studienseiten der Hochschulen habe ich nicht abgerufen.

## Widerrufsrecht und Studiengangdaten DE/AT (24.10.2026)

- Anlass: Ein Käufer aus Deutschland hat einen Kauf auf wasstudieren.ch widerrufen (fehlende Widerrufsbelehrung, keine Zustimmung nach § 356 Abs. 5 BGB). Erstattet am 24.10.2026 im Stripe-Dashboard; der CLI-Schlüssel darf keine Erstattungen auslösen.
- Entscheid des Inhabers: Das Widerrufsrecht von 14 Tagen gilt auf allen Seiten und für Käufe aus jedem Land, auch nach dem Öffnen des Reports. Deshalb gibt es im Checkout keine Verzichts-Checkbox. Texte in `lib/site/withdrawal-text.ts`, siehe README unter *Paywall*.
- Entscheid des Inhabers: **Keine Leser für Hochschul-Websites in Deutschland und Österreich.** Anders als die Schweiz kennen beide Länder das Datenbankherstellerrecht (§ 87a ff. UrhG DE, § 76c ff. UrhG AT). Das Abmahnrisiko will der Inhaber nicht tragen. Der Abschnitt «Deutschland und Österreich: Studiengänge von den Hochschul-Websites» weiter unten ist damit zurückgestellt. DE/AT bleiben im Link-Modus (`LINK_ONLY`, `PERMISSION_PENDING`), bis eine schriftliche Zusage vorliegt.
- Recherche: Die Studiensuche der BA stammt aus dem Hochschulkompass der HRK; die BA ist dort Kooperationspartner mit eigener Suche. Eine Zusage der BA allein reicht also nicht, Rechteinhaberin ist die Stiftung zur Förderung der HRK. Die HRK liefert Kooperationspartnern mit bundesweiter Studiengangsuche einen Datenexport (Partner unter anderem BA, DAAD, ZEIT ONLINE). Bedingungen nicht öffentlich, Kontakt hochschulkompass@hrk.de.
- Österreich: studienwahl.at gehört laut Impressum dem BMFWF (Medieninhaber), OeAD wird dort nicht genannt. Antrag nach § 6 IWG 2022 an studienwahl@bmfwf.gv.at entworfen (kommerzielle Weiterverwendung, § 5 Abs. 1; kein Datenbankherstellerrecht gegen die Weiterverwendung, § 2 Abs. 4; Antwortfrist vier Wochen ab Eingang, § 6 Abs. 3). Eine erste Anfrage mit Hinweis auf das IWG ging schon am 10.10.2026 an dieselbe Adresse (privates Outreach-Repo, `letters/`); der neue Antrag ist deshalb als Nachfrage gedacht.
- Anfragen an die Hochschulen selbst: Am 24.10.2026 gingen 33 Mails an Universitäten in DE und AT (die Liste aus dem Abschnitt unten ohne Universität Wien, Universität Salzburg, TU Dresden und HU Berlin, für die keine öffentlich lesbare Adresse zu finden war). Gefragt wird, ob wir Name, Abschluss, Sprache, Dauer, Ort und Link von ihrer Übersicht übernehmen dürfen. Einen Leser nur für Hochschulen bauen, die schriftlich zugestimmt haben. Adressen und Antworten liegen im privaten Outreach-Repo.

## Weiterbildung MAS, DAS, CAS (22.10.2026)

- Auftrag: MAS und CAS aufnehmen, «eher sekundär oder separat». Umgesetzt als eigene Quelle `ch-weiterbildung` mit eigenen Stufen `mas`, `das`, `cas` (Executive MBAs zählen als MAS).
- Datenquelle: Die Weiterbildungsliste von swissuniversities (studyprogrammes.ch, API-Stufen 3 bis 5, rund 1'750 Einträge) wäre vollständig, steht aber auf `PERMISSION_PENDING` und wird nicht verwendet. Stattdessen liest `scrapers/ch-weiterbildung.ts` die Listen der Hochschulen selbst, nur Listen und keine Programmseiten: ZHAW (Angebotsfinder je Typ, alle Seiten), FHNW (Plone-Suche `++api++/de/@search`, mit Gebühr, Sprache, Ort; PH FHNW als eigene Hochschule), BFH (gleiche Suche wie bei den Studiengängen), Universität Basel (Advanced Studies je Typ), Université de Genève (eine Seite mit allen Karten, vergangene Durchführungen ausgeschlossen), Universität Luzern (Menü der Weiterbildung).
- Offen: ETH (SCE), UZH, HSG (Executive School), UNIL/EPFL, Freiburg, Universität Bern und HSLU laden ihre Listen nur im Browser oder über Schnittstellen, die robots.txt sperrt (HSLU `/api/`). Bern hat eine Filterliste mit 24 Einträgen pro Seite ohne erkennbare Seitenparameter.
- Fächer: eigene Regeltabelle `WB_TITLES` vor dem allgemeinen Abgleich (Beratung, Schule, Pflege, Bau, Verwaltung usw.), breite Wörter wie «Management» oder «Gesundheit» nur als Rückfall. Module ohne eigenen Abschluss (Master-Thesis, Masterarbeit-Modul) fallen weg. Bei den Probeseiten blieben 9 von 903 Angeboten ohne Fach, fast alle solche Module.
- Website: Rangliste nur bei der neuen Wahl «Weiterbildung (MAS, DAS, CAS)» im Einstellungsformular, nur auf der Schweizer Seite; «Beides» umfasst weiterhin nur Studiengänge. Gebühr als «Kosten gesamt» (`tuition.total`). Fachseiten: eigener Abschnitt nach den Studiengängen mit eigenem Zeilenbudget; Titel, Zahlen, Orte und Sprachen zählen nur Studiengänge. Zulassung auf Katalogseiten mit eigenem Text statt der Matura-Regel. `meta.byCountry.CH.continuing` zählt die Weiterbildungen separat, Sitemaps zählen sie mit.
- Kosten: Der Fakten-Lauf (`programme-facts.ts`, Claude-API) liest keine Weiterbildungen. Keine zusätzlichen API-Kosten.
- Der Budgetfilter vergleicht bei Weiterbildungen die Gesamtkosten mit dem Jahresbudget, also eher streng.

## SEO der Schweizer Fach- und Studiengangseiten (22.10.2026)

- Auftrag: mehr Suchtreffer auf wasstudieren.ch über die Fachseiten. Technische Basis war bereits in Ordnung (Canonical auf wasstudieren.ch bzw. whatshouldistudy.ch/fr|it, hreflang DE/FR/IT/EN, Sitemaps).
- Fachseiten (`/studiengaenge/[fach]`): neuer Absatz unter der Einleitung mit Studienorten (meiste Studiengänge zuerst, bis 8, dann «und N weiteren Orten») und Unterrichtssprachen mit Anzahl. Meta-Beschreibung nennt die vier wichtigsten Orte statt der allgemeinen Schlussformel, Länge jetzt rund 140 bis 155 Zeichen. Ortsnamen pro Sprache (`townName` in `lib/site/labels.ts`): Genf/Genève/Ginevra/Geneva, Zürich/Zurich/Zurigo usw.
- Studiengangseiten: Titel mit Ort, wenn der Hochschulname ihn nicht enthält und der Titel höchstens 60 Zeichen hat («Master Applied Physics · EPFL, Lausanne»). Meta-Beschreibung endet mit der ersten Besonderheit aus der Lesung, sonst mit den Vertiefungen, sonst wie bisher. JSON-LD `EducationalOccupationalProgram` erhält `teaches` mit den Vertiefungen und `description` mit den Besonderheiten.
- Duplikate: Die EPFL-Liste verlinkt `applied-physic/` (301 auf `applied-physics/`) neben `applied-physics/`, daher zwei Seiten für denselben Master. `withoutRedirects` in `scrapers/ch-hochschulen.ts` entfernt Listenlinks, die nur auf einen anderen gelisteten Studiengang derselben Stufe weiterleiten. Wirkt ab dem nächsten Datenlauf; die alte Adresse leitet dann über `findByName` dauerhaft auf die verbleibende weiter. Nicht behoben: UNIGE «Systèmes et services numériques» hat zwei echte Seiten (`…` und `…-1`), beide HTTP 200.
- Geprüft: 334 Tests bestanden, 0 fehlgeschlagen; Typprüfung ohne Fehler in den geänderten Dateien. Lokal mit Produktionsdomains (Host-Header) und nachgebildetem Fakten-Store gerendert, DE/FR/IT. Nicht geprüft: Wirkung in der Search Console (dauert Wochen).
- Hinweis: `scrapers/ch-weiterbildung.ts` lag beim Commit unversioniert im Arbeitsverzeichnis und hat Typfehler; nicht Teil dieser Arbeit und nicht eingecheckt.

## Besonderheiten auf Schweizer Studiengangseiten (22.10.2026)

- Auftrag des Inhabers: Die studiengangspezifischen Angaben aus den Lesungen sollen auf den Schweizer Studiengangseiten stehen. Bisher zeigten nur die Fachseiten die Namen der Vertiefungen, die Detailseite nichts davon.
- Neu: Karte «Von der offiziellen Seite» auf `/studiengaenge/[fach]/[studiengang]` (DE/FR/IT/EN) mit «Was den Studiengang besonders macht» in der Seitensprache, den Vertiefungen, dem Lesedatum und einem Link auf die gelesene Seite (`OfficialReading` in `app/views/programme.tsx`, `publicReading` in `lib/facts-store.ts`). Nur für CH (`READING_COUNTRIES`). Nicht übersetzte Altaussagen bleiben weg.
- Bewusst weiterhin nur im bezahlten Report: Interessenprofil, Themen, «Abklären», persönliche Passung und Begründungen. `/api/facts`, Tokenprüfung und Checkout unverändert.
- Geprüft: Typprüfung, 330 Tests bestanden, 0 fehlgeschlagen (neu: Locale-Auswahl und kein Durchsickern von Profil/Abklären). Lokal mit nachgebildetem Store gerendert, DE und FR. Ob der EPFL-Studiengang `3b1hoca0g4` produktiv eine Lesung hat, war lokal nicht prüfbar (keine Store-Zugangsdaten); die Seiten sind ISR mit einem Tag Revalidierung.

## Outreach erneut gestoppt (20.10.2026)

- Neuer ausdrücklicher Auftrag des Inhabers: alle automatischen Outreach-Mails stoppen und pushen. Dieser Auftrag ersetzt die weiter unten dokumentierte Wiederaktivierung vom selben Tag.
- Im separaten Repository `moritzlauper/whatshouldistudy-outreach` sind «Outreach prüfen» (377367573) und «Einzelmails verschicken» (379790874) serverseitig deaktiviert. Nach der Deaktivierung keine laufenden oder wartenden Actions-Aufträge vorhanden.
- Der tägliche Outreach-Zeitplan wurde aus `check.yml` entfernt; beide Versandjobs sind zusätzlich mit `if: ${{ false }}` gesperrt. Nur auf erneuten ausdrücklichen Auftrag reaktivieren. Die separate Blog-Automation bleibt aktiv.

## Google-Ads-Paywall: A/B-Test mit automatischer Auswahl (20.10.2026)

- Auftrag: direkte Zahlung im Hero gegen Gratis-Einstieg mit späterem Kauf testen, 50/50 für Google Ads. Nach Rückfrage ausdrücklich **nach 14 Tagen die höhere Kaufquote übernehmen, auch bei wenig Daten**; keine Verlängerung bis statistische Signifikanz. Gleichstand/keine Käufe → `direct`.
- `google-ads-paywall-v1`: pro Site 14 Tage ab erstem Teilnehmer, automatische atomare Auswahl beim nächsten berechtigten Besuch nach Frist. Käufer innerhalb des festen Testfensters geteilt durch zugewiesene Browser; weniger Verkäufe können bei weniger Besuchern gewinnen. Gespeicherter Gewinner bleibt fest, neue Besucher bekommen ihn. Alte Teilnehmer behalten ihre Variante bis zum Ablauf nach 14 Tagen. Gewinner-Rollout zählt nicht weiter in Testkohorten.
- Browserzuordnung nur bei erlaubter bestehender Messung, Google-Tag und funktionierendem Speicher/Usage-Redis; bereits freigeschaltete Käufer werden nicht neu zugeteilt. Organische Besucher bleiben normal, zurückkehrende Testteilnehmer behalten die Variante ohne UTM. Bei Ablehnung keine weitere Zuordnung. Keine Antworten/Verläufe im Test; Datenschutz DE/EN/FR/IT ergänzt. Individuelle Redis-Kennungen maximal 90 Tage, Gewinner samt aggregiertem Entscheidungsstand bleibt gespeichert.
- Bestehender Stripe-Checkout bekommt serverseitig geprüfte Testmetadaten. Signierte Stripe-Webhooks zählen bezahlte Käufe atomar, auch ohne Browser-Rückkehr; Wiederholungen doppeln weder Käufer noch Zahlungen. Pro Browser Kaufzuordnung 14 Tage; nach der Entscheidung eingehende Käufe erscheinen separat und ändern den Gewinner nicht. Preis, Freischaltung und Tokenprüfung unverändert. TWINT-Logo und KI-Angebot bleiben erhalten.
- `pnpm experiment:report` nutzt bestehende Usage-Admin-Konfiguration und zeigt Start/Frist je Site, beide Kaufquoten, Checkouts, Zahlungen, Umsatz und Entscheidungssnapshot. Kein Zusatzsetup in GA4. Bei wenig Traffic ist die gewünschte automatische Auswahl ausdrücklich keine Signifikanzbehauptung; durch das feste Zeitfenster können schneller bezahlende Abläufe profitieren.
- Geprüft: 329 Tests inklusive echter atomarer Lua-Ausführung in isoliertem lokalen Redis, Zahlungswiederholungen, Widerruf/Rennen, 14-Tage-Grenze, Gewinner nach Quote statt Anzahl, unveränderlicher Gewinner und API-Adminschutz; Typprüfung, Validierungsmanifest und Webpack-Produktionsbuild mit 1’612 Seiten erfolgreich. Beide Varianten mit lokalem Test-Redis im Browser bestätigt, TWINT sichtbar; Navigation ohne Ads-Parameter behält Variante. Keine synthetischen Teilnehmer in Produktion und keine echte Zahlung erzeugt.

## Tageswerte im Usage-Report (20.10.2026)

- Auf ausdrücklichen Auftrag ab jetzt täglich zählen: `pnpm usage:report YYYY-MM-DD`, API `GET /api/usage?day=YYYY-MM-DD`, Kalenderzeit Europe/Zurich mit Sommer-/Winterzeit. Bisherige Monatssummen und `?month=YYYY-MM` bleiben UTC und behalten ihre Redis-Keys.
- Ein Lua-Aufruf erhöht Tages- und Monatsaggregate atomar, je höchstens 20’000 Kategorien und 100 Zähler pro Aufruf. Tages-Keys separat unter `wsis:usage:day:zurich:v1:`, Löschung mindestens 90 Tage nach Tagesende. Ein globales Startdatum wird beim ersten Tages-Schreibvorgang einmalig gesetzt; keine Einzelereignisse oder persönlichen Zeitstempel.
- CLI meldet fehlende Historie, abgelaufene Zähler und den unvollständigen ersten/aktuellen Tag ausdrücklich. Kein Backfill für gestern. Alte Deployments, die einen Tagesfilter ignorieren, werden erkannt. Admin-Prüfung und Vercel-Automation-Zugang unverändert; Datenschutzhinweise in DE/EN/FR/IT aktualisiert.
- 14 gezielte Tests und Typprüfung erfolgreich, inklusive Schweizer Mitternacht, Sommer-/Winterzeitwechsel, Monatsgrenze, ungültigen Datumswerten, API-Autorisierung und Speicherausfällen. Commit `30079e1` auf main; Vercel-Produktionsbuild erfolgreich, `dpl_315UCjErARBYA5qCqMmHWcZdotuP` / `https://whatshouldistudy-634ob6xg0-laupermoritz-3127s-projects.vercel.app` auf den Live-Domains aktiv.
- Liveprüfung am 20.10.: Tagesreport HTTP 200 mit Europe/Zurich; noch keine Tagesereignisse (`collectingSince: null`), keine künstlichen Nutzungsereignisse erzeugt. Monatsreport weiterhin HTTP 200 (451 Ergebnisse, 10 Freischaltungen zum Prüfzeitpunkt), ungültiger Tag 400 und fehlende Admin-Autorisierung 401. CLI für 20.10. und 19.10. meldet korrekt fehlende Tageshistorie. Ab dem ersten echten Ereignis wird das Startdatum einmalig gesetzt; heute ist nur ab Deployment erfasst.

## Google-Ads-Einstieg mit Kauf vor der Analyse (20.10.2026, lokal)

- Auf Wunsch des Inhabers zeigt der Landing-Hero bei Google-Ads-Parametern direkt den bestehenden Checkout: «Los geht’s – CHF 9 einmalig», Report inklusive KI-Analyse, Platz 1 und passende Studiengänge; kein Abo/keine weiteren Kosten. Texte auch EN/FR/IT, Preis weiterhin aus der bestehenden Länder-/Besucherkonfiguration. Oberes Gratis-Label für diese Variante ersetzt.
- Anschliessend auf Wunsch gestrafft: unter dem Hero-Kaufbutton nur «KI inklusive · Kein Abo | TWINT oder Karte» als dezente Zeile. Ablauf, Gültigkeit, E-Mail-Zugang und Minderjährigen-/AGB-Hinweis bleiben im ausführlichen Preisangebot weiter unten. Andere Checkout-Darstellungen behalten ihre bisherigen Hinweise.
- Erkennung ausschliesslich aus der aktuellen URL: nichtleere `gclid`/`gbraid`/`wbraid` oder Google-UTMs mit bezahltem Medium (siehe README). Kein Cookie, keine Speicherung, unabhängig von Analytics-Einwilligung. Andere Besucher und verkaufspausierte Länder behalten den bisherigen Hero. Weitere kostenlose Einstiege bleiben erreichbar. Keine Änderung an Paywall, Tokenprüfung, Stripe-Endpunkten oder Messdiensten.
- Acht gezielte Tests und Typprüfung erfolgreich. Ads- und organischen Einstieg lokal im Browser geprüft, Kaufbutton aktiv; schmale Darstellung ohne horizontalen Überlauf. Keine echte Zahlung ausgelöst. Standardbuild scheitert lokal an Turbopacks Port-Bind-Berechtigung; `next build --webpack` erfolgreich mit 1’611 statischen Seiten. Noch nicht veröffentlicht.

## Sprache der Studiengang-Besonderheiten (19.10.2026, produktiv abgeschlossen)

- Ursache für deutsche Texte unter «Cosa lo distingue»: Der Reader verlangte ausdrücklich Aussagen in der Sprache der Hochschulseite; `factsForLocale` gab diese für jede Anzeigesprache unverändert aus.
- Reader-Version 6 erzeugt zusätzlich DE/FR/IT/EN-Übersetzungen je belegter Aussage. Speicherung prüft Vollständigkeit, Anzahl und Länge; die bezahlte API wählt die Anzeigesprache. Alte Aussagen ohne Übersetzung werden bis zur Migration ausgeblendet, nicht in einer fremden Sprache angezeigt. Originaltexte bleiben für den persönlichen Vergleich erhalten. Spezialisierungsnamen bleiben die offiziellen Namen.
- `translate_only` im bestehenden Fakten-Workflow ergänzt Übersetzungen gespeicherter Aussagen, ohne erneutes Crawling oder Änderungen an Scores, Quelldatum und Hash. Budget und Limit gelten pro Land; Wiederholungen überspringen bereits übersetzte Einträge. Fehler behalten die bisherigen Daten. Keine Kundendaten an die Übersetzung.
- Weitere Sprachlücken geschlossen: Berufsbeispiele aller 80 Fachgebiete auf Italienisch und Französisch ergänzt; deutsche Dativ-Ländernamen nur noch in deutschen Locales; fehlende übersetzte Abklärungen fallen nicht mehr auf Englisch zurück. Browser-Faktenabrufe verwenden `v=6`, damit nach dem Neuladen keine alten Antworten aus dem HTTP-Cache erscheinen.
- Prüfung: 318 Tests erfolgreich (einschliesslich italienischer React-Ausgabe, aller sechs Locales, Ingest-Validierung, Quellenbelegen, Migration/Wiederholung, paralleler Budgetreservierungen, Berufsbeispielen und gespeichertem Readback), TypeScript erfolgreich. Release-Manifest wegen der geänderten Typdokumentation erneuert; Instrument und Scoring unverändert. Keine echte KI-Anfrage für die Tests.
- Auf ausdrücklichen Auftrag produktiv veröffentlicht und Bestandsdaten übersetzt. Hauptlauf `39240737828`, abschliessender Wiederholungs-/Prüflauf [39241687210](https://github.com/moritzlauper/whatshouldistudy/actions/runs/39241687210) erfolgreich: CH 1’131/1’131, FR 139/139, GB 14/14, NL 139/139, NO 9/9, FI 180/180, AU 13/13 Programme mit Besonderheiten vollständig in DE/FR/IT/EN; US 0/0, KR leer. Insgesamt 2’264 gespeicherte Lesungen und 1’625 Programme mit übersetzten Besonderheiten. Überall 0 fehlgeschlagen und 0 verbleibend im Abschlusslauf. Die letzten fünf CH-Einträge wurden erfolgreich wiederholt. Leere Stores werden nur geprüft, nicht überschrieben.
- Jeder Schreibvorgang wird über den authentifizierten Ingest-Weg vollständig zurückgelesen und mit den normalisierten Ausgangsdaten verglichen. Vier parallele Übersetzungsbatches teilen sich die Budgetgrenze pro Land. Der vorhandene Vercel-Automation-Header behebt die Bot-Challenge im Workflow; GitHub-OIDC bleibt zwingend. Private Lesungen bleiben im privaten Store, Logs enthalten nur aggregierte Zähler. Paywall, Tokenprüfung und Checkout unverändert.
- Produktiv-Deployment mit Browser-Cache-Korrektur: `dpl_EuCBDVLJVPTJoqPnXFHF8N4FtYgA` (`whatshouldistudy-pdaj7hww2-laupermoritz-3127s-projects.vercel.app`), Ready und auf allen Produktdomains aktiv. Live-Prüfung: italienische/französische Rechtswissenschaft-Seiten liefern lokalisierte Berufsbeispiele; Fakten-API ohne Freischaltung weiterhin 401. Bezahlte Darstellung mit synthetischen Fixtures getestet, produktiver Datenbestand über OIDC-Readback geprüft; kein Kundentoken erzeugt oder wiederverwendet.

## Zahlungsbestätigung per E-Mail und Sprachfehler (19.10.2026)

- `Locked.checkout` auf der Ergebnisseite übergab bisher keine Sprache. FR/IT-Checkouts erhielten deshalb `/freigeschaltet` statt `/fr/freigeschaltet` bzw. `/it/freigeschaltet`. Auf whatshouldistudy.ch führte der alte Pfad auf wasstudieren.ch, dessen Browser-Speicher nicht das ursprüngliche Profil enthält. Sprache wird jetzt mitgegeben; Checkout speichert zusätzlich Produkt und Locale in Stripe-Metadaten. Alte Schweizer Rückkehrlinks bleiben bei FR/IT-Browsersprache auf derselben Domain. Zahlung/Tokenprüfung unverändert.
- `/api/stripe/webhook` prüft rohe Stripe-Signatur und Zeitstempel, verarbeitet nur bezahlte Report-Käufe und versendet via bestehendem Infomaniak-SMTP einen persönlichen Zugangslink in DE/EN/FR/IT. Kein Fragebogeninhalt in dieser Nachricht. Redis: gehashte Session-ID, Versandmarker 400 Tage, kurze Sperre gegen parallele Zustellungen. Fehler liefern 503 für Stripe-Wiederholungen; seltene Duplikate nach einem Prozessabbruch zwischen SMTP-Annahme und Speicherung bleiben technisch möglich.
- Stripe-Liveziel `whatshouldistudy-report-email` (`we_1USDS4RMJX28dzs85uJMeSgW`), URL `https://whatshouldistudy.com/api/stripe/webhook`, Events `checkout.session.completed` und `checkout.session.async_payment_succeeded`. Separater `STRIPE_WEBHOOK_SECRET` als Production-Secret in Vercel gesetzt; nicht lokal gespeichert oder ausgegeben.
- Vercel-Firewall-Regel `rule_stripe_report_email_webhook_1Vdf0K`: nur POST an genau diesen Host/Pfad, mit Stripe-Signaturheader und aus den 15 offiziellen Stripe-Webhook-IP-Adressen (https://stripe.com/files/ips/ips_webhooks.json, Stand 19.10.). Signatur bleibt zusätzlich serverseitig erforderlich. Bot Protection/AI-Bot-Regeln ansonsten unverändert; IP-Liste bei Stripe-Änderungen nachführen.
- Geschützter Supportweg: `/api/stripe/recover-email` mit bestehendem `USAGE_ADMIN_TOKEN`, Session-ID und optionalem Locale. Liest die Zahlung erneut direkt bei Stripe, verwendet ausschliesslich deren Käuferadresse und dieselbe Duplikatsperre. Ein ausdrücklich genehmigter Nachversand auf Italienisch erfolgte produktiv: HTTP 200 `sent`, Wiederholungsprüfung HTTP 200 `already-sent`. SMTP-Annahme ist bestätigt, Posteingang/Öffnung beim Empfänger nicht einsehbar.
- Live: `https://whatshouldistudy-bl8u0h1lm-laupermoritz-3127s-projects.vercel.app` (`dpl_B3Uq7xuSgouFUh5ZEiMzRr6chCcS`) gebaut und per `vercel promote` veröffentlicht. Alter Link mit italienischer Sprache jetzt 307 auf `/it/freigeschaltet`, Zahlung serverseitig erfolgreich überprüft. Unsignierter Webhook 400; unautorisierte Recovery und Programmliste jeweils 401. Noch keine neue Livezahlung seit Einrichtung beobachtet; echte Stripe-Webhook-Zustellung deshalb noch nicht anhand eines neuen Kaufereignisses belegt.
- Typprüfung, Produktionsbuild und alle 308 Tests erfolgreich, einschliesslich Signatur/Timestamp, unbezahlter/fremder Sessions, Sprache, SMTP-Wiederholung, Parallelität, Duplikatschutz und Supportautorisierung. Datenschutz-/Kauftexte angepasst. Release-Manifest nur wegen Wörterbuch-Dateiprüfsumme erneuert; Instrument/Scoring unverändert.

## Google-Indexierung wasstudieren.ch (19.10.2026)

- Priorität laut Inhaber: `https://wasstudieren.ch/` als Hauptseite; andere Domains sind für diesen Auftrag nicht relevant.
- Search Console meldete beim Crawl vom 08.10. noch `https://whatshouldistudy.com/` als deklarierten und von Google gewählten Canonical der Schweizer Startseite. Der aktuelle Google-Live-Test vom 19.10., 12:06 Uhr bestätigt dagegen `https://wasstudieren.ch/`, erfolgreichen Abruf und erlaubte Indexierung. Keine weitere Code-/Deploymentänderung erforderlich.
- Indexierung der HTTPS-Startseite erfolgreich beantragt (Priority Crawl Queue); Validierung des Canonical-Ausschlusses gestartet. Das ist noch keine bestätigte Aufnahme in den Google-Index.
- Zuvor keine Sitemaps eingereicht. Jetzt beide erfolgreich verarbeitet: `/sitemap.xml` mit 162 Seiten und `/sitemaps/ch-ch-0.xml` mit 1’611 Seiten. Der kurz angezeigte Abruffehler der zweiten Sitemap war nach Verarbeitung verschwunden.
- Der separate Weiterleitungsausschluss betrifft `http://wasstudieren.ch/`; der korrekte 308 auf HTTPS bleibt bestehen. Auch www leitet auf die Hauptadresse weiter. Keine Firewall-, Paywall- oder Checkoutänderung.

## Usage-Report und Bot Protection (19.10.2026)

Hinweis Outreach (19.10.2026): Auf ausdrücklichen Wunsch des Inhabers komplett gestoppt. Im separaten Repository `moritzlauper/whatshouldistudy-outreach` sind die GitHub-Actions-Workflows «Outreach prüfen» (377367573) und «Einzelmails verschicken» (379790874) serverseitig `disabled_manually`. Nach der Deaktivierung keine laufenden oder wartenden Actions-Aufträge vorhanden; lokal keine zugehörigen Versandprozesse oder Zeitpläne gefunden. Nicht ohne erneuten Auftrag aktivieren. Die separate Blog-Automation bleibt aktiv.

Hinweis Outreach (20.10.2026): Auf ausdrücklichen Auftrag des Inhabers beide Workflows wieder aktiviert (täglich höchstens 10 Mails). Vom 15. bis 18.10. liefen die täglichen Läufe, verschickten aber keine Mail: Alle bisher gefundenen Schweizer Ziele sind vorbereitet oder kontaktiert, die übrigen rund 180 Schweizer Websites wurden am 07.10. ohne eindeutige Rollenadresse verworfen und werden erst nach 30 Tagen (ab etwa 06.11.) erneut geprüft. Laut Inhaber soll das die automatische Recherche lösen, keine manuelle Nacharbeit.

- `pnpm usage:report 2026-10` scheiterte vor der App an Vercels Bot-Challenge (HTTP 429, `x-vercel-mitigated: challenge`).
- Das Skript sendet jetzt optional `VERCEL_AUTOMATION_BYPASS_SECRET` als Header neben der weiterhin erforderlichen Admin-Autorisierung und erklärt Challenge-Fehler. Vorhandenen Projekt-Automation-Schlüssel lokal in `.env.local` ergänzt; keine Schlüssel ausgegeben oder eingecheckt. README und `.env.example` dokumentieren die Einrichtung.
- Live-Aufruf erfolgreich (Exit 0): Oktober bisher 414 Ergebnisansichten und 3 Freischaltungen. Acht gezielte Tests und TypeScript erfolgreich. Keine Änderung an Firewallregeln, Paywall oder Checkout; kein Deployment erforderlich.

## Origin-Transfer und Serverspeicher (18.10.2026)

- Beide Programm-Detailrouten waren bereits ISR (`generateStaticParams() => []`, `revalidate = 86400`). Vor der Änderung produktiv geprüft: Schweizer Detailseite `X-Vercel-Cache: HIT`, internationale Entsprechung `STALE` mit `x-nextjs-prerender: 1`. Die geprüften HTML-Antworten waren 67’626 bzw. 66’112 Bytes gross. Kein vollständiger Datensatz im Seiteninhalt; bei einer Neugenerierung liest der Server allerdings den weltweiten Fach-Shard.
- `lib/server/data.ts`: gleichzeitige Abrufe derselben Datei teilen Download und JSON-Parsing. Der bisher unbegrenzte Cache ist jetzt ein LRU mit maximal 32 MiB ursprünglicher JSON-Grösse und 128 Einträgen, bei weiterhin sechs Stunden TTL. Das ist kein Limit für den gesamten V8-Heap/RSS. Suchindizes verwenden schwache Referenzen, damit sie entfernte Kataloge nicht weiter festhalten. Fehlgeschlagene Abrufe bleiben wiederholbar. Ein Remote-404 prüft die Metadaten auch nach deren Verdrängung aus dem Cache.
- Detailverweise in Katalogzeilen und ähnlichen Programmen verwenden `prefetch={false}`: kein vorsorgliches Rendern/Übertragen zahlreicher weiterer Seiten beim Scrollen. Navigation und Darstellung bleiben erhalten.
- Lokale Einzelmessung des Informatik-Shards: 7’001 Programme, 4,35 MiB kompaktes JSON, nach GC rund 101 MiB Prozess-RSS und 6,74 MiB zusätzlicher Heap. Dies reproduziert nicht die gemeldete produktive Spitze von 662 MB; die genaue Aufteilung dieser Spitze ist ohne Heap-Profil offen.
- Vercel-Firewall für `whatshouldistudy`: Bot Protection auf Challenge und AI Bots auf Deny veröffentlicht. Bekannte KI-Crawler werden blockiert; klassische verifizierte Suchmaschinen bleiben erlaubt. Paywall, Tokenprüfung und Checkout nicht verändert.
- Ausgangswert vor Deploy: Usage / Fast Origin Transfer / Projects, 30-Tage-Ansicht am 18.10.: `whatshouldistudy` 29,82 GB (99,3 %), Team 30,02 GB. Im vom Dashboard angezeigten 24-Stunden-Intervall «Oct 16, 3pm – Oct 17, 2:59pm» waren es 961,87 MB für das Projekt. Dashboard-Zeitzone beachten; nicht als Schweizer Kalendertag ausgeben.
- `.vercelignore` schliesst lokale Scraper-Ausgaben/-Caches und Umgebungsdateien vom CLI-Upload aus; das Deployment lädt rund 4,1 MB statt rund 109 MB hoch.
- Deployment: `https://whatshouldistudy-lpgsv84l3-laupermoritz-3127s-projects.vercel.app` (Produktionsumgebung, anschliessend mit `vercel promote` freigeschaltet). Schweizer Detailseite danach im echten Browser erfolgreich geladen. Unauthentifizierte `curl`-Aufrufe erhalten jetzt erwartungsgemäss die Bot-Challenge (HTTP 429); das ist kein Anwendungsfehler. woischzueri.ch weiterhin HTTP 200, kein Redeploy nötig.
- Nachkontrolle offen: ab dem ersten vollständigen Tag nach Deploy drei bis fünf Tage lang die Tageswerte pro Projekt prüfen. Ziel klar unter 300 MB/Tag und Team insgesamt unter 10 GB/30 Tage; alte Spitzen verschwinden nicht durch das Deployment. Menschlicher Vercel-Billing-Support wurde um Klärung der Anrechnung früherer/Trial-Nutzung und des gekündigten Trial-Status gebeten. Keine Aboänderung vorgenommen.
- Tests: 303 Tests erfolgreich, darunter LRU-Verdrängung/TTL und 20 gleichzeitige Anfragen auf einen 3-MiB-Shard mit genau einem Download sowie erfolgreicher Wiederholung nach Parserfehlern. TypeScript erfolgreich. Zwei lokale Produktionsbuilds scheiterten an GitHub-Netzwerktimeouts. Der anschliessende Vercel-Produktionsbuild (Next.js 16.3.4, Turbopack) war in 56 Sekunden erfolgreich, inklusive 1’609 statischer Seiten; beide Detailrouten sind SSG/ISR. Neue globale Detailseite: 66’503 Bytes, erster Abruf MISS, zweiter HIT. `/api/programmes` ohne Token weiterhin HTTP 401 «Unlock required.». Nach der letzten Loader-Anpassung zusätzlich Typprüfung und 14 gezielte Tests erfolgreich.

## Research-Bericht: getrennte Sitzung und Studienvorbereitung (14.10.2026)

- Den 20-seitigen Bericht `Studienwahl_Wissenschaftliche_Grundlage_2026.pdf` gelesen. Kein belegter sofortiger Ersatz durch frei nutzbare Normen oder fremde Fragebögen. Originalbedingungen von IPIP, O*NET und BFI-2 sowie EDÖB-DSFA-Seite zusätzlich geprüft. Keine externen Testitems oder Forschungsdaten übernommen, keine Kontakte angeschrieben.
- Neue `/beratung`-Seite auf den Länder-Sites (lokal `/schweiz/beratung`), global `/counselling`; Einstieg im Manual und auf Schul-/Organisationsseiten. Bewusst vollständiger Seitenwechsel. `SessionBoundary` mountet hier die reguläre Shell mit Messdiensten und OrgCapture nicht. `QuestionnaireForm` ist jetzt kontrolliert; regulärer Fragebogen verwendet weiterhin den Store, die Sitzung nur ihren eigenen Arbeitsspeicher. Alle 24 Interessenfragen erforderlich. Beschreibende Antwortprofile, kein Zugriff auf die kostenpflichtige Rangliste. Beenden, Neuladen und Browser-Cache-Rückkehr verwerfen die Sitzung. Explizite lokale JSON-/Druckkopien enthalten persönliche Daten und werden nicht an uns gesendet.
- Hinweise direkt im Fragebogen in DE/EN/FR/IT: eigene unvalidierte RIASEC-Fassung, eigene Übersetzungen, keine echten Noten im internen Feld `grade`, Werte als Präferenzen. Gültigkeitsprüfung für Interessenantworten vereinheitlicht: nur ganze 1–5 zählen in Score und Fortschritt.
- `assessment-version.ts` unterscheidet Instrument-/Scoringversionen vom Ergebnis-Drahtformat. Neue Ergebnisse/Sharelinks behalten `method`; alte erhalten keine nachträgliche Version. Locale bedeutet Anzeigesprache, nicht belegte Sprache alter Antworten.
- `docs/validation/`: Pilotprotokoll, Rechte-/Datenentscheidungen, institutionelle offene Nachweise, exakte sechs regionale Sprachfassungen samt Code-/Promptprüfsummen und eine explizit unbeurteilte Vorlage für alle 80 Feldprofile. `npm run validation:bundle` erzeugt Manifest/Vorlage, `validation:check` erkennt Änderungen (auch in Tests). Ausgefüllte Reviews separat ablegen; Generator überschreibt die Vorlage. Vor einer Studie Katalogrelease, Git-Commit, echte Durchführung, Registrierung und Datenschutz zusätzlich sichern.
- Geprüft: 300 Tests erfolgreich; TypeScript und Produktionsbuild (`--webpack`) erfolgreich. Build brauchte Netzwerkfreigabe für die öffentlichen GitHub-Katalogdaten. Separate Chrome-Testinstanz mit ausschliesslich fiktiven Angaben: kein vorhandenes Profil übernommen, keine Fetch-/XHR-/API-/Analyse-Anfragen in der Sitzung, Export, Reset/Reload, vier Sprachen, 390-px-Breite und reguläre Antwortspeicherung. Keine bezahlte Freischaltung oder echte persönliche KI ausgelöst.
- Offen ausserhalb des Codes: Rechte-/Lizenzofferten, unabhängige Curriculumreviews, Partner/Finanzierung, Rekrutierung und echte empirische Studien, produktive Vertrags-/Sicherheitsnachweise und institutionelle Entscheidungen. Kein Pilot und keine repräsentative Normierung durch diese Implementierung durchgeführt.

## Fachliche Rückmeldung: Manual, Normwerte und Datenschutz (14.10.2026)

- Öffentliches Verfahrensmanual unter `/fachinformationen` (lokal `/schweiz/fachinformationen`), global `/professional`. Deutsch und Englisch; FR/IT verweisen ausdrücklich auf die englische Dokumentation. Enthält Durchführung, reale Auswertung/Item-Schlüssel, Evidenzstatus, Datenflüsse/Löschfristen, institutionell noch zu prüfende Punkte, Selbstlern-Einführung und einen ausdrücklich noch nicht durchgeführten Validierungsplan. Über Footer, Methodik, Datenschutz, Start, Resultat und Schulangebote erreichbar; druckbar.
- Keine erfundene Reliabilität, Validität oder Normstichprobe. Ungefähre Mini-IPIP-Normkonstanten und die daraus erzeugten Perzentile entfernt. Neue Resultate zeigen umgepolte Antwortmittelwerte 1–5; alle vier gültigen Items je Merkmal erforderlich. `big5.means` ist neu; `z` bleibt aus Kompatibilitätsgründen als interner, jetzt am Skalenmittelpunkt zentrierter Wert bestehen. Alte geteilte Resultate ohne Mittelwerte zeigen keine Norminterpretation. Im Fragebogen-Modus beeinflusst Persönlichkeit auch versteckte Vorschläge und Begründungen nicht mehr.
- Sichtbare Aussagen «verglichen mit deinem Alter», «wir speichern nichts» und «keine persönlichen Daten» bei Ergebnislinks korrigiert. Profile können personenbezogen sein; lokales Löschen entfernt weder weitergegebene Links noch Anbieterprotokolle/Zahlungsunterlagen. Die Datenschutzerklärung verweist auf das Dateninventar; englische, französische und italienische Texte mitgezogen.
- `/api/personal-fit` verlangt zusätzlich ausdrücklich `consent: true`, begrenzt den Body auf 128 kB und liefert auch Fehler mit `private, no-store`. Browser sendet Zustimmung nur im vorhandenen, aktiv ausgelösten Vergleichsablauf. Kein Big-Five-Profil an die persönliche KI. Tokenprüfung/Checkout unverändert.
- Geprüft: 26 gezielte Tests (Engine, Share, Personal Comparison, Checkout, Teaser) erfolgreich; Typprüfung erfolgreich. Browser: Manual/Sprunglinks und fiktives, nicht freigeschaltetes Ergebnis mit 4.50/5 statt Perzentil. Chrome-Erweiterung verursacht bekannte Hydration-Warnung durch `webcrx`-Attribute. Kein Kauf und keine echte persönliche KI-Anfrage ausgelöst.
- Noch erforderlich für professionelle diagnostische Anerkennung: reale unabhängige Studien, passende dokumentierte Normierung (falls Normvergleiche gewünscht), produktive Anbieter-/Vertrags-/Sicherheitsnachweise und institutionelle Freigaben. Diese Arbeiten sind nicht durch das Manual erledigt. Keine Forschungsdaten erhoben, keine Nachricht an die Beratungsstelle versandt.

## Lokale Landingpage zeigte Demo-Zahlen (14.10.2026)

- Ursache für «117 Studiengänge an 14 Hochschulen»: lokal weder `WSIS_DATA_URL` noch Vercel-Repo-Variablen gesetzt; `getMeta()` las `data/sample/meta.json`. Keine Reduktion des veröffentlichten Datenbestands.
- Lokale `.env.local` auf den öffentlichen Datenbranch dieses Repos eingestellt. Metadaten vom 14.10.2026, 08:11 UTC: Schweiz 1’648 Programme an 43 Institutionen. Lokale Statistik-API bestätigt `sample: false` und denselben Datenstand.
- Landingpage berücksichtigt jetzt das `sample`-Flag: Demo-Zahlen heissen ausdrücklich «Beispieldaten», mit gelbem Punkt und ohne Behauptung wöchentlicher Aktualisierung (vier Sprachen). Typprüfung erfolgreich.

## Kompakte Beispielkarte, Stern ohne Schrift (14.10.2026)

- `HeroCard` auf der Landingpage: weniger Abstand und kleinere Typografie/Diagramm, weniger gedrehte Hintergrundkarten. Auf erneuten Wunsch etwas grösser als die erste kompakte Fassung: maximal 416 px breit, Diagramm 104 px, mehr Innenabstand auf Desktop. Inhalte bleiben sichtbar, lange Programmnamen brechen um.
- Der obere gelbe Stern enthält keinen Text mehr und ist reine Dekoration. Preis und Kaufmöglichkeiten bleiben an ihren übrigen Stellen.
- Typprüfung und sieben gezielte Tests erfolgreich. Finale Desktopkarte rund 620 px hoch und im geprüften 823-px-Fenster vollständig sichtbar. Mobile Fassung vor der kleinen Vergrösserung bei 390 × 844 px ohne horizontalen Seitenüberlauf geprüft.

## Ergänzende Quellen deutlicher sichtbar (14.10.2026)

- Landingpage und Importseite behalten Google/YouTube als Hauptquelle. Die ergänzenden Quellen öffnen jetzt über eine grosse, farbige Aufklappfläche mit «Weitere Quellen ergänzen» und «Instagram, TikTok & mehr · freiwillig», statt eines kleinen Textlinks. DE/EN/FR/IT angepasst; standardmässig eingeklappt.
- Typprüfung erfolgreich. Im lokalen Browser das Aufklappen und die sichtbaren Importkarten für Instagram/TikTok geprüft.

## Landingpage kürzer, KI im Einstieg (14.10.2026)

- Hero-Text in DE/EN/FR/IT auf drei kurze Sätze gekürzt; KI bereits in der Überschrift. Der zweite Knopf führt mit «Was kann die KI?» zur KI-Sektion. Darunter stehen Report inklusive KI, aktueller Checkout-Preis und Gültigkeit.
- Die KI-Sektion erklärt drei Ergebnisse statt des technischen Ablaufs: Programmvergleich, Inhalte/Vertiefungen und optionale Verlaufseinordnung. Hinweise zu Einwilligung und Datenverarbeitung bleiben bestehen; Länderhinweise für DE/AT bleiben erhalten.
- Typprüfung erfolgreich; Schweizer Landingpage und Sprung zur KI-Sektion lokal im Browser geprüft.

## Gratisvorschau ohne Studiengangdetails; KI-Angebot sichtbar (14.10.2026)

- Auf Wunsch des Inhabers zeigt die kostenlose Ergebnisvorschau keine konkreten Studiengänge mehr. `/api/teaser` liefert nur Zählungen/Fachgruppen und ein leeres `samples` für ältere Clients. Die bisherigen Vorschau-Nutzungszähler für einzelne Programme entfallen. Bezahlte Endpunkte, Tokenprüfung und Checkout bleiben unverändert.
- Statt der drei aufklappbaren Gratisprogramme zeigt `app/ui/programmes.tsx` gesperrte Feldbezeichnungen. Fachrichtungen bleiben sichtbar; Platz 1 bleibt wie bisher gesperrt.
- Direkt unter dem Ergebnistitel erklärt `ReportOffer` den Einmalpreis und drei Funktionen: Profilvergleich, Studieninhalte/Vertiefungen, optionale Einordnung des importierten Verlaufs samt Veränderungen der Empfehlungen. Die Texte nennen verfügbare Hochschulangaben, benötigten Import und Einwilligung. Der Kaufkasten hebt die enthaltene KI-Analyse ebenfalls hervor. Texte in DE/EN/FR/IT, Preis aus derselben Konfiguration wie Checkout.
- Geprüft: TypeScript und vier gezielte Tests (Teaser, Checkout, Begründungen) erfolgreich. Lokale Browserprüfung mit synthetischen Fragebogenantworten: Angebot, gesperrte Felder und Verlinkung zum Kaufbereich. Kein Kauf und keine persönliche KI-Anfrage ausgelöst.

## Geschlossene Studiengänge: im Ranking, mit Hinweis (14.10.2026)

- Entscheidung: Ein Studiengang, der keine Neuanmeldungen mehr annimmt (`closedFrom`), bleibt im Ranking, wie er passt. Er wird nicht still ausgeblendet oder herabgestuft. Ein einzelner Seitenwortlaut sollte keine Programme verschwinden lassen.
- Sichtbar ist der Hinweis in der eingeklappten Zeile der Rangliste (gelber Kasten, `app/ui/programmes.tsx`, `ProgrammeRow`), ausserdem auf der Detailseite und im Katalog.
- Umkehren: Wer ausblenden will, filtert in `app/ui/programmes.tsx` die Liste nach `!p.closedFrom`. Das ist eine Zeile.
- Gilt erst, wenn Daten mit `closedFrom` veröffentlicht sind; siehe den Abschnitt zu Bern.

## Programmliste zeigt bis Top 60 (14.10.2026)

- Der Knopf «Top 20 anzeigen» stoppte bei 20. Jetzt folgen die Stufen 10, 20, 40, 60 (`app/ui/programmes.tsx`, `more`). Ab 60 gibt es keinen Knopf mehr.
- Nur typgeprüft und mit der Testsuite geprüft; im Browser nicht durchgeklickt.

## Schliessung zur Anmeldung wird gelesen: Master Soziologie Bern (14.10.2026)

- Ursache: Der Bern-Leser las nur die A–Z-Liste der Studiengänge, nie die Studiengangsseite. Ein Hinweis wie «Neuanmeldungen … ab dem Herbstsemester 2026 nicht mehr möglich» blieb deshalb unsichtbar.
- `closureOf` in `scrapers/ch-hochschulen.ts` liest den Hinweis von der Seite: einen Satz mit «Neuanmeldung» oder «new registrations», «nicht mehr» oder «no longer» und einem Semester. Dazu den Nachfolger («Stattdessen wird … angeboten» oder «Instead, the new … is offered»). Gespeichert als `closedFrom` und `successor` (`lib/programmes.ts`), im Katalog mitgeführt.
- Anzeige: Auf der Detailseite und in der Zeile steht der Hinweis anstelle des Anmeldeschlusses (`app/ui/programmes.tsx`, `app/ui/catalogue-row.tsx`, `lib/site/catalogue-text.ts` in vier Sprachen).
- Geprüft: Vier Tests in `test/ch-closure.test.ts`, mit dem Wortlaut aus der Mitteilung des Inhabers (englisch) und einer deutschen Entsprechung. Die volle Suite läuft bis auf die drei bekannten Fehlschläge durch.
- Nicht geprüft: unibe.ch ist aus der Entwicklungsumgebung gesperrt (Proxy 403). Der echte Wortlaut der Seite ist deshalb nicht gelesen. Ein Lauf des Workflows «ch» zeigt, ob die Erkennung greift.
- Offen: Der Nachfolger «Research Master in Sociology and Communication» erscheint in den Daten erst, wenn er auf der A–Z-Liste steht. Die Bern-Seiten werden jetzt bei jedem Lauf einzeln gelesen.

## Veraltet-Hinweis nennt die Quellen; KI-Karte kürzer (14.10.2026)

- Der gelbe Hinweis «mit einer älteren Version gelesen» zählte jede gespeicherte Quelle mit einer alten Version, auch solche, die nicht neu hochgeladen wurden (etwa ein YouTube-Konto oder Instagram aus einer früheren Sitzung). Er nennt jetzt diese Quellen mit Namen und verschwindet, sobald keine mehr alt ist (`app/views/results.tsx`, `StudyInfoNote`).
- Warum nicht nur My Activity geprüft wird: Version 7 (Commit 45003cb) hat alle Zählungen betroffen, nicht nur den Takeout-Import. Ein Hinweis nur auf Takeout würde also echte alte Daten verstecken.
- Offen: Welche Quelle bei dir veraltet ist, ist nicht bekannt. Nennt der Hinweis «Meine Aktivitäten», hat der neue Upload den alten Stand nicht ersetzt, zum Beispiel weil er kein YouTube-Video lieferte.
- KI-Karte («Verlauf mit KI verstehen») und Einstiegstexte in vier Sprachen gekürzt: `lead`, `active`, `sample`, `contextNote`, `consent`, `compareNote`, `afterAnalysis`, `changed`, `unchanged`, `localNote`, `ready`. Der Hinweis zur Einwilligung bleibt inhaltlich, nur kürzer.

## Texte gekürzt: Schritt 2 und Ergebnis (13.10.2026)

- Auf der Startseite war der Upload-Bereich bei 390 px Breite erst nach rund 217 Wörtern Text sichtbar. Jetzt sind es 143 Wörter, der Bereich erscheint auf dem ersten Bildschirm. Gekürzt in allen vier Sprachen: `step2sub`, `yt`, `startNote`.
- Im Ergebnis gekürzt: `studyingHint`, `careless`, `limits`. Die Frage «Studierst du schon etwas?» bleibt, weil sie die Wertung ändert.
- Die Meldung «durchgeklickt» kommt nur aus den Fragebogen-Antworten: Kontrollfrage nicht mit 2 beantwortet, oder zehn gleiche Antworten in Folge. Der Export ist nicht beteiligt (`careless()` in `lib/engine/questionnaire.ts`).
- Lokal freischalten: Ausserhalb der Produktion ist das Freischalten ohne `STRIPE_SECRET_KEY` gratis (`paymentMode()` in `lib/server/token.ts`). Einen Schalter per URL-Suffix gibt es bewusst nicht, AGENTS.md verbietet die Umgehung des Paywalls.

## KI-Karte nennt «Meine Aktivitäten», nicht mehr einen YouTube-Import (13.10.2026)

- Die KI-Karte (`app/ui/content-analysis.tsx`) liest nur `summaries.takeout`, also die Videos aus «Meine Aktivitäten». Ihre Texte sagten aber «YouTube-Verlauf importieren». Geändert in `lib/site/dict.ts` für de, en, fr und it: `ready`, `ask`, `missing`, `unavailable` der Karte sowie `intro` und `uses` der Einstiegsseite. «Meine Aktivitäten» ist jetzt der einzige Upload, den die Texte nennen. Der optionale separate YouTube-Export bleibt erwähnt.
- Offen: Der Screenshot vom 13.10. zeigt ein Ergebnis ohne «YouTube-Verlauf» in den Quellen. Der Upload hat also keine Videos geliefert, obwohl die Karte jetzt «Meine Aktivitäten» verlangt. Ursache nicht bestätigt, siehe nächster Abschnitt.

## Grosse My-Activity-Dateien: Speicher reicht bei rund 3 Mio. Einträgen nicht (13.10.2026)

- Synthetischer Export, 176 MB als zip, 3'250'000 Einträge (`make-real-like.py`): Im Browser mit 512 MB Heap-Limit stürzt der Tab nach rund 16 Minuten ab, ohne Ergebnis. Eine Datei mit 703'355 Videos (420 MB, lose HTML) läuft dagegen in 51 Sekunden durch.
- Vermutung, nicht bestätigt: Jeder gelesene Eintrag bleibt als Objekt im Speicher (`c.watch`, `seenWatch`, Inhalte für die KI). Bei mehreren Millionen reicht das auf einem Telefon nicht. Ein Absturz während des Uploads würde erklären, warum «Google-Aktivität» aus einem früheren Upload erscheint, YouTube aber fehlt.
- Offene Entscheidung: nur die neuesten N Videos lesen (mit sichtbarem Hinweis), oder den Aufbau auf fortlaufende Summen umstellen. Ersteres ist klein, ändert aber das Ergebnis für sehr grosse Verläufe.
- Der Parser liest das echte Takeout-Layout mit «Angesehen» und Zeilenumbruch korrekt (30 Videos, Browsertest). HTML-Tests laufen nur im Browser, weil Node kein `DOMParser` hat.
- Der Review-Workflow der Streaming-Lesung ist am Wochenlimit gescheitert (Reset 15.10., 06:00 UTC). Die Prüfung ist daher offen.

## «Neu hochladen» führt auf Schritt 2 (13.10.2026)

- Der Knopf im Hinweis auf veraltete Daten (`StudyInfoNote` in `app/views/results.tsx`) führte auf die Startseite ohne Anker, also auf Schritt 1 (Fragebogen). Er zeigt jetzt auf `#quellen` (Schritt 2, «Mit deinen Daten»).
- Geprüft im Browser: Nach dem Klick ist der Abschnitt `quellen` sichtbar und `fragebogen` ausgeblendet. Google News aus einer HTML-Datei von My Activity wird als Artikel gezählt (synthetischer Export, 40 Artikel).

## Grosse Takeout-Aktivitätsdateien werden stückweise gelesen (13.10.2026)

- Ursache, wahrscheinlich, nicht am Bericht des Inhabers bestätigt: Eine sehr grosse YouTube-Datei eines My-Activity-Berichts wurde als Ganzes gelesen. Text, DOM und Einträge brauchen ein Mehrfaches der Dateigrösse; auf dem Telefon scheiterte das. Der Fehler blieb unsichtbar, weil andere Teile (Google-Suche) erkannt wurden. Zudem übersprang der Zip-Leser Dateien über 400 MB stillschweigend. Die Karte zeigte dann nur «Google-Aktivität», ohne YouTube.
- Jetzt: HTML-Aktivitätsdateien werden in Stücken von rund 4 Mio. Zeichen gelesen, geschnitten vor jedem Eintrag (`cutBeforeLastEntry`). JSON-Aktivitätsdateien werden an den Objektgrenzen geschnitten (`ObjectCutter`). Die Stücke laufen in `sinkFor` in `lib/sources/exports.ts`. Kleine Dateien bleiben beim bisherigen Weg. Die 400-MB-Grenze ist weg; andere grosse Dateien werden ab 400 MB sichtbar übersprungen.
- Die Karte nennt Aktivitätsdateien, die nicht gelesen werden konnten, neben den erkannten (`app/views/start.tsx`).
- Prüfungen: TypeScript grün; Export-Tests 18 von 18 (neu: Teilung im HTML, JSON-Objekte in beliebigen Stücken, grosse Aktivitäts- und Nicht-Aktivitäts-JSON); gesamte Suite 282 von 285, die drei bekannten. Browser mit synthetischen Exporten (keine persönlichen Daten): kleine HTML- und JSON-Exporte unverändert. Ein 420-MB-YouTube-Teil in einer Zip mit bekannter Grösse wurde vorher stillschweigend verworfen; jetzt 703'355 Videos in 55 s. Mit 512 MB Browser-Speicher dasselbe Ergebnis in 51 s; mit dem alten Code lief dieser Lauf 15 Minuten ohne Ergebnis.
- Nicht geprüft: eine lose, nicht gezippte grosse HTML-Datei; die Meldung für nicht lesbare Dateien auf der Karte; der echte Export des Inhabers. Nach dem Deploy den My-Activity-Export neu hochladen; bestehende Auswertungen ändern sich nur beim Import.

## Internationale Studiengangsdetails (13.10.2026)

- Die Listen für CH/FR/GB/NL/NO/FI/AU/KR/US liefen bereits erfolgreich; der veröffentlichte Lauf vom 13.10. enthält alle neun Länder. Die Detailfreigabe (`FACTS_COUNTRIES`) war auf CH beschränkt und ist jetzt mit der gemeinsamen Länderliste erweitert. DE/AT bleiben ausgeschlossen; Paywall unverändert. OIDC akzeptiert zusätzlich den automatischen workflow_run-Auslöser, weiterhin ausschliesslich GitHub-signiert für dieses Repo, main und den Faktenworkflow; dessen Referenz muss jetzt exakt main sein.
- Öffentliche Studiengangslesungen auf ausdrücklichen Wunsch des Inhabers mit dem vorhandenen GitHub-Secret `ANTHROPIC_API_KEY`, Modell `claude-haiku-5-5`. Diese Entscheidung ersetzt für den Offline-Leser die frühere vollständige Infomaniak-Migration. Persönliche Analysen und Übersetzungen bleiben bei Infomaniak. Keine Infomaniak-Secrets nach GitHub übertragen.
- Faktenworkflow: automatisch nach einem erfolgreichen Datenlauf (wöchentlich und bei Scraper-Änderungen), zusätzlich manuell mit ALL oder einem Land, UK wird zu GB. Getrennte Länderjobs, maximal drei gleichzeitig; standardmässig 150 Leseversuche und konservativ USD 1 je Land (ALL höchstens USD 9). Fehlgeschlagene API-Aufrufe behalten ihre Kostenreservierung. Leser-Version 5.
- Fehlende Programmseiten werden über Hochschul-Sitemaps gesucht. Automatische Zuordnung braucht Programmname im Titel und Abschlussbeleg; mehrdeutige Treffer werden nicht übernommen. Titel wird beim Lesen erneut geprüft. Pro Lauf fünf Hochschulen und höchstens 100 Seiten je Hochschule; Cache speichert URLs, Titelbelege, Seitenpositionen und Leseversuche. Folgeläufe setzen bei weiteren Hochschulen/Seiten/Programmen fort. Keine Garantie vollständiger Detailabdeckung nach dem ersten Lauf.
- Offizielle Programmrecords von Discover Uni und Parcoursup werden auch ausserhalb der Hochschul-Domain akzeptiert; Opintopolku wird über den öffentlichen JSON-Record gelesen, nicht über die leere JavaScript-Hülle. Beschreibungen werden nicht in der Seitensuche gespeichert. Fakten bleiben im privaten Store.
- NO: DBH dokumentiert Nettside, liefert die Spalte aber nicht über seine API. Daher geprüfte Zuordnung von DBH-Hochschulcodes zu HK-dirs Hochschul-Websites. Vollständiger Liveabruf: 2’631 Programme, davon 2’614 mit Website. NL übernimmt die Website-Domain aus DUO auch ohne Treffer im englischen Verzeichnis. `data:all` enthält nun alle erlaubten Quellen und meldet Quellenausfälle mit Fehlerstatus.
- Prüfung: 281 Tests, TypeScript, Webpack-Produktionsbuild und unveränderter Demodaten-Build erfolgreich. Drei öffentliche Live-Lesungen mit Anthropic (GB/FR/FI) vollständig verarbeitet und store-validiert; keine persönlichen Daten. Weitere Länder durch gezielte Parser-/Seitensuche-Regressionen abgedeckt; vollständige internationale Detail-Erstbefüllung steht noch aus.

## Abschlussprüfung für Push (13.10.2026)

- Takeout-Anleitung in DE/EN/FR/IT: Hinweis zur YouTube-/News-Auswahl entfernt, Wartezeit von ca. 2–3 Minuten auf die E-Mail ergänzt.
- Gesamter vorbereiteter Stand einschliesslich getrennter Startansichten, freiwilliger Persönlichkeit und My-Activity-Verarbeitung: TypeScript, alle 268 Tests und Webpack-Produktionsbuild erfolgreich.
- Push auf `main` vom Inhaber angefordert; Deployment separat prüfen.

## Ein My-Activity-Import, Titelqualität und Aktualität (13.10.2026)

- Ersetzt den früheren Einstieg mit zwei gleichwertigen Exportlinks: Landingpage und Datenansicht zeigen einen Hauptlink mit `custom/my_activity`. YouTube-Export, OAuth und alle anderen Quellen stehen klein unter einer geschlossenen optionalen Liste. Texte in DE/EN/FR/IT.
- My Activity liest YouTube und ergänzend Google-Suche/News. Google News bleibt auch bei YouTube-Zieladressen eine Nachrichtenaktivität. Der Produktname aus HTML wird auch bei einzeln hochgeladenen Dateien ohne Ordnerpfad erhalten. News wird lokal klassifiziert. Nach Präzisierung des Inhabers nutzt die erste KI-Auswahl nur YouTube; erst die ausdrücklich gewählte 1’000er-Analyse ergänzt bis zu 200 News-Titel mit Vorschau und Zustimmung. Google-Suchen bleiben lokal. News-KI ersetzt die passende Google-Zusammenfassung mit deren schwächerem Quellengewicht; Deaktivierung stellt beide Originale wieder her. Separater News-Import ergänzt den vorhandenen YouTube-Import, Entfernen löscht auch die lokalen News-Rohdaten.
- Videoaufrufe ohne auswertbaren Titel (nur URL, leer, gelöscht/privat/nicht verfügbar) werden vor Zählung, Klassifikation und KI-Kontext entfernt. Ein späterer gültiger Doppeleintrag wird weiterhin akzeptiert. Bereits gespeicherte Summaries brauchen einen Neuimport; Version 7 zeigt den entsprechenden Hinweis.
- Gewicht halbiert sich pro zwei Kalenderjahre; ab sechs Jahren nur historische Darstellung, keine aktuellen Interessen oder KI-Kontexte. Aktuelle Belege und Themen werden bevorzugt; alte Monate erzeugen keinen Beharrlichkeitsbonus. Google-Suche/News hat Quellengewicht 0.15, YouTube-Takeout 0.85. Produktheuristik, keine psychologische Norm. KI-Lauf-/Vergleichsversionen erhöht.
- Die bereitgestellten YouTube- und Google-News-Exporte wurden ausschliesslich lokal geprüft. Keine persönlichen Inhalte ausgegeben, gespeichert oder an die KI geschickt.
- TypeScript und alle 268 Tests grün, einschliesslich Regressionen für alte Daten, fehlende Titel, News erst im Maximum, separate News-Imports, Zustimmung, Wiederherstellung beider Originale und Resultate ohne Fragebogen. Browser-Upload mit synthetischem HTML geprüft: drei gültige Videoaufrufe und ein News-Artikel, URL-only-Video verworfen, Resultatlink bei null Antworten verfügbar; optionale Quellen korrekt eingeklappt. Webpack-Produktionsbuild erfolgreich. Push auf main vom Inhaber freigegeben.

## Getrennte Startansichten (13.10.2026)

- Fragebogen und «Mit deinen Daten» sind separate Ansichten. Die beiden Karten schalten um und markieren die aktive Ansicht; der Datenimport steht nicht mehr unter dem Fragebogen.
- Beide Bereiche bleiben beim Umschalten gemountet, damit der Fragebogen-Tab und laufende Eingaben erhalten bleiben. Studienwünsche und Resultatleiste bleiben gemeinsam verfügbar.
- Bestehende Ankerlinks, OAuth-Rückkehr sowie Browser-Zurück/Vorwärts wählen die passende Ansicht.
- TypeScript, alle 266 Tests und Browserprüfung von Wechsel, Tab-Erhalt, Zurück/Vorwärts und Neuladen des Datenlinks erfolgreich. Lokal umgesetzt, noch nicht veröffentlicht.

## Persönlichkeit wieder freiwillig (13.10.2026)

- Upload-Einstieg ausdrücklich ergänzt: Ein erfolgreicher Import von «Meine Aktivitäten» oder YouTube führt ohne Antworten zum Resultat. Einstiegstexte in DE/EN/FR/IT erklären diesen Weg. Die 25-%-Aussage gilt dort ausdrücklich nur bei zusätzlich beantworteten Interessenfragen.
- Zusätzlicher Regressionstest prüft beide Importarten ohne Antworten, leere und ungültige Dateien sowie den Zustand ohne verbleibende Quelle. TypeScript und alle 261 Tests erfolgreich.
- Auf ausdrücklichen Wunsch des Inhabers entfällt die Pflicht zu den 20 Persönlichkeitsfragen. Diese Änderung ersetzt die frühere Regel «Persönlichkeit als Pflichtteil» weiter unten.
- Die gemeinsame Resultatprüfung akzeptiert mindestens zwei Interessenantworten je Bereich oder eine importierte Datenquelle. Fehlende oder teilweise beantwortete Persönlichkeitsfragen blockieren weder Resultat noch Checkout-Rückkehr.
- Persönlichkeit bleibt als freiwilliger Tab verfügbar. Sperrhinweise entfernt, Texte in DE/EN/FR/IT und README angepasst. Die Fortschrittsanzeige zählt weiterhin alle 67 Einträge, einschliesslich freiwilliger Fragen.
- Prüfung: TypeScript und alle 260 Tests erfolgreich. Lokal umgesetzt, noch nicht veröffentlicht.

## Datenquellen vereinfacht (13.10.2026)

- Landingpage und Datenimport zeigen «Meine Aktivitäten» und YouTube mit je einem eigenen Takeout-Link. Ein gemeinsames Upload-Feld erlaubt beide Exporte zusammen; die Anleitung erklärt die gemeinsame Auswahl.
- Instagram, TikTok, Reddit, GitHub und Spotify liegen unter «Optional · weitere Quellen», standardmässig eingeklappt. Der Fragebogen bleibt Schritt 1. Texte in DE/EN/FR/IT angepasst.
- TypeScript und alle 260 Tests grün; Quellenbereich und Aufklappen im lokalen Browser geprüft. Noch nicht veröffentlicht.

## Einstieg, Schweizer KI und Hochschulfilter (13.10.2026)

- Ein Ablauf: zuerst der Fragebogen, danach freiwillig eigene Daten. Die zwei farbigen Karten bleiben als Sprunglinks zu Schritt 1 und Schritt 2; der Datenimport lässt sich überspringen.
- Landingpage: Der grössere Schweizer-KI-Abschnitt steht direkt unter den drei Einstiegskarten. Er erklärt eigene YouTube-Daten, die freiwillige Themenanalyse bei Infomaniak und den Abgleich mit der Studiengangsdatenbank. Texte in DE/EN/FR/IT; der Button beginnt beim Fragebogen.
- Schmale Fortschrittsbalken zeigen den Stand der Inhaltsanalyse und des anschliessenden Studiengangvergleichs.
- Hochschultyp als gespeicherter Filter in Studienwünschen und Resultaten; wirkt auf Rangliste, Vorschau, Suche und CSV. Geteilte Resultate enthalten die Auswahl. Alte Links übernehmen keinen Hochschultyp aus dem Profil der betrachtenden Person. Verspätete Vorschauen können einen neu gewählten Filter nicht überschreiben.
- Testhilfen aktualisiert: Der Einwilligungstest unterstützt den Fortschrittszustand; der Vergleichstest prüft, dass reine Katalogerklärungen die angezeigten Punkte unverändert lassen.
- Prüfung: TypeScript, alle 260 Tests und Webpack-Produktionsbuild erfolgreich. Landingpage auf Desktop und 390 px geprüft, ohne horizontalen Überlauf; Sprunglink und Einstieg in den Fragebogen geprüft. Keine echten persönlichen Daten an die KI gesendet.

## Infomaniak-Migration (13.10.2026, lokal umgesetzt)

- Alle KI-Aufrufe in dieser App und im öffentlichen Studiengangsleser verwenden jetzt `google/gemma-4-31B-it` bei Infomaniak. Gemeinsamer Transport: `lib/infomaniak.ts`; kein Fallback zu einem anderen Anbieter. Die separate Blog-Automation im privaten Repo ist nicht geändert.
- `INFOMANIAK_API_TOKEN` und `INFOMANIAK_PRODUCT_ID` sind lokal getestet. Laut Inhaber sind beide Variablen inzwischen auch im Vercel-Projekt eingetragen; Production-Zuordnung und neues Deployment sind erforderlich. Für `wsis-fakten.yml` werden sie zusätzlich als GitHub-Secrets benötigt. Keine Secrets gedruckt, kein Deployment oder Push vorgenommen.
- Persönliche Anfragen/Antworten werden nicht auf dem App-Server gespeichert, gecacht oder als Text protokolliert. Stateless API, keine Conversation-ID, keine Weiterleitung auf andere Hosts. Öffentlich abgeleitete Studiengangsanalysen und Übersetzungen bleiben wiederverwendbar gespeichert; persönliche Ergebnisse liegen im Browser.
- DPA/AVV und LLM-Bedingungen geprüft; Links und Grenzen im README. DPA gehört laut Dokument zu den ANB. Kein dokumentierter Zero-Retention-Schalter gefunden. Temporäre Verarbeitung und Betriebs-/Abrechnungsmetadaten bleiben laut Bedingungen möglich; kein Versprechen «absolut nichts gespeichert» oder «alle Website-Daten nur Schweiz».
- Landingpage mit Schweizer KI-Badge und drei konkreten Anwendungen in allen vier Sprachen. Einwilligungen und Datenschutz nennen Infomaniak und unterscheiden dessen KI-Verarbeitung von Vercel/Stripe. Gemma wird nicht als in der Schweiz entwickeltes Modell ausgegeben.
- Alte Anbieter-Einwilligungen starten keine automatische Übermittlung an Infomaniak. Neuer Einwilligungsschlüssel und Fortschritts-/Vergleichsversionen; Regressionstest für alte laufende und abgeschlossene Vergleiche.
- Liveprüfung nur mit erfundenen Daten: 60/60 Titel strukturell gültig, zunächst 58/60 erwartete Themen; nach präzisierter Vorgabe besteht die betroffene Zehnergruppe vollständig. 25/25 persönliche Erklärungen vollständig innerhalb 40 s. Fünf öffentliche Testseiten in Dreiergruppen nach Quellen-/Sprachkorrektur: 35/35 automatische Prüfungen; manuelle Sprachkontrolle passend. Echte Übersetzungsfunktion mit erfundenem Satz erfolgreich. Kein Lasttest mit realen Nutzerprofilen.
- Lokale Berichte: `scrapers/out/infomaniak-migration-live`, `infomaniak-content-final`, `infomaniak-readings-final` (ignorierte synthetische Daten). Benchmark nutzt bei Gemma den Produktions-Transport; bestehende historische Berichte bleiben erhalten.
- Abschlussprüfung: TypeScript und Webpack-Produktionsbuild erfolgreich, Browserprüfung von Landingpage/Anker. 258/259 Tests bestanden, einschliesslich sechs neuer Transport-/Einwilligungstests. Ein bereits vor der Migration bekannter Fehler in `personal comparisons require a click …` (`88 !== undefined`) bleibt bestehen.

## Arbeitsweise im Repo

- Direkt auf `main` pushen, keine PRs.
- Texte auf Deutsch: Schweizer Hochdeutsch, kein ß, Anführungszeichen «», schlicht und konkret, keine Werbefloskeln. Alle UI-Texte stehen in `lib/site/dict.ts` (en, de-CH, fr, it, dazu Overrides für DE/AT).
- Checks vor jedem Push: `npx tsc --noEmit -p tsconfig.json` und `node --test test/*.test.ts` (zurzeit 219 grün). Demodaten mit `node scrapers/build.ts --sample`.
- Scraper nehmen nur Fakten (Name, Stufe, Sprache, ECTS, Dauer, Namen von Vertiefungen, Link), keine Beschreibungen. robots.txt beachten, 1.5 s zwischen Anfragen.
- Persönliche Exporte (Takeout usw.) des Inhabers nie ausgeben oder committen.

## Was arbeiten: kostenlose Berufsideen, Schweizer Stellen und Firmenvergleich (13.10.2026)

- Neue Unterseite `/wasarbeiten`, auf der globalen Domain `/schweiz/wasarbeiten`; Link direkt im Resultat, unabhängig vom Kauf. Alle Sprachversionen und Mounts nutzen dieselbe View. Zunächst Schweiz, vom Inhaber bestätigt.
- «Beta» steht im Linktext auf dem Studienresultat und als gelbes Label im Kopf von «Was arbeiten?»; in allen vier Sprachversionen.
- Übernimmt Antworten und `effectiveSummaries` aus dem bestehenden Browser-Store, einschliesslich bereits aktivierter Inhaltsanalyse. Kein neuer Upload und kein KI-Aufruf. Ein geteiltes Resultat ersetzt das eigene Profil nicht. Zusätzliche Wünsche stehen unter `workPrefs` im selben Store und werden mit «Daten löschen» entfernt.
- 25 redaktionelle Berufsrichtungen als langfristige Orientierung plus aktuelle Inserate. Eigenes Modell aus Tätigkeitsinteressen, Schulfächern, Werten und vorhandenen Interessen; keine Freigabe oder Kopie der bezahlten Studiengangdaten. Persönlichkeit wird nicht für Firmenurteile genutzt.
- Firmenvergleich: Arbeitsort, Arbeitsmodell und Branche, immer bezogen auf dieselbe konkrete Stelle. Unbekannte Angaben bleiben unbekannt; Teamkultur, Lohn und Führung werden nicht erfunden. Einstieg wird aus expliziten Angaben im Stellentitel oder strukturierten Stellenfeldern abgeleitet und entsprechend bezeichnet.
- `scrapers/jobs.ts` liest öffentliche SmartRecruiters-Karriereseiten mit beiden Paginierungsebenen. `scrapers/job-feeds.ts` ergänzt die öffentlichen Suchfeeds von Coop, Bund und SBB. Immer robots.txt und 1,5 Sekunden Abstand; keine Beschreibungen oder Kontaktdaten im Datensatz. Die zentrale SmartRecruiters-API bleibt wegen robots.txt ausgeschlossen.
- Erweiterung auf Wunsch des Inhabers: echter Abruf am 13.10.2026 mit **2’954 Inseraten**, **93 Arbeitgebernamen/Organisationseinheiten**, davon **964 Lehrstellen, Praktika und Trainee-Stellen**. Quellen: Coop 2’235, Bund 421, SBB 147, Swissquote 37, Swiss Medical Network 110, Nexthink 4. Alle sechs Quellen erfolgreich. Noch keine Vollabdeckung der Schweiz. Migros und Post untersucht, aber nicht eingebunden (Migros hätte zusätzliche Detailabrufe benötigt; Post-Schnittstelle für unseren Leser gesperrt).
- Landprüfung anhand Arbeitsland, bei Coop-Lehrstellen ersatzweise explizitem Schweizer Kanton. «Ausland» beim Bund hat Vorrang vor dessen teils voreingestelltem Land «Schweiz». Schnupperangebote, Initiativbewerbungen, zukünftige und abgelaufene Inserate ausgeschlossen; gleiche Stellennummern zusammengeführt. Paginierung verwirft unvollständige, wiederholte oder währenddessen veränderte Feeds.
- Firmenbranche für Coop-Töchter separat statt pauschal Handel; neue Branchen in allen vier Sprachen. Sichtbare Gesamtzahl, Ausbildungsangebote, Arbeitgeberzahl und Quellenzahlen. Firmenkarten mit «Weitere Arbeitgeber zeigen». Einstieg aus expliziten Titeln oder strukturierten Angaben. `--sources Coop,Bund,SBB` erlaubt gezielte Aktualisierung und bewahrt den tatsächlichen Stand unberührter Quellen.
- Grössere Datensätze werden ausserhalb des 2-MB-Fetch-Caches von Next geladen (begrenzte native HTTP-Anfrage, geteilter stündlicher Speicher). Regressionstest mit 5’100 Inseraten über 2 MB.
- `npm run data:jobs` erneuert `data/jobs/current.json`. Täglicher Workflow `.github/workflows/wsis-jobs.yml` (04:41 UTC) publiziert nach dem Push auf main den separaten Branch `whatshouldistudy-jobs`. Die App liest `jobs.json` dort über die Vercel-Repoangaben oder `WSIS_JOBS_URL`, mit stündlicher Revalidierung. Bis zum ersten Workflowlauf gilt der gebündelte Snapshot mit originalem Prüfdatum. Workflow noch nicht auf GitHub ausgeführt.
- Vollständige Abrufe entfernen verschwundene Stellen. Fehler oder ein auffälliger Rückgang bewahren den vorherigen Stand mit alten Prüfdaten. Abgelaufene und sieben Tage ungeprüfte Stellen verschwinden automatisch. Quellenstatus bleibt sichtbar.
- Prüfung: 20 neue Tests für Zuordnung, Firmenbedingungen, sichere Links, Ablauf, vollständige Paginierung, Ausfälle, Sprachrouten, gerenderte Begründungen und grosse Datensätze. TypeScript und Webpack-Produktionsbuild grün. Gesamtsuite 257/258 grün; der bekannte Fehler in `personal comparisons require a click …` (`88 !== undefined`) bleibt, zuvor in einer separaten Kopie von HEAD bestätigt. Browser: eigenes fiktives Profil weiterhin verbunden, 2’954 Inserate sichtbar, Ausbildungsfilter 964, Suche SBB 147, Firmenkarten von 6 auf 12 nachgeladen. Desktop und 390 px ohne horizontalen Überlauf. Screenshot `/tmp/wasarbeiten-expanded.jpg`. Nur lokale Umsetzung, noch kein Push/Deploy oder GitHub-Workflowlauf.

## Suchtreffer mit KI einordnen, auch nach der Analyse (13.10.2026)

- Ursache: Nach der Verlaufsanalyse war «Mit KI vergleichen» in allen Listen ausgeblendet. Der gespeicherte Vergleich deckt aber nur die 60 besten Treffer der sechs ersten Fächer ab, eine Suche dagegen alle Fächer. Psychologie ist bei dieser Person das siebte Fach («Platz 7»), deshalb hatte Master Psychologie bei «psych» weder eine Zahl der KI noch eine Begründung.
- Jetzt erscheint der Knopf, sobald ein sichtbarer Treffer nicht im gespeicherten Vergleich liegt. Er fragt nur diese Treffer an (`notCovered` in `app/ui/programmes.tsx`). Die gespeicherten Treffer behalten Zahl und Begründung. Beide Quellen werden zusammengeführt, der gespeicherte Vergleich hat Vorrang (`listRatings`). Ohne solche Treffer bleibt es beim Hinweis «Der KI-Vergleich nach der Verlaufsanalyse gilt hier», ohne Knopf.
- Die Zustimmungstexte nannten «bis zu 20» Treffer, gesendet werden bis zu 60 (`PERSONAL_POOL`). Korrigiert in DE, EN, FR und IT, ebenso der Hinweis «ausserhalb der 20 besten» (jetzt 60).
- Offen: Die Einordnung von Suchtreffern wird nicht gespeichert. Nach einem Neuladen braucht es wieder einen Klick und neue Anfragen. Ob sie gespeichert werden soll, entscheidet der Inhaber.
- Prüfungen: TypeScript grün; Tests 230 von 233 (die drei bekannten). Im Browser mit den echten Daten: «psych» mit allen Stufen zeigt den Knopf; nach dem Klick wurden 23 Treffer angefragt (20 und 3), die Begründungen erscheinen, die Top 5 bleiben unverändert. Ohne Suche: Hinweis, kein Knopf. Neuladen: Top 5 und Begründungen bleiben, keine zusätzlichen Anfragen.

## KI-Vergleich nach dem Neuladen: alte Schlüssel werden erneuert (13.10.2026)

- Ursache, auf die das Verschwinden hinausläuft: Ein gespeicherter Vergleich trägt den Schlüssel der Vorversion. Dieser Schlüssel passt zu keiner Liste. Die Top 5 zeigen dann die Reihenfolge ohne KI und ohne Begründungen, bei jedem Laden. Im Browser reproduziert: Schlüssel im localStorage auf das alte Format setzen, neu laden. Der normale Ablauf (Analyse, Neuladen, Neuladen während des Vergleichs) zeigt das Problem nicht.
- `profileKeyOf` trägt jetzt eine Version (`KEY_VERSION = 2` in `lib/engine/programme-changes.ts`). `isCurrentKey` prüft sie. Ein gespeicherter Vergleich ohne aktuelle Version gilt als veraltet. Ist die Analyse aktiv und die Person entsperrt, startet `ProgrammeChanges` den Vergleich einmal von selbst neu (`app/ui/programme-changes.tsx`). Es geht dasselbe Profil an die KI wie beim ersten Vergleich, unter der damaligen Zustimmung zur Analyse. Seit der Infomaniak-Migration oben gilt zusätzlich die Prüfung der Anbieter-Einwilligung. Ein manuelles «Vergleich wiederholen» ist nicht mehr nötig.
- Bei jeder Änderung an der Schlüsselbildung die Version erhöhen. Sonst bleiben alte Vergleiche unbemerkt stehen.
- Offen, Entscheidung des Inhabers: Die KI-Zahl darf bis 30 Punkte von der Profilzahl abweichen (`PERSONAL_SWING` in `lib/engine/programme-fit.ts`, bewusst so entschieden). Bei Master Psychologie begründet die KI mit «Psychologie fehlt in deinen Themen» und zieht bis zum Rand ab. 16 und 15 sind dann Profilzahl minus 30, wenn die Profilzahl bei etwa 45 bis 46 liegt. Zur Wahl: ±15 insgesamt, oder nach oben ±30 und nach unten höchstens 15.
- Prüfungen: TypeScript grün; Tests 230 von 233 (die drei bekannten). Im Browser gegen `next start` und `next dev` mit einer lokalen Kopie des Datenbranchs: Analyse, Neuladen, Neuladen während des Vergleichs, alter Schlüssel (eine automatische Erneuerung, danach keine weiteren Anfragen beim Neuladen).

## Suche über alle Fächer, KI-Sortierung bleibt nach dem Neuladen (13.10.2026)

- Textsuche und Stadtsuche durchsuchen alle Fächer (`lib/server/rank.ts`). Vorher las der Server nur die Fächer der Person; «psychologie» in «zürich» fand deshalb nichts, obwohl es Master und Bachelor Psychologie an der Universität Zürich gibt. Ohne Suchbegriff bleibt es bei den eigenen Fächern.
- Der gespeicherte KI-Vergleich hängt an den Antworten, dem Studienfach und den Quellen mit Erhebungszeit (`profileKeyOf` in `lib/engine/programme-changes.ts`). Abgeleitete Punkte und Filter zählen nicht mehr; ein Filterwechsel ändert die Sortierung nicht.
- Die Zeilen des Vergleichs liegen in IndexedDB (`compare:<Site-Schlüssel>`), nicht mehr in der Zustandsdatei im localStorage. Dort gibt es eine Größenbegrenzung, und ein fehlgeschlagenes Schreiben geht beim Neuladen verloren. Im localStorage bleiben nur Status, Zeitpunkt und Schlüssel. «KI-Analyse löschen» entfernt auch die Zeilen.
- Der Schlüssel hat seit diesem Deploy eine Version. Ältere Vergleiche werden automatisch erneuert (siehe oben).
- Prüfungen: TypeScript grün; Tests 228 von 231 (die drei bekannten). Im Browser mit Mock-Antworten: Analyse, Neuladen, kein «Mit KI vergleichen», Sortierung bleibt. Serverfunktion: «psychologie» in «zürich» liefert Master Psychologie. Die Speichergrenzen auf dem Gerät des Inhabers sind nicht geprüft.

## Karten-Label «Top» nur bei YouTube & Google (13.10.2026)

- Auf der Startseite trägt nur die Karte «YouTube & Google» das Label «Top». Instagram und TikTok haben keins mehr; Spotify bleibt bei «Optional».
- Betroffen: `app/views/start.tsx` (drei Karten mit `badge`, nur noch eine) und `lib/site/dict.ts` (`badge` der Quellen in vier Sprachen). Die Landing-Seite liest dieselbe Liste.

## Vergleich mit bis zu 60 Treffern (13.10.2026)

- «Mit KI vergleichen» in den Top 5 und im Browser vergleicht bis zu 60 Treffer statt 20. Der Hinweis nennt die tatsächliche Anzahl (`PERSONAL_POOL` in `app/ui/readings.tsx`, jetzt 60).
- Der Server nimmt weiterhin höchstens 20 Programme pro Anfrage (`PERSONAL_REQUEST` in `lib/engine/programme-fit.ts`; `MAX_PERSONAL` in `lib/server/personal-fit.ts` nutzt denselben Wert). Die Oberfläche teilt die Liste in Anfragen zu 20 und schickt sie gleichzeitig. Ein Limit bricht den Vergleich ab; eine andere fehlgeschlagene Anfrage lässt die übrigen gelten. Der Grund: 60 in einer Anfrage ergäbe 12 gleichzeitige Modellaufrufe in einer Route mit 60 Sekunden.
- Der Vergleich nach der Verlaufsanalyse umfasst ebenfalls die 60 besten (`COMPARE_TOP`, vorher 50), damit Top-Liste und Analyse dieselben Treffer haben. Die Texte in DE, EN, FR und IT nennen 60.
- Kosten: je Vergleich zwölf Modellaufrufe zu je fünf Programmen statt vier. Die Anfrage bleibt bei 20 pro Route-Aufruf.

Prüfungen: TypeScript grün; Tests 231, davon 228 grün (wie zuvor). Im Browser mit Mock-Antworten geprüft: Die Liste schickt 60 Programme in drei Anfragen (20, 20, 20), der Text lautet «bis zu 60 Treffer»; der Vergleich nach der Analyse speichert 60 Zeilen, die Top 5 stehen in der Reihenfolge der Tabelle, keine Seitenfehler. Nicht geprüft: echte Modellantworten und Laufzeiten bei 60.

## Fortsetzbar, Maximum 1000, Listen nach der Analyse (12.10.2026)

- Maximum umfasst bis zu 1000 Einträge (`CONTENT_MAX`, vorher 2000). Standard bleibt bei 240.
- Der Fortschritt wird nach jeder beantworteten Gruppe im Browser gespeichert: IndexedDB, derselbe Store wie der Import, eigener Schlüssel `progress:<Site-Schlüssel>`. Ein wieder geöffneter Tab zeigt «Bereits eingeordnet: n von m» und «Weiter einordnen»; bereits beantwortete Gruppen werden nicht erneut gesendet. Es startet nichts von allein: der Klick ist die Einwilligung.
- Der Zwischenstand verlässt den Browser nicht und enthält dieselben Einordnungen, die das Ergebnis ohnehin hält. Er wird gelöscht, wenn der Lauf fertig ist, wenn man «Zwischenstand verwerfen» wählt, wenn die KI-Analyse entfernt oder der Import ersetzt wird, und nach 7 Tagen ohne neue Gruppe. Ein Lauf, den das Budget stoppt, behält seinen Stand. Gilt nur für denselben Import und dieselbe Version (`CONTENT_RUN_VERSION`); sonst wird er verworfen.
- Listen nach der Analyse: Die Top 5 und der Studiengangsbrowser nehmen Punkte, Reihenfolge und Begründungen aus dem gespeicherten Vergleich (`contentAnalysis.compare`), solange die Anfrage dieselbe ist: Felder, Angaben und Themen (`requestKey`). Dann entfällt der Knopf «Mit KI vergleichen» und es erscheint ein Hinweis. Ändern sich Angaben, Filter oder die Verlaufsanalyse, erscheint der Knopf wieder.
- Die Begründungen stehen im aufgeklappten Bereich «Wie gut er zu dir passt» unter «Begründung von Infomaniak». Eine zweite Stelle direkt unter dem Titel gibt es nicht mehr (auf Wunsch des Inhabers, 13.10.).
- Der Studiengangsbrowser zeigt 10 Einträge pro Seite (`PAGE_SIZE`); die Serveranfrage nach Stufe, Land oder Stadt sendet dieselbe Seitengröße.
- Startseite (DE): Der Einstieg nennt den YouTube-Verlauf mit der Zustimmung für die KI und beschreibt die Passung mit Details (Schwerpunkte, Dauer, Sprache, Kosten, Zulassung) im Vergleich mit den persönlichen Angaben. Datenschutzpunkte ergänzt um Zwischenstände und Zustimmung. Der frühere pauschale Speicherhinweis wurde mit der Infomaniak-Migration durch den präziseren Hinweis auf lokale Antworten und persönliche KI-Ergebnisse ersetzt. Der Server führt nur Summenzähler; das hat der Inhaber bestätigt.

Prüfungen: TypeScript grün; Tests 231, davon 228 grün. Die drei Fehlschläge (`content control`, `existing imports`, `personal comparisons`) bestehen auch auf `main`. Im Browser mit Mock-Antworten geprüft: Unterbrechung nach vier Gruppen, Neuladen zeigt «Bereits eingeordnet: 40 von 66», Weiter sendet nur die drei fehlenden Gruppen; danach ist der Zwischenstand gelöscht. Vergleich fertig: Top 5 in derselben Reihenfolge wie die Tabelle, kein Knopf «Mit KI vergleichen», Hinweis sichtbar, Begründungen im aufgeklappten Bereich, 10 Zeilen im Browser, keine Seitenfehler. Nicht geprüft: echte Modellantworten und echte Laufzeiten.

## Inhaltsanalyse: kleine Gruppen, Teilergebnis, Wiederholung (12.10.2026)

- Ursache des Abbruchs, soweit im Code belegt: Eine Gruppe von 40 Titeln wurde ganz verworfen, sobald ein einziger Titel fehlte, doppelt kam, ein viertes Fach hatte oder eine Zahl ausserhalb von 0 bis 1 lag. Eine Anfrage mit 40 Titeln musste zudem in 45 Sekunden fertig sein. Beim Maximum-Lauf brach ein einzelner Ausfall den ganzen Lauf ab. Welcher Fall im Live-Betrieb auftrat, ist nicht belegt; in der Entwicklungsumgebung fehlt der Schlüssel.
- Gruppen zu je 10 Titeln, vier Anfragen gleichzeitig. Eine Gruppe wird bis zu dreimal versucht. Bleibt sie danach leer, fehlen nur ihre Titel; die übrigen zählen weiter.
- Ungültige Teile einer Antwort werden einzeln verworfen: fremde oder doppelte IDs, leere Begründung, unbekanntes Fach, Zahl ausserhalb 0 bis 1. Höchstens drei Verbindungen je Titel, die stärksten zuerst.
- Kein Abbruch bei Teilausfällen: Was eingeordnet wurde, wird übernommen und mit «Eingeordnet: n von m» gezeigt. Liegt die neue Zahl unter der des bestehenden Ergebnisses, bleibt das bestehende stehen, und die Meldung sagt warum. Erreicht das KI-Budget sein Limit, bleibt das bis dahin Eingeordnete erhalten. Nur wenn gar nichts eingeordnet wurde, gibt es keine neue Auswertung.
- Der Lauf läuft im Browser. Der Tab muss offen bleiben: Wird er geschlossen oder neu geladen, bricht der Lauf ab, und der Fortschritt ist weg. Das bisherige Ergebnis bleibt erhalten. Fortsetzen nach dem Neuladen ist nicht umgesetzt.
- Maximum zeigt die tatsächliche Zahl: das Minimum aus Einträgen und 2000. Unter 2000 Einträgen nimmt er alle.
- Serverprotokoll je Gruppe: nur Anzahl angefragt und beantwortet sowie die Art des Fehlers, nie Titel oder Meldungstexte.
- Kosten für 2000 Einträge: rund 0,13 $ statt 0,10 $, weil jede Anfrage Systemtext und Fächerliste erneut schickt. Dauer geschätzt etwa 8 Minuten. Offene Tabs mit dem alten Stand einmal neu laden.

Prüfungen: TypeScript grün; Tests 229, davon 226 grün; die drei Fehlschläge in `content-analysis` und `personal-comparison` bestehen auch auf `main`. Im Browser mit simulierten Ausfällen geprüft: Wiederholung (Gruppe dreimal geschickt, vollständig), Teilergebnis (56 von 66), Budget-Grenze (20 von 66 mit Hinweis, Ergebnis gespeichert), Maximum mit 46 von 66 (bestehendes Ergebnis mit 60 Titeln bleibt). Nicht geprüft: echtes Modell und echte Laufzeiten.

## Vergleich der 50 besten Studiengänge nach der Inhaltsanalyse (12.10.2026)

- Nach dem Lauf «Verlauf mit KI verstehen» vergleicht die KI automatisch die 50 besten Studiengänge mit den neuen Angaben. Das geht in drei Anfragen an `/api/personal-fit` (20, 20 und 10 Programme); die Grenze von 20 pro Anfrage bleibt bestehen.
- Die Einwilligung der Analyse nennt den Vergleich. Ältere Analysen starten ihn nur mit einem Klick auf «Die 50 besten Studiengänge mit deinen Angaben vergleichen».
- Der Vergleich liegt im Browser (`contentAnalysis.compare`), nicht auf dem Server. «Vergleich wiederholen» umgeht den Zwischenspeicher für gleiche Anfragen, sonst käme dieselbe Antwort zurück.
- Die Tabelle zeigt Platz und Punkte vorher und jetzt, die Begründungen darunter. Die Zahl jetzt ist die KI-Zahl, wo die KI bewertet hat; sonst die Zahl ohne KI.
- Die Hauptliste bleibt beim Vergleich mit Klick für 20 Programme. Sie übernimmt die Ergebnisse dieses automatischen Vergleichs nicht.
- Kosten: rund 1 bis 2 Cent je Lauf. Das Budget pro Bericht (ab 1. November 1 $) und das Tageslimit gelten wie bisher.

Prüfungen: TypeScript grün; neue Tests in `test/programme-changes.test.ts`. Im Browser geprüft mit Mock-Antworten für Lesungen, Programmliste und KI: Erfolg mit drei Anfragen und Wiederholung, Fehler mit HTTP 503. Nicht geprüft: echte KI-Antworten und das echte Budget.

## Bis zu 2000 Einträge einordnen (12.10.2026)

- Nach dem Standardlauf mit 240 Einträgen bietet «Verlauf mit KI verstehen» die Option «Maximum» an: bis zu 2000 Einträge, in Gruppen zu je 40 nacheinander. Das Ergebnis ersetzt das bisherige; die ersten 240 werden dabei erneut gesendet.
- Die Anfrage-Prüfung lässt vierstellige IDs zu, weil bis 2000 Einträge nummeriert werden. Der Tab muss offen bleiben, bis alle 50 Anfragen durch sind.
- Kosten für 2000 Einträge: rund 0,10 $ mit Haiku 5.5, gemessen an den Anfragegrössen des Codes.

## Allgemeine Wörter und eine Zahl je Studiengang (12.10.2026)

- Auf Wunsch des Inhabers zählen Wörter wie «society», «Gesellschaft», «sociedad», «società» und «société» (dazu «gesellschaftlich») nicht als Thema. Sie bestimmen weder die Sortierung der Studiengänge, noch erscheinen sie als Begründung oder in der Themenliste. Die Fachzuordnung bleibt unverändert; die Wörter zählen dort weiter als Belege.
- Die Liste ist bewusst kurz. Eine Gewichtsschwelle im Lexikon hätte auch «Armut», «Recycling» oder «Bitcoin» ausgeschlossen. Weitere breite Begriffe wie «Identität» oder «gender» bleiben vorerst; sie lassen sich in `GENERIC` in `lib/engine/classifier.ts` ergänzen.
- Gespeicherte Zusammenfassungen behalten die Wörter, beim Lesen werden sie herausgefiltert. Die Änderung wirkt darum auch bei bereits importierten Daten, ohne erneutes Einlesen. Der Server verwirft die Begriffe ebenfalls, damit ältere Browser-Tabs sie nicht mehr mitschicken.
- Entscheidung zur Zahl: Die KI-Zahl ersetzt die sichtbare Zahl, sobald eine ausreichende Lesung vorliegt. Die sichtbare Zahl ist sonst 80 % Profil und 20 % Lesung. Die KI-Zahl bleibt innerhalb von ±30 Punkten um diese Zahl. Mit einer Mittelung hätte die KI die Zahl nur schwach bewegt; der Inhaber wollte eine sichtbare Wirkung und nur eine Zahl. Ohne ausreichende Lesung bleibt die Profilzahl. Rückgängig machen: `shownScore` in `lib/engine/programme-fit.ts`.

Prüfungen: TypeScript grün. Neuer Test in `test/generic-topics.test.ts`. Von 222 Tests sind 219 grün. Die drei Fehlschläge in `content-analysis` und `personal-comparison` bestehen auch auf `main` ohne diese Änderung.

## KI-Begründungen auch ohne Lesungen (12.10.2026)

- Ursache des gesperrten Vergleichs bei zwölf Treffern: Suche und Top-Liste liessen nur Studiengänge mit ausreichender Lesung in den Vergleich. Die Obergrenze von 20 war keine Mindestanzahl.
- Beide Listen vergleichen jetzt bis zu 20 vorhandene Treffer, auch ohne Lesungen oder bei Ausfall der Faktenabfrage. Der Hinweis nennt die tatsächliche Anzahl. «Mit KI vergleichen» öffnet weiterhin zuerst die Einwilligung; Änderungen der Suche verlangen erneut einen Klick.
- Der Server löst jeden Studiengang anhand seiner ID im eigenen Katalog auf. Ohne ausreichende Lesung erhält die KI nur Namen, Fachzuordnung, vorhandene Schwerpunkte und belegbare Themenverbindungen als Grundlage. Solche Begründungen erscheinen ausdrücklich als Einordnung aus Katalogdaten in den Details. Sie verändern keine Punkte, auch wenn Browser und Server unterschiedliche Lesungsstände haben. Leere Begründungen werden erneut angefragt und bei erneutem Fehlschlag als Fehler behandelt.
- Texte in DE/EN/FR/IT und README nachgeführt. Paywall und KI-Budget unverändert. Die entfernten Themenbanner bleiben entfernt.

Prüfungen: TypeScript und alle 219 Tests erfolgreich. Regressionen prüfen zwölf Treffer mit dünnen bzw. fehlenden Lesungen durch Suche, Einwilligung, Versand und Detailansicht, Top-Liste, Filterwechsel, Servergrenzen bei 1/12/25 Treffern, neutrale Punkte, gemischte Lesungen sowie HTTP 401 ohne Freischaltung. KI-Transport und Katalogdaten sind synthetisch; kein echter KI-Aufruf.

## Themenbanner auf Studiengangkarten entfernt (12.10.2026)

Auf Wunsch des Inhabers entfällt das Banner «Passt zu dir wegen …» mit Häufigkeiten und angesehenen/gesuchten Beispielen auf den Studiengangkarten. Zugehörige Bannertexte in allen vier Sprachen entfernt. Die Themenberechnung und die aufklappbaren Detailbegründungen bleiben erhalten. TypeScript und 19 bestehende Tests zu Passung, Themen und KI-Vergleich erfolgreich.

## Persönlichkeit als Pflichtteil (12.10.2026)

- Auf Wunsch des Inhabers sind alle 20 Mini-IPIP-Antworten für das eigene Resultat erforderlich, auch im Datenmodus. Die gemeinsame Freigabeprüfung gilt auf Start-, Ergebnis- und Checkout-Rückkehrseiten. Geteilte Resultate bleiben lesbar.
- Persönlichkeit ist der zweite reguläre Fragebogen-Tab nach den Interessen. Die 20 Antworten zählen im Gesamtfortschritt mit (67 Einträge). Fehlende Antworten werden auf der Start- und Ergebnisseite angezeigt, auch auf kleinen Bildschirmen. Vorhandene Antworten bleiben erhalten.
- Texte in DE/EN/FR/IT und README nachgeführt. Die Berechnung und Gewichtung der Persönlichkeit wurde nicht geändert.

Prüfungen: 218 Tests und TypeScript erfolgreich. Gerenderte Oberfläche in allen vier Sprachen geprüft: vier Tabs, 20 Persönlichkeitsfragen und kein eingeklappter freiwilliger Teil. Neue Regressionen prüfen fehlende und ungültige Antworten sowie die Freigabe mit und ohne Import.

## KI-Verlauf: vorhandenen Import verwenden und Wirkung zeigen (12.10.2026)

- Der normale Import speichert eingelesene YouTube-Exportdaten lokal in IndexedDB, getrennt pro Website. Der KI-Bereich bereitet daraus die Stichprobe vor und fragt vor dem Senden ausdrücklich nach. Der zweite Datei-Upload entfällt, auch nach Neuladen oder Checkout-Rückkehr. Ohne Browser-Speicher bleibt eine Kopie für den laufenden Besuch verfügbar.
- Löschen der Quelle oder aller Daten entfernt auch die Importdaten; ein neuer Import ersetzt sie. Abbruch, neue Importe und gelöschte Quellen verhindern weitere Batches und die Übernahme alter Antworten. Original- und KI-Zusammenfassung bleiben getrennt. Alte KI-Ergebnisse funktionieren weiterhin; bei alten Importen ohne Originaltitel ist einmaliges Einlesen auf der Startseite nötig.
- «Was die KI verändert hat» vergleicht Platz und Punkte der ersten zehn Fächer mit und ohne KI, unter denselben übrigen Eingaben. Eine unveränderte Reihenfolge wird ausdrücklich benannt. Stichprobengrösse, Fachgewichtung, Paywall und KI-Budget bleiben unverändert. Der Vergleich lässt sich aus bereits vorhandenen KI-Zusammenfassungen lokal berechnen.
- Hinweise zur lokalen Speicherung auf Start-, Datenschutz- und Landingseiten in DE/EN/FR/IT und README angepasst. Keine persönlichen Daten oder echten KI-Anfragen für die Tests verwendet.

Prüfungen: 217 Tests, TypeScript und Produktionsbuild mit `next build --webpack`. Fünf Prüfungen mit nativer IndexedDB im Browser bestätigen Wiederherstellung nach einem neuen Modulaufruf, Trennung der Websites, Ersetzung und Löschung.

## Sozialwissenschaften: gezielte Lexikonkorrekturen am 12.10.2026

Auf «entscheide du» zum vorangegangenen Engine-Test wurden die belegten Lexikonlücken mit Regressionen geschlossen. Zusätzliche Interessenfragen und eine pauschale 70-Punkte-Grenze wurden nicht eingeführt: Der kürzlich gekürzte Fragebogen und die Punkteskala brauchen dafür eine eigene Prüfung.

- Politik erkennt unter anderem Abstimmungen, Volksinitiativen, Koalitionen, Wahlkämpfe, Misstrauensvoten, EU-Erweiterung und Ständerat sowie passende englische, französische und italienische Begriffe. Geschichte erkennt gebeugte Wendungen zum Römischen Reich, Kalten Krieg und Dreissigjährigen Krieg, Hanse, Middle Ages und ausdrücklich benannten Mauerbau 1961.
- Ethnologie erkennt Himba, Inuit, Aborigines, Māori und Dogon, Bräuche, ethnografische Methoden und Wendungen zu Ursprungsmythen. Alleinstehendes «Rome», «Mauerbau», «Feldforschung» oder «myths» wird nicht pauschal einem Fach zugeschlagen. Māori-Rugbytitel, Instrumenten-/Terminabstimmung und ausdrücklich benannte Unternehmenskoalitionen liefern keine Ethnologie-/Politikbelege. Ein Religionsbezug wird weiterhin als solcher erkannt.
- Der Matcher unterstützt Sterne nur bei einzelnen Tokens. Das wirkungslose `social norm*` wurde durch Singular und Plural ersetzt; die Einschränkung steht jetzt in der Lexikon-Dokumentation. Importversion 6 weist bei älteren Zusammenfassungen auf erneutes Einlesen hin. Basisraten, Gewichtung, Fragebogen und Paywall sind unverändert.

Prüfungen: `test/social-sciences.test.ts` mit 14 Regressionen und 48 erfundenen Titeln in `test/fixtures/social-sciences.ts`. Im selben Set stieg die richtige Top-1-Zuordnung bei Geschichte von 2/12 auf 12/12, Politik von 0/12 auf 12/12, Ethnologie von 2/12 auf 12/12 und Soziologie von 11/12 auf 12/12. Pro Fach 30 reproduzierbar gezogene Verläufe mit je 60 Einträgen: jeweils das erwartete Fach auf Platz 1. Bei 15 % Soziologie neben 85 % Politik bleibt Politik in allen 30 Läufen vorne. Gegenproben prüfen andere Wortbedeutungen, Fachbelege, Themenübernahme und Studiengangnamen. Das ist ein gezielter synthetischer Regressionstest, keine Validierung mit echten Nutzerdaten.

Gesamte Suite: 212 Tests und TypeScript erfolgreich; `git diff --check` ohne Befund.

## Freiwillige KI-Inhaltsanalyse von YouTube-Exporten

Der Wörterabgleich erkennt den öffentlichen Beispieltitel «Stop stanning politicians» ohne Metadaten nicht. Die KI-Auswertung von Studiengängen konnte solche verlorenen Inhaltssignale bisher nicht nachholen.

- Im freigeschalteten Ergebnis gibt es jetzt «Verlauf mit KI verstehen»: Takeout-ZIP oder Verlauf und Abos nochmals lokal auswählen, Stichprobe prüfen und ausdrücklich an die KI senden. Einwilligung für den Studiengangvergleich gilt nicht automatisch für Titel. Daten aus der YouTube-Schnittstelle werden nicht übernommen.
- Bis zu 240 unterschiedliche Einträge, darunter höchstens 60 Abos und 60 Kanalkontexte. Kanalbeispiele geben schwächere Hinweise für nicht einzeln gelesene Videos; sie zählen nicht als zusätzliche Aktivität. Geprüfte Einzeltitel haben Vorrang. Abos, Wiederholungen, Alter und Fragebogen behalten ihre Gewichtung. Erkannte Fachthemen erreichen auch den Studiengangvergleich.
- Original und KI-Zusammenfassung bleiben lokal getrennt. Ausschalten stellt die ursprüngliche Auswertung wieder her; erneuter Import oder Löschen der Quelle verwirft den alten KI-Zusatz. Fehlgeschlagene, abgebrochene oder überholte Anfragen ersetzen das Ergebnis nicht. Beispieltitel zeigen die KI-Einordnung und unterscheiden Kanalkontext.
- Neue Route `/api/content-analysis` mit bestehender Token-Prüfung, ausdrücklichem Consent-Flag, validierten IDs und vollständigen Batches, Request-Grenze und bestehendem KI-/Kaufbudget. Keine Speicherung oder Protokollierung der Titel auf unserem Server. Datenschutzhinweise in allen Sprachen angepasst. Keine politischen Überzeugungen oder anderen sensiblen Eigenschaften der Person werden beauftragt.

Prüfungen: 198 Tests, TypeScript und Produktionsbuild mit `next build --webpack`. Lokale Regressionen für übersehene politische Titel, Rangliste und Themenübernahme, Kanalkontext ohne doppelte Aufrufe, Abos, unbekannte Inhalte, Ausschalten, neue Importe, API-Datentrennung, initiale Oberfläche ohne Datenversand und nicht freigeschaltete Anfragen. Echter Aufruf beim damaligen KI-Anbieter mit vollständig erfundenem Physiktitel: Fach Physik erkannt; erfundener Kanal ohne Kontext blieb unzugeordnet. Der automatische Freigabecheck blockierte den Live-Aufruf mit dem vom Nutzer genannten Titel; dieser wurde nur lokal mit einem Testurteil geprüft. Keine persönlichen Exporte oder Geheimnisse wurden ausgegeben oder committed.

## Korrektur: Fachbezug vor allgemeinen Ähnlichkeiten

Rückmeldung: «Theologische Studien» auf Platz 1 trotz Soziologie als bestes Fach; die Begründungen «Sozial · Forschend» und «Deutsch / Geschichte» stützen kein Interesse an Theologie.

- Server, Top-Liste, Suche, freiwilliger Vergleichspool und CSV achten zuerst auf die Fächerrangliste. Die hauptsächliche Fachzuordnung zählt; ein zusätzliches Soziologie-Tag macht Theologie nicht zu einem Soziologiestudium. Innerhalb eines Fachs zählen Profil 80 % und Lesung 20 %. Fehlt ein Angebot im besten Fach unter den gewählten Filtern, folgt das nächste verfügbare Fach.
- Die erste Karte und die Detailbegründung erklären den konkreten Fachbezug. Allgemeine Tätigkeitsarten und schulische Grundlagen sind als begrenzte Ähnlichkeiten formuliert. Ohne Themenbezug wird ausdrücklich gesagt, dass diese kein Interesse am Studieninhalt belegen. Kein zusätzliches «Passt sehr gut» aus einem generischen Lesungswert; die ausgewählten Begründungen werden nicht nochmals doppelt angezeigt.
- Der kostenlose Teaser hält die gesamte höchste verfügbare Fachgruppe zurück, damit eine spätere Umreihung durch Lesungen nicht das beste Angebot verrät. Token-Prüfung und Checkout sind unverändert.

Prüfungen: 188 Tests, TypeScript und Produktionsbuild mit `next build --webpack` erfolgreich. Regression Soziologie vor Theologie mit/ohne Lesung und mit freiwilligem Vergleich, spätere Seiten innerhalb desselben Fachs, Nebenfach-Tags, fehlendes Angebot im ersten Fach, Schutz des besten Fachs im Teaser sowie gerenderte Detailbegründung ohne Doppelung oder unbelegte Bestnote.

## Präzisionskorrekturen am 12.10.2026

- Themenabgleich: Nutzerbegriffe wie `python`, `machine learning` und `p:algorithm` werden in der API akzeptiert und mit den Fach-IDs der Lesungen abgeglichen. Vertiefungsbegründungen brauchen einen konkreten Themenbezug.
- Punkte im freiwilligen Vergleich werden reproduzierbar berechnet und auf derselben Skala wie die lokalen Punkte geeicht. Die KI wählt höchstens zwei bereits belegbare Begründungen aus; frei erfundene Interessen oder Modell-Punktwerte werden nicht übernommen. Hinweise und Einwilligung sind in allen Sprachen angepasst.
- Fehlende Lesungen zählen in Listen mit Lesungen neutral (50). Top-Liste, Suche und CSV verwenden dieselben Zahlen. Die Paging-Grenze von 20 000 entfällt; Änderungen von Profil oder Token lösen einen neuen persönlichen Vergleich aus. Lesungs-Caches sind an den Token gebunden.
- Quellenleser: HSLU-Formularinhalt bleibt erhalten; Skripte, versteckte Inhalte und Eingabefelder entfallen. BFH liest die offizielle öffentliche Suche mit `filters` und `offset`, prüft alle Seiten und verwirft wiederholte oder unvollständige Antworten. Live: 37 Bachelor- und 51 Masterangebote. Ausfälle oder starke Rückgänge einzelner Hochschul-/Stufengruppen bewahren deren vorherige Daten.
- Fribourg: ECTS werden innerhalb einer regulären Variante addiert, nicht über Alternativen oder wiederholte Teilangaben. ZHAW Soziale Arbeit ist Zürich zugeordnet. Unbelegte Sprache, Dauer und Studienform werden nicht mehr vom Institutionsstandort abgeleitet; Detailseiten haben Vorrang vor Listenvorgaben.
- Faktenleser Version 4: Inhalt, Vertiefungen, Besonderheiten und Abklärungen brauchen Quellenbelege. Vertiefungen werden als vollständige Namen nahe einer ausdrücklichen Vertiefungsangabe geprüft. Zu lange Texte enden an Satzgrenzen. Jeder Batch muss alle eigenen IDs genau einmal enthalten; ein begrenzter Wiederholungsversuch, explizites Ausgabenlimit und mehr Antworttokens verhindern stille Lücken. Eine neue Leserversion erzwingt die erneute Prüfung unveränderter Seiten. Alte Lesungen bleiben bei Fehlern erhalten und werden erst durch einen neuen Faktenlauf ersetzt.
- Gemeinsamer Leser beachtet robots.txt vor Seiten, Sitemaps und Weiterleitungen, begrenzt Weiterleitungen auf dieselbe Institution und hält 1.5 Sekunden Abstand ein. Die Seitensuche nutzt Sitemap-Adressen aus robots.txt und berücksichtigt Fakultäts-Subdomains. Die ZHdK-Zuordnung «Composition and Theory» zeigt auf die Übersicht des Profils statt nur auf Sound Design. Technische Netflix-Erklärungen werden als Lernthemen erkannt.

Prüfungen: 183 Tests, TypeScript, Produktionsbuild mit `next build --webpack`, Demodaten-Build (752 Programme). Zwei echte Faktenläufe mit fünf öffentlichen Programmseiten lieferten vollständige Antworten; zwei persönliche KI-Vergleiche mit demselben synthetischen Profil lieferten identische Punkte und nur erlaubte Begründungen. Alle Angebotslisten wurden live geprüft; die instabile BFH-Sitemap wurde durch den vollständigen Suchabruf ersetzt. Turbopack kann in dieser lokalen Umgebung keinen Port für die CSS-Verarbeitung öffnen; Webpack baut erfolgreich. Keine persönlichen Exporte oder API-Schlüssel wurden ausgegeben oder eingecheckt.

## Erledigt am 11.10.2026

Die fünf Produkt- und Outreach-Aufträge sind umgesetzt:

1. **Bester Studiengang:** eigene Karte direkt nach dem Fach auf Platz 1 (`TopProgramme`). Vor dem Kauf bleibt sie gesperrt; Details kommen erst nach Freigabe über `/api/programmes`. Der kostenlose Teaser schliesst den tatsächlichen besten Studiengang und das erste Fach aus, auch wenn der beste Studiengang zu einem anderen Fach gehört. Token-Prüfung und Checkout bleiben unverändert.
2. **Studiengang-Fokus:** Hero, Ablauf, Beispielkarte und CTAs in Englisch, Deutsch, Französisch und Italienisch nennen konkrete Hochschulen, beide Modi und den freiwilligen KI-Vergleich. Die Hinweise auf die fehlenden DE/AT-Daten bleiben bestehen; die Verkaufspause wurde anschliessend auf ausdrücklichen Wunsch des Inhabers aufgehoben.
3. **Datenschutz:** Der Hinweis beim Start erscheint nur im Datenmodus.
4. **Kürzerer Fragebogen:** 24 Interessenfragen (vier pro Typ), Kontrollitem nach Frage 12, Warnung bei zehn gleichen Antworten in Folge. Zwei Antworten je Typ bleiben das Minimum. Behaltene IDs und Übersetzungen sind stabil; entfernte Antworten zählen nicht mehr für Fortschritt oder Ergebnis. Big Five ist freiwillig eingeklappt und zählt nicht zum Kernfortschritt (47 Einträge). Schulfächer und Werte bleiben unverändert. Die Auswahl bewahrt konkrete Tätigkeiten und thematische Breite; unveränderte Reliabilität ist ohne Validierungsdaten nicht belegt.
5. **Outreach:** `mail.ts` im separaten Repo `moritzlauper/whatshouldistudy-outreach` nennt in DE/FR/IT/EN Studiengänge an konkreten Hochschulen und beide Modi. DE/AT-Vorlagen weisen auf die fehlenden Studiengangdaten und pausierten Verkäufe hin. Bestehende Entwürfe und Briefe wurden nicht überschrieben; keine Mails wurden versendet.

Prüfungen: TypeScript, 120 App-Tests, 36 Outreach-Tests, Demodaten-Build (752 Studiengänge). Im Browser geprüft: Moduswechsel und Datenschutz, 25 Einträge im Interessen-Tab, freiwilliger Big-Five-Teil, Ergebnis ab zwei Antworten je Typ, gesperrte Studiengangkarte vor den weiteren Fächern und Link zur Kaufsektion. Lokaler Aufruf von `/api/programmes` ohne Token: HTTP 401. Ein bezahlter Checkout und der externe KI-Vergleich wurden nicht ausgeführt.

Die DE/AT-Leser sind weiterhin offen und für einen separaten Durchlauf vorgesehen.

## Deutschland und Österreich: Studiengänge von den Hochschul-Websites

**Zurückgestellt am 24.10.2026 auf Entscheid des Inhabers** (Datenbankherstellerrecht, siehe oben). Nicht weiterbauen ohne neuen ausdrücklichen Auftrag.

Ziel: wie in der Schweiz (`scrapers/ch-hochschulen.ts`) die Studienangebote direkt von den Websites der Hochschulen lesen, weil es für DE/AT keine offen lizenzierte Gesamtliste gibt (Studiensuche der BA und studienwahl.at stehen auf `PERMISSION_PENDING` in `scrapers/build.ts`).

Stand:
- Gemeinsame Schnittstelle: `scrapers/sites/types.ts` (`SiteSource`), Hilfsfunktionen aus `scrapers/ch-hochschulen.ts` sind exportiert.
- Entwurf des Laufskripts: `docs/handoff/de-at-hochschulen.ts.draft`. Nach `scrapers/de-at-hochschulen.ts` kopieren, sobald die Leser existieren. Es erwartet `scrapers/sites/at.ts` (`AT_SITES`), `de-sued.ts` (`DE_SUED_SITES`), `de-ost.ts`, `de-west.ts`, `de-mitte.ts`.
- Die Leser selbst fehlen noch. Geplant:
  - at: univie, tuwien, wu, unigraz, tugraz, uibk, plus, jku, aau, boku
  - de-sued: lmu, tum, uniheidelberg, kit, unifreiburg, unitue, fau
  - de-ost: fuberlin, huberlin, tuberlin, unihamburg, unileipzig, tudresden
  - de-west: unikoeln, unimuenster, unibonn, rwth, unifrankfurt, rub, ude
  - de-mitte: unigoettingen, luh, jgu, jmu, unimannheim, unistuttgart, cau
- Seitenproben (HTML der Listen und robots.txt) liegen auf den Branches `wsis-probe-at`, `wsis-probe-de-sued`, `-de-ost`, `-de-west`, `-de-mitte` unter `probe-out/`. Neue Proben: Branch `wsis-probe-<name>` von `wsis-probe` abzweigen, URLs in `scrapers/probe/urls.json`, pushen; der Workflow `wsis-probe.yml` legt die Seiten unter `probe-out/` zurück. Je Gruppe ein Test `test/sites-<gruppe>.test.ts` mit kleinen HTML-Ausschnitten.
- Danach: `de-hochschulen`/`at-hochschulen` in `PROGRAMME_SOURCES` und `SOURCES` (`scrapers/build.ts`) aufnehmen, Schritt in `.github/workflows/wsis-daten.yml` ergänzen, DE/AT aus `LINK_ONLY` in `lib/catalogue.ts` nehmen, README nachführen.
- Verkaufspause für DE/AT am 11.10.2026 auf ausdrücklichen Wunsch des Inhabers aufgehoben, auch für Schul-Abos. `SALES_PAUSED` ist leer. Kaufbereiche auf Startseite und Ergebnis sowie Schul-Abos zeigen den Umfang: bestes Fach mit Belegen, Studiengänge aus den abgedeckten Ländern, keine einzelnen Studiengänge aus DE/AT. Bei ausschliesslicher DE/AT-Auswahl gibt es keine einzelnen Studiengänge. `LINK_ONLY` und `PERMISSION_PENDING` bleiben bestehen.
- Die oben erwähnten Outreach-Texte im separaten Repository wurden bei der Aufhebung der Pause nicht angepasst und enthalten möglicherweise noch den alten Pausenhinweis.

## Hinweise für den Inhaber (Vercel)

- `INFOMANIAK_API_TOKEN` und `INFOMANIAK_PRODUCT_ID` in Vercel setzen (KI-Vergleich der Studiengänge); laut Inhaber am 13.10.2026 eingetragen. Neue Werte gelten erst nach einem Deployment.
- `WSIS_DATA_URL` prüfen; der Daten-Branch für `angebunden` wird von Hand nachgeführt.
- Die Branches `wsis-probe*` können nach Abschluss gelöscht werden.
