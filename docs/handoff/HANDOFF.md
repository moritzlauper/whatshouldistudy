# Übergabe (Stand 11.10.2026)

Für die nächste Person oder den nächsten Agenten, die hier weiterarbeiten. Zuerst `AGENTS.md` lesen, die Regeln dort gelten (Paywall nicht umgehen, Next.js-Doku in `node_modules/next/dist/docs/`).

## Arbeitsweise im Repo

- Direkt auf `main` pushen, keine PRs.
- Texte auf Deutsch: Schweizer Hochdeutsch, kein ß, Anführungszeichen «», schlicht und konkret, keine Werbefloskeln. Alle UI-Texte stehen in `lib/site/dict.ts` (en, de-CH, fr, it, dazu Overrides für DE/AT).
- Checks vor jedem Push: `npx tsc --noEmit -p tsconfig.json` und `node --test test/*.test.ts` (zurzeit 118 grün). Demodaten mit `node scrapers/build.ts --sample`.
- Scraper nehmen nur Fakten (Name, Stufe, Sprache, ECTS, Dauer, Namen von Vertiefungen, Link), keine Beschreibungen. robots.txt beachten, 1.5 s zwischen Anfragen.
- Persönliche Exporte (Takeout usw.) des Inhabers nie ausgeben oder committen.

## Offene Aufträge des Inhabers (letzte Nachricht, noch nicht begonnen)

1. **Bester Studiengang gesperrt und weiter oben.** Im Resultat (`app/views/results.tsx`, Komponente `Programmes` in `app/ui/programmes.tsx`) soll der am besten passende Studiengang wie Platz 1 der Fächer (`LockedTop`/`TopMatch`) hinter dem Kauf liegen und weiter oben stehen, direkt nach dem Fach-Platz-1. Die Freigabe läuft über das bestehende Unlock-Token, nichts am Token-Check ändern.
2. **Landingpage auf Studiengänge ausrichten.** Neuer Kern: Die Seite sucht nicht nur das passende Fach, sondern den passenden Studiengang an einer bestimmten Hochschule (inkl. der KI-Bewertung einzelner Studiengänge, `lib/server/programme-fit.ts`). Der CTA heisst heute «Mein Fach finden» (`lib/site/dict.ts` Zeilen um 692 und 1148, `lib/site/catalogue-text.ts` um 195); Hero, Untertitel und Ablauf in `app/views/landing.tsx` entsprechend umschreiben, in allen vier Sprachen.
3. **Datenschutz-Hinweis nur im Datenmodus.** Der Block «Dein Verlauf bleibt auf deinem Gerät … Code auf GitHub ansehen» (`nothingStored` u. a. in `lib/site/dict.ts`, dargestellt in `app/views/start.tsx`) soll nur erscheinen, wenn im Start der Modus «mit deinen Daten» (`mode: 'data'` in `lib/store.ts`) gewählt ist, vorher nicht.
4. **Fragebogen kürzen, ohne Validität zu verlieren.** `lib/engine/questionnaire.ts`: heute 36 Interessen-Items (6 je RIASEC-Typ) + Kontrollitem, 20 Mini-IPIP-Items, 14 Schulfächer, 8 Werte. Vorschlag: Interessen auf 4 Items je Typ (24, kurze Skalen wie im Mini-RIASEC/O*NET-Short-Form-Ansatz erreichen mit 4–5 Items noch brauchbare Reliabilität; die je Typ trennschärfsten behalten, also die konkretesten Tätigkeiten), Big Five optional einklappen (fliesst im Fragebogen-Modus ohnehin mit Gewicht 0 ein, `Q_WEIGHTS` in `lib/engine/scoring.ts`), Werte und Fächer unverändert. `MIN_PER_TYPE`, `careless()` (12 gleiche Antworten in Folge, bei 24 Items auf etwa 10 senken) und die Position des Kontrollitems anpassen. Item-IDs der behaltenen Items nicht ändern, damit gespeicherte Antworten gültig bleiben. Übersetzungen in `lib/site/dict.ts` mitziehen, Tests in `test/engine.test.ts` anpassen. Hintergrund: Recherche unter `research_notes/` bzw. Bericht «Wissenschaftliche Studienwahl Diagnostik» (nicht im Repo).
5. **Outreach-Mail an das neue Angebot anpassen.** Die Vorlage liegt nicht in diesem Repo (vermutlich im Repo `angebunden`); sie soll den Studiengang-Fokus (Punkt 2) und die zwei Modi (nur Fragebogen / mit eigenen Daten) nennen.

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
- `SALES_PAUSED` für de/at in `lib/site/config.ts` nicht ohne Rückfrage beim Inhaber aufheben.

## Hinweise für den Inhaber (Vercel)

- `ANTHROPIC_API_KEY` in Vercel setzen (KI-Vergleich der Studiengänge).
- `WSIS_DATA_URL` prüfen; der Daten-Branch für `angebunden` wird von Hand nachgeführt.
- Die Branches `wsis-probe*` können nach Abschluss gelöscht werden.
