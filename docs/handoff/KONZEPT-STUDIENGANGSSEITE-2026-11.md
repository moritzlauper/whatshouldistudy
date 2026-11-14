# Konzept Studiengangsseite (14.11.2026)

Stand 14.11.2026: Stufe 1 und 2 umgesetzt (Abschnitte «Umsetzung» am Ende), Stufe 3 offen. Auftrag des Inhabers: Die Karte «Passt dieses Studium zu dir?» ist zu lang, ungenau und beschreibt nur das Oberfach. Die Karte «Von der offiziellen Seite» soll kein Textblock mehr sein, ihre Angaben sollen an den passenden Stellen der Seite stehen.

Beispiel für alles Folgende ist der [Master Business Psychology der Hochschule Luzern](https://wasstudieren.ch/studiengaenge/psychologie/master-business-psychology-hochschule-luzern-vj2gqdb5rd). Eine Skizze der neuen Seite und der Passungskarte liegt als privates Artifact vor: https://claude.ai/artifact/PBFyur9uDwRYgoDcxPEMrB

## Befund

Die Passungskarte ruft `FitsWhom` mit dem ersten Fach des Studiengangs auf (`app/views/programme.tsx`, `fieldId={field}`). Sie zeigt also das Profil von Psychologie, und zwar auf allen 31 Schweizer Bachelor- und Masterstudiengängen mit Psychologie als erstem Fach genau gleich. Das zweite Fach des Beispiels, Betriebswirtschaft & Management, kommt nicht vor.

| Befund | Wert |
| --- | --- |
| Zeilen und Chips der Karte | 5 Zeilen, 14 Chips, dazu Titel, Hinweis und Knopf |
| Position | Vor allen Angaben zum Studiengang, füllt den ersten Bildschirm |
| Bachelor und Master im Schweizer Katalog | 1'647 |
| davon mit zweitem Fach | 424 (26%) |
| davon mit Schwerpunkten aus dem Katalog (`focus`) | 62 (4%) |

Ungenau ist nicht nur die Passungskarte. Auf derselben Seite stehen vier weitere Angaben, die für diesen Studiengang nicht stimmen:

- **Zulassung:** «Berufsmatura in passender Richtung …» bei einem Master. `catalogueFacts` nimmt die Regel des Hochschultyps (`admissionText`) für jede Stufe ausser Weiterbildung.
- **Berufe:** «Psychotherapeut:in · Klinische Psychologie · Schulpsychologie» bei einem FH-Master in Wirtschaftspsychologie. Die Liste kommt aus dem ersten Fach (`fieldCareers`).
- **Lohn:** «Uni-Master» und «FH-Bachelor», beides trifft auf einen FH-Master nicht zu.
- **Studienform:** In «Das Wichtigste» steht «Vollzeit», zwei Karten weiter oben steht aus der Lesung «Vollzeit mit 4 Semestern, Teilzeit mit 6 Semestern».

Die Karte «Von der offiziellen Seite» nimmt die volle Breite ein und enthält im Beispiel zwei Sätze. Einer davon ist eine Eckdatenangabe und gehört in den Steckbrief.

## A. Aufbau der Seite

Heute: Kopf, Passungskarte, Lesung, «Das Wichtigste» neben dem Fach, verwandte Studiengänge. Neu steht der Studiengang vor der Frage, ob er passt.

1. Kopf: Titel, Hochschule, Ort, Chips für Stufe, Hochschultyp und Fächer
2. Steckbrief: fünf Kacheln mit Abschluss und ECTS, Dauer, Studienform, Sprache, Zulassung. Leere Kacheln fallen weg.
3. Links zur offiziellen Seite und zur Hochschule
4. Zwei Spalten. Links «Was diesen Studiengang ausmacht» und «Nach dem Studium», rechts die Passungskarte. Auf dem Handy folgt die Passungskarte auf «Was diesen Studiengang ausmacht».
5. Übrige Angaben (Departement, Partner, Vorstudien, Anmeldefrist, Titel), nur wenn vorhanden
6. Verwandte Studiengänge, Quellenzeile, Schluss-CTA wie bisher

Die Tabelle «Das Wichtigste» fällt weg. Was sie heute zeigt, steht im Kopf, im Steckbrief oder in Punkt 5.

## B. Passungskarte

### Kürzer

Die Karte hat neu drei Teile statt fünf Zeilen:

- **Interessentypen:** Höchstens drei, auf dem Desktop als sechs Balken mit einem Strich für das Oberfach, auf dem Handy als drei Chips.
- **Dafür spricht:** Höchstens vier Chips.
- **Eher nicht:** Höchstens drei Chips.

«Persönlichkeit» und «Was die Berufe danach bieten» fallen auf der Studiengangsseite weg. Beide stammen aus dem Fachprofil und bleiben auf der Fachseite. Der Hinweis «Dieses Profil vergleicht der Fragebogen mit deinem» fällt weg, der Knopf sagt dasselbe: «Mit meinen Antworten vergleichen».

### Pro Studiengang

Das Profil kommt aus der genauesten Quelle, die es für den Studiengang gibt:

1. **Lesung der Hochschulseite** (Schweiz und Österreich, wo `enough` gesetzt ist): Interessenprofil (`readingRiasec`), Schulfächer und Themen des Studiengangs selbst.
2. **Mehrere Fächer:** Mischung der Fachprofile, erstes Fach 60%, die übrigen zusammen 40%. Das trifft 424 Studiengänge.
3. **Ein Fach, keine Lesung:** Fachprofil wie heute, aber gekürzt und mit dem Titel «Passt Psychologie zu dir?» und der Zeile «Profil des Fachs Psychologie. Zu diesem Studiengang liegen keine eigenen Angaben vor.»

Bei Quelle 1 und 2 steht ein Satz zum Unterschied zum Oberfach. Er nennt Typen, die um mindestens 0.15 vom Fachprofil abweichen, höchstens zwei. Für das Beispiel ergibt die Mischung aus Psychologie und Betriebswirtschaft:

| Typ | Studiengang | Psychologie | Differenz |
| --- | --- | --- | --- |
| Sozial | 0.67 | 0.85 | −0.18 |
| Unternehmerisch | 0.59 | 0.38 | +0.21 |
| Forschend | 0.57 | 0.68 | −0.11 |
| Ordnend | 0.57 | 0.46 | +0.11 |
| Kreativ | 0.26 | 0.36 | −0.10 |
| Praktisch | 0.05 | 0.02 | +0.03 |

Daraus wird der Satz «Unternehmerischer und weniger sozial als Psychologie allgemein». Bei den Chips kommen die zwei stärksten Interessen des ersten Fachs und die zwei stärksten des zweiten, die in der Mischung über 0.75 liegen. Im Beispiel: Beraten und begleiten, Sozialwissenschaften, Führen und leiten, Wirtschaft & Recht. Ohne diese Regel wären alle vier Chips aus der Psychologie, und «Unterrichten» stünde weiterhin dort.

Die Gewichtung 60 zu 40 und die Schwelle 0.15 sind Setzungen und nicht validiert.

### Mit den eigenen Antworten

Wer den Fragebogen ausgefüllt hat, hat seine Antworten im Browser (`lib/store.ts`). Die Karte liest sie dort und wechselt den Zustand: Typen und Interessen, die zu den stärksten der Person gehören, bekommen einen Haken, der Titel heisst «Das passt zu deinen Antworten», der Knopf führt zum Resultat. Der Vergleich läuft im Browser, es wird nichts gesendet.

Die Karte zeigt keine Zahl und keinen Rang. Passungszahl, Begründungen, sortierte Liste und KI-Vergleich bleiben im Report. `/api/facts`, Tokenprüfung und Checkout werden nicht angefasst.

Ohne Antworten bleibt die Karte so, wie der Server sie rendert. Suchmaschinen sehen also immer den Zustand ohne Antworten.

## C. «Von der offiziellen Seite» wird «Was diesen Studiengang ausmacht»

Die Angaben aus der Lesung stehen neu dort, wo man sie sucht:

- **Besonderheiten** (`distinctive`): Zwei bis drei farbige Karten nebeneinander statt einer Liste. Mit Leser-Version 7 bekommt jede einen Titel aus höchstens drei Wörtern («Integriertes Praktikum») und ein Symbol nach Kategorie.
- **Vertiefungen** (`specialisations`): Chips unter den Karten, wie heute.
- **Inhalte:** Die Fächer des Studiengangs als Chips mit Link auf die Fachseite. Mit Entscheid 1 kommen die Themen der Lesung dazu, die ebenfalls Fach-IDs sind.
- **Eckdaten:** Angaben wie «Vollzeit 4 Semester, Teilzeit 6 Semester» oder ein Praktikum wandern mit Leser-Version 7 als Felder in den Steckbrief und stehen nicht mehr als Satz in der Karte.
- **Quelle:** Eine Zeile mit Lesedatum und Link, wie heute.

Ohne Lesung erscheint die Karte nur, wenn der Katalog Schwerpunkte oder mehrere Fächer hat.

## D. Ungenaue Angaben

- **Zulassung beim Master:** `priorStudies` zeigen, wo vorhanden, sonst «Bachelorabschluss, Details bei der Hochschule». Die Maturaregel nur noch bei Bachelor.
- **Berufe:** Aus allen Fächern des Studiengangs abwechselnd, höchstens fünf, unter der Überschrift «Typische Berufe aus Psychologie und Betriebswirtschaft». Berufe mit eigenem Weg (Psychotherapie, Klinische Psychologie, Schulpsychologie, Ärztin, Anwalt) brauchen ein Merkmal in `lib/taxonomy/fields.ts` und fallen bei Fachhochschulen weg. Das ist Handarbeit über 80 Fächer.
- **Lohn:** Zuerst der Wert, der zu Hochschultyp und Stufe passt, als «Medianlohn im Fach» beschriftet. Wo es keinen passenden Wert gibt, steht das dort.
- **Studienform:** Der Steckbrief zeigt eine Angabe. Widerspricht die Lesung dem Katalog, gilt bis zur Leser-Version 7 der Katalog.

## Stufen

1. **Ohne neue Daten:** Aufbau A, Steckbrief, Passungskarte mit Quelle 2 und 3, Zustand mit eigenen Antworten, Besonderheiten als Karten ohne Titel, alles aus D ausser dem Merkmal bei den Berufen. Vier Sprachen. Keine API-Kosten.
2. **Mit Entscheid 1:** Passungskarte mit Quelle 1, Themen als Chips. Die Daten liegen schon im Store, keine API-Kosten. Betrifft `publicReading` in `lib/facts-store.ts` und dessen Test («kein Durchsickern von Profil»).
3. **Leser-Version 7:** Titel und Kategorie je Besonderheit, Felder für Semester in Vollzeit und Teilzeit, Praktikum und Studienbeginn, je mit Beleg wie die heutigen Felder. Jede Seite wird neu gelesen. Nach der heutigen Grenze von USD 1 je 150 Leseversuche sind das für die Schweiz höchstens etwa USD 11. Vor dem Lauf an 20 Seiten messen.

Die Skizze zeigt das Zielbild nach Stufe 3. In Stufe 1 steht im Steckbrief «2 Jahre · 120 ECTS» und «Vollzeit oder Teilzeit», und die Besonderheiten haben keinen Titel.

## Entscheide des Inhabers

1. **Grobes Profil aus der Lesung öffentlich?** Am 22.10. blieben Interessenprofil und Themen bewusst im Report. Quelle 1 braucht davon höchstens drei Typen als Wörter, die Schulfächer und die Themen als Chips, ohne Zahlen. Empfehlung: freigeben. 74% der Studiengänge haben nur ein Fach und bleiben sonst beim Fachprofil, und verkauft wird der Vergleich mit den eigenen Antworten, nicht die Beschreibung eines einzelnen Studiengangs.
2. **Abgleich mit den eigenen Antworten gratis?** Empfehlung: ja, ohne Zahl und Rang. Der gesperrte Platz 1 lässt sich daraus nicht ablesen, die Karte zeigt nur Übereinstimmungen auf dieser einen Seite.
3. **Leser-Version 7** mit den genannten Kosten.

## Nicht geprüft

- Wie viele Schweizer Studiengänge eine Lesung mit `enough` haben. Lokal gibt es keinen Zugang zum Store.
- Das Interessenprofil der Lesung stammt von einem einzelnen Modell. Der Ensemble-Lauf, der es verlässlicher macht, ist laut Handoff noch nicht gelaufen (5 bis 6 US-Cent je Studiengang). Für drei Typen als Wörter reicht das einzelne Profil vermutlich, gemessen ist das nicht.
- Die Live-Seite zeigt «Studienform: Vollzeit» und «Deutsch, Englisch». Im Datenzweig vom 5.11. steht für denselben Studiengang `mode: both` und nur Deutsch. Welcher Stand ausgeliefert wird, ist offen.
- Die Skizze ist nicht in der App gebaut und nicht auf dem Handy geprüft.

## Umsetzung Stufe 1 (14.11.2026)

Auftrag des Inhabers am 14.11.: «setze das handoff um». Umgesetzt ist Stufe 1 mit dem Abgleich aus Entscheid 2. Entscheid 1 (Profil aus der Lesung öffentlich) und Leser-Version 7 (API-Kosten) sind nicht umgesetzt und brauchen ein eigenes Ja.

- **Profil pro Studiengang** (`lib/programme-profile.ts`): Mischung der Fachprofile mit 60% für das erste Fach, höchstens drei Typen, der Satz zum Unterschied ab 0.15, höchstens vier Chips dafür (je Fach die zwei stärksten) und drei dagegen. Studiengänge mit nur einem Fach zeigen das Fachprofil mit dem Hinweis, dass es das Fach beschreibt.
- **Passungskarte** (`app/ui/programme-fit.tsx`, Client): sechs Balken ab `sm`, darunter drei Chips. Mit fertigem Fragebogen im Browser (`personalSide`) Haken bei den zwei stärksten Typen der Person und bei Interessen ab 0.75, orange bei gemochten Dingen in «Eher nicht», ein Satz mit den Treffern, Knopf zum Resultat. Keine Zahl, kein Rang, nichts wird gesendet. Wer den Abgleich wieder entfernen will, setzt `side` in der Komponente auf `null`.
- **Seitenaufbau** (`app/views/programme.tsx`): Kacheln für Abschluss mit ECTS, Dauer, Studienform und Sprache. Darunter links «Was diesen Studiengang ausmacht» (Besonderheiten als farbige Karten, Vertiefungen oder Katalog-Schwerpunkte, Quellenzeile), «Nach dem Studium» und «Weitere Angaben», rechts die Passungskarte. Auf dem Handy folgt die Karte auf «Was diesen Studiengang ausmacht». Die Tabelle «Das Wichtigste» und `OfficialReading` sind weg, ebenso die Detailansicht von `FitsWhom`.
- **Korrekturen:** Master zeigen «Ein Bachelorabschluss in passender Richtung …» statt der Maturaregel (`catalogueFacts`, wirkt auch in den Katalogzeilen; die Schweizer Quelle hat bei 191 Mastern einen Maturatext). Berufe aus allen Fächern abwechselnd (`lib/site/programme-careers.ts`), an Schweizer FH und PH ohne Psychotherapie, Klinische und Schulpsychologie, Anwalt, Richter und Staatsanwalt. Der Lohn nennt zuerst den passenden Wert (Uni-Master, FH-Bachelor, PH) und sagt sonst, dass es keinen eigenen Wert gibt. Der Schluss-CTA heisst «Welcher Studiengang passt zu dir?», weil die Karte schon nach dem Fach fragt.
- Neue Texte in `lib/site/programme-text.ts` (DE, FR, IT, EN, DE und AT regionalisiert), `masterAdmission` in `lib/site/catalogue-text.ts`. `lib/site/fit-text.ts` ist unverändert, das Validierungsmanifest also auch.
- Geprüft: Typprüfung, 361 Tests (neu `test/programme-profile.test.ts`), 360 bestanden, einer übersprungen. Lokal im Browser: HSLU Business Psychology auf Desktop und 420 px, mit und ohne Fragebogenantworten, FR-Fassung, Master Psychologie UZH (ein Fach), Bachelor Architektur BFH (Katalog-Schwerpunkte).
- Nicht geprüft: Besonderheiten aus einer echten Lesung (lokal kein Zugang zum Store), Italienisch und Englisch im Browser, Deutschland und Österreich.

## Umsetzung Stufe 2 (14.11.2026)

Auf «fahre fort» des Inhabers nach der Liste der offenen Entscheide. Entscheid 1 gilt damit als freigegeben.

- `readingFit` in `lib/facts-store.ts` gibt der Seite aus einer Lesung mit `enough` nur Wörter weiter: höchstens drei Typen, den Unterschied zum ersten Fach, bis drei Schulfächer und die Themen (Fach-IDs). Bei einem flachen Profil (Spanne unter 1 von 5 Punkten) gibt es nichts. Der Unterschied wird nach Abzug des Mittelwerts beider Profile gerechnet (`shapeShifts`), weil einzelne Modellbewertungen insgesamt zu hoch liegen.
- Die Passungskarte zeigt bei einer Lesung die Typen als Chips ohne Balken. «Dafür spricht» beginnt mit den Schulfächern der Lesung und wird mit dem Fachprofil aufgefüllt. Der Hinweis unten nennt die Lesung als Quelle. Im ausgelieferten HTML stehen keine Werte der Lesung (geprüft: nur `"v":0`).
- «Was diesen Studiengang ausmacht» zeigt die Themen der Lesung als «Inhalte» mit Link auf die Fachseite, ohne die Fächer, die schon im Kopf stehen.
- Zurücknehmen: In `app/views/programme.tsx` `rf` auf `null` setzen.
- Geprüft: Typprüfung, 362 Tests (neu: kein Wert der Lesung in `readingFit`), lokal mit nachgebildetem Store und einer Testlesung für HSLU Business Psychology. Wie viele echte Lesungen ein `enough` und ein nicht flaches Profil haben, ist weiter offen.
