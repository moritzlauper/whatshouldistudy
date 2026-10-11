# Übergabe (Stand 11.10.2026)

Für die nächste Person oder den nächsten Agenten, die hier weiterarbeiten. Zuerst `AGENTS.md` lesen, die Regeln dort gelten (Paywall nicht umgehen, Next.js-Doku in `node_modules/next/dist/docs/`).

## Arbeitsweise im Repo

- Direkt auf `main` pushen, keine PRs.
- Texte auf Deutsch: Schweizer Hochdeutsch, kein ß, Anführungszeichen «», schlicht und konkret, keine Werbefloskeln. Alle UI-Texte stehen in `lib/site/dict.ts` (en, de-CH, fr, it, dazu Overrides für DE/AT).
- Checks vor jedem Push: `npx tsc --noEmit -p tsconfig.json` und `node --test test/*.test.ts` (zurzeit 120 grün). Demodaten mit `node scrapers/build.ts --sample`.
- Scraper nehmen nur Fakten (Name, Stufe, Sprache, ECTS, Dauer, Namen von Vertiefungen, Link), keine Beschreibungen. robots.txt beachten, 1.5 s zwischen Anfragen.
- Persönliche Exporte (Takeout usw.) des Inhabers nie ausgeben oder committen.

## Erledigt am 11.10.2026

Die fünf Produkt- und Outreach-Aufträge sind umgesetzt:

1. **Bester Studiengang:** eigene Karte direkt nach dem Fach auf Platz 1 (`TopProgramme`). Vor dem Kauf bleibt sie gesperrt; Details kommen erst nach Freigabe über `/api/programmes`. Der kostenlose Teaser schliesst den tatsächlichen besten Studiengang und das erste Fach aus, auch wenn der beste Studiengang zu einem anderen Fach gehört. Token-Prüfung und Checkout bleiben unverändert.
2. **Studiengang-Fokus:** Hero, Ablauf, Beispielkarte und CTAs in Englisch, Deutsch, Französisch und Italienisch nennen konkrete Hochschulen, beide Modi und den freiwilligen KI-Vergleich. Die Hinweise auf die fehlenden DE/AT-Daten und pausierten Verkäufe bleiben bestehen.
3. **Datenschutz:** Der Hinweis beim Start erscheint nur im Datenmodus.
4. **Kürzerer Fragebogen:** 24 Interessenfragen (vier pro Typ), Kontrollitem nach Frage 12, Warnung bei zehn gleichen Antworten in Folge. Zwei Antworten je Typ bleiben das Minimum. Behaltene IDs und Übersetzungen sind stabil; entfernte Antworten zählen nicht mehr für Fortschritt oder Ergebnis. Big Five ist freiwillig eingeklappt und zählt nicht zum Kernfortschritt (47 Einträge). Schulfächer und Werte bleiben unverändert. Die Auswahl bewahrt konkrete Tätigkeiten und thematische Breite; unveränderte Reliabilität ist ohne Validierungsdaten nicht belegt.
5. **Outreach:** `mail.ts` im separaten Repo `moritzlauper/whatshouldistudy-outreach` nennt in DE/FR/IT Studiengänge an konkreten Hochschulen und beide Modi. DE/AT-Vorlagen weisen auf die fehlenden Studiengangdaten und pausierten Verkäufe hin. Bestehende Entwürfe und Briefe wurden nicht überschrieben; keine Mails wurden versendet.

Prüfungen: TypeScript, 120 App-Tests, 35 Outreach-Tests, Demodaten-Build (752 Studiengänge). Im Browser geprüft: Moduswechsel und Datenschutz, 25 Einträge im Interessen-Tab, freiwilliger Big-Five-Teil, Ergebnis ab zwei Antworten je Typ, gesperrte Studiengangkarte vor den weiteren Fächern und Link zur Kaufsektion. Lokaler Aufruf von `/api/programmes` ohne Token: HTTP 401. Ein bezahlter Checkout und der externe KI-Vergleich wurden nicht ausgeführt.

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
- `SALES_PAUSED` für de/at in `lib/site/config.ts` nicht ohne Rückfrage beim Inhaber aufheben.

## Hinweise für den Inhaber (Vercel)

- `ANTHROPIC_API_KEY` in Vercel setzen (KI-Vergleich der Studiengänge).
- `WSIS_DATA_URL` prüfen; der Daten-Branch für `angebunden` wird von Hand nachgeführt.
- Die Branches `wsis-probe*` können nach Abschluss gelöscht werden.
