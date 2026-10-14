# Pilotprotokoll: Interessen und Studienfelder

Entwurf 1.0, 14.10.2026. Nicht registriert, keine Rekrutierung, keine erhobenen
Daten, keine Finanzierungs- oder Institutionszusage. Grundlage: der vom Inhaber
bereitgestellte Recherchebericht «Eine belastbare Grundlage für die Studienwahl»
vom 14.10.2026, insbesondere Seiten 11–17. Dieses Protokoll ist eine Umsetzung
der Planungsempfehlung, kein empirischer Nachweis.

## Entscheidung und eingefrorene Fassung

Zuerst deutschsprachige Interessenexploration für Studieninteressierte in der
Schweiz untersuchen. Zielgruppe vorläufig 16–25 Jahre, verschiedene Bildungswege
und Regionen; endgültige Einschlussregeln mit Forschungspartner festlegen.
Keine Normierung der Bevölkerung und keine Auswahl- oder Zulassungsdiagnostik.

- Eigene 24 RIASEC-Items, vier je Typ, plus separates Aufmerksamkeitsitem.
  Alle 24 Interessenantworten im Studienablauf verlangen. Keine Ersetzung
  fehlender Werte. Der normale Produktmodus erlaubt weiterhin zwei je Typ;
  diese abweichende Bedingung ist separat zu untersuchen.
- Mini-IPIP optional, eigene deutsche Übersetzung; nur Antwortmittelwerte,
  kein Einfluss auf Fragebogen-Rankings. Ohne 20 gültige Antworten kein Profil.
- Freude an Schulfächern und selbst eingeschätzte Stärke getrennt. Das interne
  Feld `grade` ist keine tatsächliche Schulnote. Tatsächliche Noten wären eine
  neue, separat zu erhebende Variable einschliesslich Land und Notensystem.
- Werte sind ausdrückliche Präferenzen. Die normalen Rankinggewichte bleiben
  Produktheuristiken, nicht nachgewiesene latente Skalen oder Prognosegewichte.
- Keine persönlichen Exporte oder KI im ersten Messpilot. Ein späterer Test
  ihrer Zusatzwirkung erhält ein eigenes Protokoll und eigene Einwilligung.

Die IDs stehen in `lib/engine/assessment-version.ts`. `release-manifest.json`
enthält die genauen angezeigten Items, Antwortskalen, Instruktionen und Polungen
aller sechs regionalen Sprachvarianten sowie SHA-256 der Auswertung und
KI-Quelldateien. Die Prüfungen sichern Implementierung, keine Messgüte.
Vor Erhebung zusätzlich den Git-Commit, tatsächlich eingesetzte Sprache,
Betreuung, Gerät, Katalogrelease samt Prüfsumme und Abweichungen festhalten.
Ein deutscher Pilot begründet keine Validierung von FR/IT/EN.

## Stufe 0: vor jeder Rekrutierung

1. Psychometrisch qualifizierten, von Produktentwicklung getrennten Analysepartner
   bestimmen. Publikationsfreiheit, negative Ergebnisse und Interessenkonflikte
   schriftlich vereinbaren. Finanzierung und Entwicklungsrolle offenlegen.
2. AIST-3 als extern durchgeführten Vergleichskandidaten lizenzieren; genaue
   Fassung, Auswertungsrechte, Qualifikation und Normpopulation klären. Keine
   Items kopieren. VIT-2 als mögliche Kooperation anfragen, nicht als schon
   erlaubten Ersatz behandeln. Siehe `RESEARCH_DECISIONS.md`.
3. Kognitive Interviews mit unterschiedlich vorgebildeten Jugendlichen und
   fachliche Inhaltsprüfung durchführen. Probleme, Änderungen und neue
   Versions-ID festhalten. Pro Sprache separat vorgehen.
4. Breite Studienfelder anhand offizieller Curricula unabhängig beurteilen:
   `field-review-template.json` enthält die aktuellen Heuristiken und leere
   Bewertungsfelder. Es sind noch keine geprüften Curriculaprofile.
5. Forschungsinformation, Einwilligung, Minderjährigenregelung, Rollen,
   Kontaktwege, Datenhaltung, Löschung und allfällige Ethikprüfung abschliessen.
   Forschungszwecke nicht aus der Produkt-/KI-Einwilligung ableiten.
6. Protokoll und Analyseplan vor Datenzugriff registrieren. Stichprobengrösse
   anhand der gewünschten Präzision bzw. Simulation festlegen, nicht nach
   einer pauschalen Mindestzahl. Bei fehlendem Zugang nicht mit Kundendaten
   als vermeintlich repräsentativem Ersatz beginnen.

## Messpilot

Rekrutierung über mehrere Schulen/Bildungswege und Beratungsstellen, nicht nur
zahlende Kunden. 150 Personen aus dem Bericht sind ausschliesslich ein
Budgetbeispiel. Für die endgültige Fallzahl muss der Partner Zielpräzision,
fehlende Daten und Clusterung an Schulen berücksichtigen.

| Zeitpunkt | Erhebung | Zweck |
| --- | --- | --- |
| T0 | Einwilligung, Bildungsweg, relevante Altersgruppe, Vorerfahrung, aktuelle Entscheidungsprobleme | Ausgangslage; nur begründete Merkmale erfassen |
| T0 | Eigener Fragebogen und lizenzierter Vergleichstest, zufällige ausgeglichene Reihenfolge | Konvergenz, Struktur, Reihenfolgeeffekte |
| T1 unmittelbar | Verständnisfragen, problematische Items und gegebenenfalls unabhängige Bewertung von Empfehlungen | Verständlichkeit und Fehler erkennen |
| 2–4 Wochen | Identische Fragebogenfassung ohne Rückmeldung der alten Antworten | Retest; zwischenzeitliche Beratung/Erfahrungen dokumentieren |
| 4–6 Wochen | Informationshandlungen und Entscheidungsklarheit mit vorab festgelegter Messung | Explorative Prozessveränderung, keine kausale Wirksamkeit |

Vorab festzulegen: primäre Zielgrösse des Piloten, fehlende Werte,
Mehrfachteilnahmen, Umgang mit Abbruch und Ausschlüssen, Auswertungssoftware.
Aufmerksamkeitsflag und gleiche Antwortfolgen führen nicht automatisch zum
Ausschluss. Haupt- und Sensitivitätsanalyse getrennt berichten.

Analysen: Itemverteilungen, Inhaltsabdeckung, Skalenstruktur, Omega/Alpha mit
Unsicherheitsintervallen, Retest, konvergente und diskriminante Zusammenhänge.
Keine Normperzentile aus dieser Stichprobe erzeugen. Keine Kennwerte anderer
Instrumente als eigene Kennwerte angeben.

## Unabhängige Prüfung der Empfehlungen

Zwei Fachpersonen bewerten pro Feld unabhängig: belegte Tätigkeiten und
Lernziele, vorgeschlagene RIASEC-Ausrichtung, Schulfächer und Wertannahmen.
Für jeden Beleg offizielle URL, Abrufdatum, Studiengang, relevanten Ausschnitt
und Begründung erfassen. Reviewer-ID, Rolle und Interessenkonflikt ergänzen;
zuerst Einzelurteile sichern, erst dann Meinungsverschiedenheiten klären.
Übereinstimmung und ungelöste Fälle berichten. Manuelle Plausibilität ist
noch keine Kriteriumsvalidität.

Danach Vorschläge für zurückgehaltene Personen verblindet bewerten:
Relevanz, belegte Begründung, sinnvolle Vielfalt, übersehene Alternativen und
ungeeignete Vorschläge. Zulassung, Sprache, Ort und Studienform separat
beurteilen. Die tatsächliche Studienwahl ist kein eindeutiger Goldstandard;
finanzielle und soziale Bedingungen sowie begründete Wechsel berücksichtigen.

Entwicklungs- und Testpersonen strikt trennen. Keine Gewichtsoptimierung auf
Testfällen. Interne Kreuzvalidierung bleibt eine interne Analyse; eine neue
Schule oder spätere Kohorte für unabhängige Bestätigung vorsehen.

## Bestätigung und spätere Zusatzfunktionen

Erst nach dem Pilot eine ausreichend geplante randomisierte Studie:
gleichwertige Studieninformation versus Fragebogen mit Empfehlungen, oder
übliche Beratung versus übliche Beratung plus Plattform. Primärziel,
kleinste relevante Verbesserung und Auswertung nach ursprünglicher Zuteilung
vorab festlegen. T3 nach 6–12 Monaten: Erwartungen, Studienzufriedenheit,
Studienverlauf und begründete Wechsel; Abbruch allein ist kein Erfolgskriterium.
T4 nach 18–24 Monaten nur mit entsprechender Verlaufsfrage.

Digitale Merkmale und persönliche KI separat vergleichen: zunächst eine
Zusatzfunktion; später gegebenenfalls 2×2 auf identischem Fragebogenkern.
Selektive Einwilligung und fehlende Exporte auswerten. Suchverläufe nach einer
bereits getroffenen Wahl nicht als zeitlich vorausgehende Vorhersage nutzen.
KI zusätzlich auf Quellenbezug, erfundene Fakten, Verständlichkeit und
unangemessene Sicherheit prüfen. Bessere Texte beweisen keine bessere Wahl.

## Aufwand, Entscheidungen und Grenzen

Berichtsszenarien, keine Offerten: Grundlagen 2–6 Wochen/CHF 3’000–9’000 plus
Lizenzen; Pilot 3–5 Monate/grob CHF 15’000–30’000 plus besondere Lizenz- und
Softwarekosten; Bestätigung 12–24 Monate/grob CHF 40’000–110’000. Partnerzugang,
Rekrutierung und Bewilligungen können Aufwand und Fristen deutlich verändern.

Vor dem Start Finanzierung und Abbruchkriterien vereinbaren. Nach dem Pilot
entscheiden: Fassung überarbeiten, Kern bestätigen oder Entwicklung stoppen.
Nicht aufgrund hoher Zufriedenheit allein institutionelle Anerkennung beantragen.
Der lokale JSON-Export ist eine persönliche Kopie, keine Forschungsplattform,
keine Rekrutierung und kein Einwilligungsnachweis. Es gibt keinen Upload-Endpunkt.
