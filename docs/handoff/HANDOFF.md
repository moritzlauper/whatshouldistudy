# Übergabe (Stand 12.10.2026)

Für die nächste Person oder den nächsten Agenten, die hier weiterarbeiten. Zuerst `AGENTS.md` lesen, die Regeln dort gelten (Paywall nicht umgehen, Next.js-Doku in `node_modules/next/dist/docs/`).

## Arbeitsweise im Repo

- Direkt auf `main` pushen, keine PRs.
- Texte auf Deutsch: Schweizer Hochdeutsch, kein ß, Anführungszeichen «», schlicht und konkret, keine Werbefloskeln. Alle UI-Texte stehen in `lib/site/dict.ts` (en, de-CH, fr, it, dazu Overrides für DE/AT).
- Checks vor jedem Push: `npx tsc --noEmit -p tsconfig.json` und `node --test test/*.test.ts` (zurzeit 219 grün). Demodaten mit `node scrapers/build.ts --sample`.
- Scraper nehmen nur Fakten (Name, Stufe, Sprache, ECTS, Dauer, Namen von Vertiefungen, Link), keine Beschreibungen. robots.txt beachten, 1.5 s zwischen Anfragen.
- Persönliche Exporte (Takeout usw.) des Inhabers nie ausgeben oder committen.

## Allgemeine Wörter und eine Zahl je Studiengang (12.10.2026)

- Auf Wunsch des Inhabers zählen Wörter wie «society», «Gesellschaft», «sociedad», «società» und «société» (dazu «gesellschaftlich») nicht als Thema. Sie bestimmen weder die Sortierung der Studiengänge, noch erscheinen sie als Begründung oder in der Themenliste. Die Fachzuordnung bleibt unverändert; die Wörter zählen dort weiter als Belege.
- Die Liste ist bewusst kurz. Eine Gewichtsschwelle im Lexikon hätte auch «Armut», «Recycling» oder «Bitcoin» ausgeschlossen. Weitere breite Begriffe wie «Identität» oder «gender» bleiben vorerst; sie lassen sich in `GENERIC` in `lib/engine/classifier.ts` ergänzen.
- Gespeicherte Zusammenfassungen behalten die Wörter, beim Lesen werden sie herausgefiltert. Die Änderung wirkt darum auch bei bereits importierten Daten, ohne erneutes Einlesen. Der Server verwirft die Begriffe ebenfalls, damit ältere Browser-Tabs sie nicht mehr mitschicken.
- Entscheidung zur Zahl: Die KI-Zahl ersetzt die sichtbare Zahl, sobald eine ausreichende Lesung vorliegt. Die sichtbare Zahl ist sonst 80 % Profil und 20 % Lesung. Die KI-Zahl bleibt innerhalb von ±30 Punkten um diese Zahl. Mit einer Mittelung hätte die KI die Zahl nur schwach bewegt; der Inhaber wollte eine sichtbare Wirkung und nur eine Zahl. Ohne ausreichende Lesung bleibt die Profilzahl. Rückgängig machen: `shownScore` in `lib/engine/programme-fit.ts`.

Prüfungen: TypeScript grün. Neuer Test in `test/generic-topics.test.ts`. Von 222 Tests sind 219 grün. Die drei Fehlschläge in `content-analysis` und `personal-comparison` bestehen auch auf `main` ohne diese Änderung.

## KI-Begründungen auch ohne Lesungen (12.10.2026)

- Ursache des gesperrten Vergleichs bei zwölf Treffern: Suche und Top-Liste liessen nur Studiengänge mit ausreichender Lesung in den Vergleich. Die Obergrenze von 20 war keine Mindestanzahl.
- Beide Listen vergleichen jetzt bis zu 20 vorhandene Treffer, auch ohne Lesungen oder bei Ausfall der Faktenabfrage. Der Hinweis nennt die tatsächliche Anzahl. «Mit KI vergleichen» öffnet weiterhin zuerst die Einwilligung; Änderungen der Suche verlangen erneut einen Klick.
- Der Server löst jeden Studiengang anhand seiner ID im eigenen Katalog auf. Ohne ausreichende Lesung erhält Claude nur Namen, Fachzuordnung, vorhandene Schwerpunkte und belegbare Themenverbindungen als Grundlage. Solche Begründungen erscheinen ausdrücklich als Einordnung aus Katalogdaten in den Details. Sie verändern keine Punkte, auch wenn Browser und Server unterschiedliche Lesungsstände haben. Leere Begründungen werden erneut angefragt und bei erneutem Fehlschlag als Fehler behandelt.
- Texte in DE/EN/FR/IT und README nachgeführt. Paywall und KI-Budget unverändert. Die entfernten Themenbanner bleiben entfernt.

Prüfungen: TypeScript und alle 219 Tests erfolgreich. Regressionen prüfen zwölf Treffer mit dünnen bzw. fehlenden Lesungen durch Suche, Einwilligung, Versand und Detailansicht, Top-Liste, Filterwechsel, Servergrenzen bei 1/12/25 Treffern, neutrale Punkte, gemischte Lesungen sowie HTTP 401 ohne Freischaltung. KI-Transport und Katalogdaten sind synthetisch; kein echter Claude-Aufruf.

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

- Im freigeschalteten Ergebnis gibt es jetzt «Verlauf mit KI verstehen»: Takeout-ZIP oder Verlauf und Abos nochmals lokal auswählen, Stichprobe prüfen und ausdrücklich an Claude senden. Einwilligung für den Studiengangvergleich gilt nicht automatisch für Titel. Daten aus der YouTube-Schnittstelle werden nicht übernommen.
- Bis zu 240 unterschiedliche Einträge, darunter höchstens 60 Abos und 60 Kanalkontexte. Kanalbeispiele geben schwächere Hinweise für nicht einzeln gelesene Videos; sie zählen nicht als zusätzliche Aktivität. Geprüfte Einzeltitel haben Vorrang. Abos, Wiederholungen, Alter und Fragebogen behalten ihre Gewichtung. Erkannte Fachthemen erreichen auch den Studiengangvergleich.
- Original und KI-Zusammenfassung bleiben lokal getrennt. Ausschalten stellt die ursprüngliche Auswertung wieder her; erneuter Import oder Löschen der Quelle verwirft den alten KI-Zusatz. Fehlgeschlagene, abgebrochene oder überholte Anfragen ersetzen das Ergebnis nicht. Beispieltitel zeigen die KI-Einordnung und unterscheiden Kanalkontext.
- Neue Route `/api/content-analysis` mit bestehender Token-Prüfung, ausdrücklichem Consent-Flag, validierten IDs und vollständigen Batches, Request-Grenze und bestehendem KI-/Kaufbudget. Keine Speicherung oder Protokollierung der Titel auf unserem Server. Datenschutzhinweise in allen Sprachen angepasst. Keine politischen Überzeugungen oder anderen sensiblen Eigenschaften der Person werden beauftragt.

Prüfungen: 198 Tests, TypeScript und Produktionsbuild mit `next build --webpack`. Lokale Regressionen für übersehene politische Titel, Rangliste und Themenübernahme, Kanalkontext ohne doppelte Aufrufe, Abos, unbekannte Inhalte, Ausschalten, neue Importe, API-Datentrennung, initiale Oberfläche ohne Datenversand und nicht freigeschaltete Anfragen. Echter Anthropic-Aufruf mit vollständig erfundenem Physiktitel: Fach Physik erkannt; erfundener Kanal ohne Kontext blieb unzugeordnet. Der automatische Freigabecheck blockierte den Live-Aufruf mit dem vom Nutzer genannten Titel; dieser wurde nur lokal mit einem Testurteil geprüft. Keine persönlichen Exporte oder Geheimnisse wurden ausgegeben oder committed.

## Korrektur: Fachbezug vor allgemeinen Ähnlichkeiten

Rückmeldung: «Theologische Studien» auf Platz 1 trotz Soziologie als bestes Fach; die Begründungen «Sozial · Forschend» und «Deutsch / Geschichte» stützen kein Interesse an Theologie.

- Server, Top-Liste, Suche, freiwilliger Vergleichspool und CSV achten zuerst auf die Fächerrangliste. Die hauptsächliche Fachzuordnung zählt; ein zusätzliches Soziologie-Tag macht Theologie nicht zu einem Soziologiestudium. Innerhalb eines Fachs zählen Profil 80 % und Lesung 20 %. Fehlt ein Angebot im besten Fach unter den gewählten Filtern, folgt das nächste verfügbare Fach.
- Die erste Karte und die Detailbegründung erklären den konkreten Fachbezug. Allgemeine Tätigkeitsarten und schulische Grundlagen sind als begrenzte Ähnlichkeiten formuliert. Ohne Themenbezug wird ausdrücklich gesagt, dass diese kein Interesse am Studieninhalt belegen. Kein zusätzliches «Passt sehr gut» aus einem generischen Lesungswert; die ausgewählten Begründungen werden nicht nochmals doppelt angezeigt.
- Der kostenlose Teaser hält die gesamte höchste verfügbare Fachgruppe zurück, damit eine spätere Umreihung durch Lesungen nicht das beste Angebot verrät. Token-Prüfung und Checkout sind unverändert.

Prüfungen: 188 Tests, TypeScript und Produktionsbuild mit `next build --webpack` erfolgreich. Regression Soziologie vor Theologie mit/ohne Lesung und mit freiwilligem Vergleich, spätere Seiten innerhalb desselben Fachs, Nebenfach-Tags, fehlendes Angebot im ersten Fach, Schutz des besten Fachs im Teaser sowie gerenderte Detailbegründung ohne Doppelung oder unbelegte Bestnote.

## Präzisionskorrekturen am 12.10.2026

- Themenabgleich: Nutzerbegriffe wie `python`, `machine learning` und `p:algorithm` werden in der API akzeptiert und mit den Fach-IDs der Lesungen abgeglichen. Vertiefungsbegründungen brauchen einen konkreten Themenbezug.
- Punkte im freiwilligen Vergleich werden reproduzierbar berechnet und auf derselben Skala wie die lokalen Punkte geeicht. Claude wählt höchstens zwei bereits belegbare Begründungen aus; frei erfundene Interessen oder Modell-Punktwerte werden nicht übernommen. Hinweise und Einwilligung sind in allen Sprachen angepasst.
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

- `ANTHROPIC_API_KEY` in Vercel setzen (KI-Vergleich der Studiengänge).
- `WSIS_DATA_URL` prüfen; der Daten-Branch für `angebunden` wird von Hand nachgeführt.
- Die Branches `wsis-probe*` können nach Abschluss gelöscht werden.
