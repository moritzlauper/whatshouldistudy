# Übergabe (Stand 12.10.2026)

Für die nächste Person oder den nächsten Agenten, die hier weiterarbeiten. Zuerst `AGENTS.md` lesen, die Regeln dort gelten (Paywall nicht umgehen, Next.js-Doku in `node_modules/next/dist/docs/`).

## Arbeitsweise im Repo

- Direkt auf `main` pushen, keine PRs.
- Texte auf Deutsch: Schweizer Hochdeutsch, kein ß, Anführungszeichen «», schlicht und konkret, keine Werbefloskeln. Alle UI-Texte stehen in `lib/site/dict.ts` (en, de-CH, fr, it, dazu Overrides für DE/AT).
- Checks vor jedem Push: `npx tsc --noEmit -p tsconfig.json` und `node --test test/*.test.ts` (zurzeit 219 grün). Demodaten mit `node scrapers/build.ts --sample`.
- Scraper nehmen nur Fakten (Name, Stufe, Sprache, ECTS, Dauer, Namen von Vertiefungen, Link), keine Beschreibungen. robots.txt beachten, 1.5 s zwischen Anfragen.
- Persönliche Exporte (Takeout usw.) des Inhabers nie ausgeben oder committen.

## KI-Vergleich nach dem Neuladen: alte Schlüssel werden erneuert (13.10.2026)

- Ursache, auf die das Verschwinden hinausläuft: Ein gespeicherter Vergleich trägt den Schlüssel der Vorversion. Dieser Schlüssel passt zu keiner Liste. Die Top 5 zeigen dann die Reihenfolge ohne KI und ohne Begründungen, bei jedem Laden. Im Browser reproduziert: Schlüssel im localStorage auf das alte Format setzen, neu laden. Der normale Ablauf (Analyse, Neuladen, Neuladen während des Vergleichs) zeigt das Problem nicht.
- `profileKeyOf` trägt jetzt eine Version (`KEY_VERSION = 2` in `lib/engine/programme-changes.ts`). `isCurrentKey` prüft sie. Ein gespeicherter Vergleich ohne aktuelle Version gilt als veraltet. Ist die Analyse aktiv und die Person entsperrt, startet `ProgrammeChanges` den Vergleich einmal von selbst neu (`app/ui/programme-changes.tsx`). Es geht dasselbe Profil an Claude wie beim ersten Vergleich, unter der Zustimmung zur Analyse. Ein manuelles «Vergleich wiederholen» ist nicht mehr nötig.
- Bei jeder Änderung an der Schlüsselbildung die Version erhöhen. Sonst bleiben alte Vergleiche unbemerkt stehen.
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
- Die Begründungen stehen im aufgeklappten Bereich «Wie gut er zu dir passt» unter «Begründung von Claude». Eine zweite Stelle direkt unter dem Titel gibt es nicht mehr (auf Wunsch des Inhabers, 13.10.).
- Der Studiengangsbrowser zeigt 10 Einträge pro Seite (`PAGE_SIZE`); die Serveranfrage nach Stufe, Land oder Stadt sendet dieselbe Seitengröße.
- Startseite (DE): Der Einstieg nennt den YouTube-Verlauf mit der Zustimmung für Claude und beschreibt die Passung mit Details (Schwerpunkte, Dauer, Sprache, Kosten, Zulassung) im Vergleich mit den persönlichen Angaben. Datenschutzpunkte ergänzt um Zwischenstände und Zustimmung. «Wir speichern nichts: keine Datenbank» bleibt. Der Server führt nur Summenzähler; das hat der Inhaber bestätigt.

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

- Nach dem Lauf «Verlauf mit KI verstehen» vergleicht Claude automatisch die 50 besten Studiengänge mit den neuen Angaben. Das geht in drei Anfragen an `/api/personal-fit` (20, 20 und 10 Programme); die Grenze von 20 pro Anfrage bleibt bestehen.
- Die Einwilligung der Analyse nennt den Vergleich. Ältere Analysen starten ihn nur mit einem Klick auf «Die 50 besten Studiengänge mit deinen Angaben vergleichen».
- Der Vergleich liegt im Browser (`contentAnalysis.compare`), nicht auf dem Server. «Vergleich wiederholen» umgeht den Zwischenspeicher für gleiche Anfragen, sonst käme dieselbe Antwort zurück.
- Die Tabelle zeigt Platz und Punkte vorher und jetzt, die Begründungen darunter. Die Zahl jetzt ist Claudes Zahl, wo Claude bewertet hat; sonst die Zahl ohne KI.
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
