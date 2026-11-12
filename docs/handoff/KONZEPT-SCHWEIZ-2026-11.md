# Konzept wasstudieren.ch: Umsatz und Resultatseite (12.11.2026)

Stand: Konzept, nicht umgesetzt. Grundlage sind der Usage-Report, der Bericht zum Ads-Test, die Search Console und ein Durchlauf des Fragebogens auf einem lokalen Server.

## Ausgangslage

| Kennzahl | Wert |
| --- | --- |
| Oktober 2026 | 584 Resultate, 16 Käufe (2.7%), rund CHF 144 |
| November bis 12.11. | 54 Resultate, 1 Kauf |
| Google-Suche, 14.10.–10.11. | 12 Klicks, 2'680 Impressionen, Position 48.7 |
| «welches studium passt zu mir» | 32 Impressionen, 0 Klicks |
| Ads-Test Schweiz | 5 gegen 5 Besucher, 0 Käufe, am 6.11. per Gleichstandsregel auf «direct» gestellt |
| Datenimport im Oktober | 15 Google-Exporte und 5 Instagram-Exporte bei 584 Resultaten |

Drei Probleme, nach Gewicht geordnet:

1. Es kommen zu wenig Leute. Der November läuft auf etwa 135 Resultate hinaus. Vermutlich sind die Ads pausiert, geprüft ist das nicht.
2. Die Resultatseite verkauft, bevor sie etwas zeigt.
3. Der Preis ist tief und es gibt nur einen Käufertyp.

## A. Resultatseite umstellen

Wer 61 Fragen beantwortet hat, sieht heute zuerst den Titel, einen Hinweis und dann den violetten Verkaufsblock (`ReportOffer`). Es folgen weitere Hinweise, die Versionskennung, «Teilen», zwei Einstellungen, der gesperrte Platz 1, die gesperrten Top 5 und die Kaufbox. Die Gratis-Fächer ab Platz 2 stehen erst danach, bei etwa 60% der Seitenlänge.

Neue Reihenfolge für Nichtkäufer:

1. Titel, Hinweis «kein validierter Test», Qualitätshinweise (durchgeklickt, flaches Profil, knappe Spitze)
2. Gesperrter Platz 1
3. Plätze 2 bis 10
4. Verkaufsblock
5. Studiengang-Teaser mit Kaufbox
6. Alternativen aus anderen Bereichen
7. «Teilen», «Studierst du schon etwas?», Interessenprofil, Mathematiknote
8. Grenzen des Verfahrens und Versionskennung

Für Käufer bleibt die heutige Logik: Platz 1, Top-Studiengänge, Liste, danach die übrigen Fächer.

Die gesperrte Karte «Deine Top 5 Studiengänge» fällt für Nichtkäufer weg. Sie wiederholt nur, was Verkaufsblock und Kaufbox schon sagen. Auf geteilten Links bleibt sie mit dem Knopf «Eigenes Resultat».

Auf dem Handy kommt eine schmale Leiste am unteren Rand dazu («Platz 1 freischalten · CHF 9»). Sie erscheint, sobald Platz 1 aus dem Bild ist und die Kaufbox (`#unlock`) noch nicht sichtbar ist, umgesetzt mit `IntersectionObserver`. Nicht bei pausiertem Verkauf und nicht ohne Zahlungen.

Was gratis und was bezahlt ist, bleibt gleich. Paywall, Tokenprüfung und Checkout werden nicht angefasst.

Anzeigefehler, die im selben Paket behoben werden:

- **«0 Signale aus deinen Antworten»:** Der Titel zählt nur Signale aus Importen. Ohne Import neu «Aus deinen 61 Antworten» (Zahl aus `questionnaireProgress`), auf geteilten Links «Aus dem Fragebogen».
- **«basic 100%» auf jeder Fachkarte:** Im Fragebogen-Modus liefert `scoring.ts` nur den Teil `basic`, und der fehlt in `contrib.parts`. Label ergänzen («Fragebogen: Tätigkeiten und Schulfächer») und `Contributions` bei nur einem Teil ausblenden.
- **«Alle 0 passenden Studiengänge» in der Kaufbox:** Das passiert, wenn die Filter nichts übrig lassen, und vor dem Laden des Teasers steht «Alle  passenden». Die sechs `boxList`-Fassungen (EN, CH, DE, AT, FR, IT) sollen ohne Zahl einen eigenen Satz haben. Bei 0 Treffern steht in der Teaserkarte ein Hinweis mit Link zu den Filtern.
- **Budget in EUR auf der Schweizer Seite:** Die Anzeige ist in `app/ui/prefs-form.tsx` fest auf EUR gesetzt. Der Filter selbst rechnet in EUR (`maxTuitionEur`, Vergleich mit `fee.eur` in `lib/server/rank.ts`). Deshalb nur die Anzeige ändern, zum Beispiel «≈ CHF 1'400», gerundet, und den Filter in EUR lassen.

Betroffene Dateien: `app/views/results.tsx`, `app/ui/programmes.tsx`, `app/ui/contributions.tsx`, `app/ui/prefs-form.tsx`, `lib/site/dict.ts` in allen Sprachen. `lib/site/dict.ts` steht im Validierungsmanifest, danach `npm run validation:bundle` und prüfen, dass sich nur Prüfsummen ändern.

## B. Geld-zurück sichtbar machen

Seit dem 24.10. gilt das Widerrufsrecht von 14 Tagen, auch nach dem Öffnen und mit voller Erstattung. Es steht nur im Kleingedruckten unter den Kaufknöpfen. Neu steht neben jedem Preis «14 Tage Geld zurück, ohne Begründung».

Vorschlag: ein Feld `guarantee` in `lib/site/withdrawal-text.ts` (DE, EN, FR, IT, regionalisiert für DE und AT) und Anzeige im Hero, in der Preiskarte, im Verkaufsblock, in der Kaufbox und in `LandingCheckout`.

Offen: Für den Ads-Einstieg hat der Inhaber am 20.10. bewusst nur «KI inklusive · Kein Abo | TWINT oder Karte» gewollt. Ob der Satz dort auch hinkommt, entscheidet der Inhaber.

Das kostet nichts und ist bereits zugesagt. Es kann zu mehr Erstattungen führen.

## C. Startseite bereinigen

- **Beispielkarte im Hero:** Sie zeigt «Interessen-Code RIC», «14'382 Signale · 4 Quellen» und YouTube-Kanäle als Belege. Das widerspricht dem Entscheid vom 29.10. (kein Dreibuchstaben-Code) und dem Fragebogen als Einstieg. Neu zeigt sie ein Beispiel aus dem Fragebogen: die liebsten Tätigkeiten (zum Beispiel Mechanik, Ingenieurwesen, Physik) und Gründe im Stil der echten Resultatkarten. Statt «Versteckter Treffer» heisst es «Alternative aus einem anderen Bereich», wie auf der Resultatseite. Das Hexagon bleibt.
- **Dauer:** Die Startseite nennt «Etwa 10 Minuten» und im selben Kasten «etwa 7 Minuten», die Resultatseite «etwa 8 Minuten». Überall dieselbe Zahl verwenden, in allen Sprachen.
- **Gratis-Liste:** Sie verspricht «Big Five» (am 29.10. entfernt) und den Interessenverlauf über die Jahre (nur mit Import). Beides fällt weg.
- **FAQ:** Die erste Frage betrifft den YouTube-Verlauf. Nach vorn gehören «Was bringt der volle Report?», Preis und Rückerstattung. Die FAQ fliesst auch ins JSON-LD (`homeLd`). DE und AT haben eigene FAQ-Listen in `DE_OVERRIDES` und `AT_OVERRIDES`, `mergeDeep` ersetzt Arrays ganz.
- **Exporte:** Sie haben einen Aufklapper im Abschnitt mit den drei Schritten und einen eigenen Abschnitt `#sources` mit zwei weiteren Aufklappern, obwohl sie kaum jemand nutzt. Der erste Aufklapper fällt weg.

## D. Eltern als Käufer

Der Kauf auf der Startseite funktioniert schon als Geschenk. Der Zugangslink in der Zahlungsmail lässt sich mehrfach und auf jedem Gerät öffnen: `/api/unlock` stellt für jede bezahlte Session erneut ein Token aus. Ohne Profil führt die Seite zuerst zum Fragebogen.

Es fehlt nur die Ansprache:

- ein Abschnitt «Für Eltern» auf der Startseite vor den Preisen, mit Link zum Kauf
- eine FAQ-Frage dazu
- ein Satz in der Zahlungsmail (`lib/server/payment-email.ts`, vier Sprachen), dass man den Link an die Person weitergeben kann, für die der Report ist

Am Backend ändert sich nichts. Die Antworten bleiben im Browser des Kindes, die Eltern sehen sie nur, wenn das Kind sein Resultat über «Teilen» schickt.

## E. Preis (Entscheid des Inhabers)

Bei 16 Käufen im Monat liefert ein A/B-Test kein Ergebnis. Empfehlung: direkt auf CHF 19 gehen und vier bis sechs Wochen beobachten. Der Umsatz sinkt erst, wenn die Kaufquote um mehr als 53% fällt. Bei CHF 14 liegt diese Grenze bei 36%.

Die Umstellung braucht `PRICES` in `lib/pricing.ts` und `pnpm stripe:setup` gegen das Live-Konto. Texte mit «CHF 9» oder «9 CHF/EUR/USD» (README, Landing, Lehrpersonen- und Organisationsseiten) mitprüfen. Die Organisationspläne sind aus denselben Preisstufen abgeleitet.

## F. Mehr Besucher (Entscheid des Inhabers)

- **Suche:** Die Domain ist seit etwa dem 19.10. im Index. Impressionen holen vor allem Fach- und Studiengangseiten und der Blogartikel zum Numerus clausus (160). Eine eigene Seite für «Studienwahltest» und «Was soll ich studieren» wäre der nächste Schritt. Ohne Links von aussen bleibt die Wirkung klein.
- **Links von aussen:** Die realistischste Quelle sind Schulen und Beratungsstellen. Das Outreach ist seit dem 20.10. gestoppt.
- **Ads-Test:** Nach Paket A ist der Gratis-Einstieg ein anderer Ablauf als im Test. Den Test danach als `google-ads-paywall-v2` neu starten.

## Nicht empfohlen

- **Leads an private Hochschulen verkaufen:** Das widerspricht der neutralen Rangliste.
- **Erinnerungsmails:** Sie bräuchten gespeicherte Adressen und brechen das Versprechen «kein Konto».
- **Rabatte und künstliche Fristen:** Sie widersprechen dem bisherigen Grundsatz ohne Rabatt.

## Reihenfolge

1. A und B zusammen, weil sie dieselben Dateien betreffen.
2. C und D.
3. Entscheide des Inhabers: Preis, Neustart des Ads-Tests, Outreach.

Ob A und B wirken, lässt sich bei dieser Besucherzahl nicht in zwei Wochen belegen. Gemessen wird die Quote Kauf pro Resultat aus `pnpm usage:report` über mindestens einen Monat.

## Nicht geprüft

- Die Handy-Ansicht und die französische und italienische Fassung.
- Die Anzeige «0 Studiengänge» kam aus alten Filtern im lokalen Speicher (ETH, 6 Länder), nicht aus den Standardwerten eines neuen Besuchers.
- Der Hinweis «1 Issue» im lokalen Next-Overlay.
- Ein Test schlägt schon vor jeder Änderung fehl (`pnpm test`, «actual 1, expected 0»), vermutlich derselbe wie im Abschnitt vom 29.10. in `HANDOFF.md`.
