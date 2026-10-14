# Institutionelles Prüfdossier

Arbeitsstand 14.10.2026. Technischer Ablauf beschrieben; keine Rechtsberatung,
behördliche Freigabe, abgeschlossene DSFA oder unterschriebene Vertragsprüfung.
Die Stelle bestimmt ihre Anforderungen und ihr anwendbares kantonales Recht.

## Zwei getrennte Abläufe

| Ablauf | Verarbeitung im Produktcode | Getrennt zu prüfen |
| --- | --- | --- |
| Fragebogen-Sitzung `/beratung` bzw. `/counselling` | Frische Antworten nur in React-Speicher; kein Laden des regulären Profils; keine Imports, KI, Zahlungen, Organisationserfassung, Analyse-Tags oder Forschungsübertragung. Deskriptive Auswertung im Browser. | Seiten-/Assetabrufe an Hosting, IP-/Betriebslogs, Browser/Erweiterungen, gemeinsames Gerät, institutionelle Zulässigkeit |
| Regulärer Report | localStorage/IndexedDB, Katalogsuche, Zahlung/Organisation, freiwillige KI, gegebenenfalls Messdienste wie im öffentlichen Manual beschrieben | Vollständige Datenflüsse, Verträge, Länder, Fristen, Rollen und institutionelle KI-Vorgaben |

Der Einstieg zur separaten Sitzung ist bewusst ein normaler Seitenaufruf:
dadurch bleiben keine bereits geladenen Analyse-Skripte aus dem regulären
Report aktiv. Die Sitzung mountet dessen Shell und Messkomponenten nicht.
Auch unter internen Länder-Rewrites und mit einem `org`-Parameter wird kein
Organisationsprofil geladen. Kein Wechsel in den normalen Report mit Antworten.
Der Manuellink öffnet eine separate normale Webseite, für die deren
Datenschutzhinweise gelten.

Bei «Sitzung beenden» wird der Antwortzustand verworfen; neue Sitzung beginnt
leer. Neuladen verliert Antworten. Bei Seitenwechsel und Rückkehr aus dem
Browser-Cache wird zurückgesetzt. Druck und JSON-Download sind ausdrücklich
ausgelöste persönliche Kopien; eine heruntergeladene Datei oder gedruckte
Seite wird durch Sitzungsende nicht gelöscht. Auf gemeinsamem Gerät auch
Downloads/Druckaufträge prüfen und den Tab schliessen. Keine Zusage forensischer
Löschung von Browser- oder Betriebssystemspeicher.

## Nachweise vor einem institutionellen Einsatz

| Verantwortlich | Offener Nachweis | Abnahmekriterium |
| --- | --- | --- |
| Anbieter + Institution | Zwecke, Rollen, Rechtsgrundlage je Ablauf; separate Forschungsrolle | Schriftliche Freigabe der zuständigen Stelle für den konkreten Einsatz |
| Anbieter | Hosting, Stripe, Redis, Messdienste, Infomaniak: tatsächliche Vertragspartner, Unterauftragnehmer und Länder | Aktuelle Verträge, Standorte, Supportzugriffe, Wechselverfahren dokumentiert |
| Anbieter + Datenschutzfachperson | Auftragsbearbeitung, Auslandbekanntgabe, KI-Weiterverwendung/Training | Vertrag und technische Einstellung stimmen mit Information überein |
| Anbieter | Aufbewahrungs-/Löschmatrix für Inhalte, Profile, Prompts, Logs, Backups und Zahlungsunterlagen | Belegte Fristen und getestete Löschabläufe je Dienst, keine pauschale Nullspeicherung |
| Anbieter | Administration/MFA, Rollen, TLS/Schutz ruhender Daten, Zugriffskontrolle, Vorfallablauf | Tatsächliche Betriebsnachweise, keine alleinige Ableitung aus Hosting-Marketing |
| Institution | Risikoprüfung, allfällige DSFA und interne KI-Vorgaben | Dokumentierte Entscheidung, auch für Variante ohne KI |
| Forschungspartner | Minderjährige, Urteilsfähigkeit/Vertretung, getrennte Forschungseinwilligung | Verständliche Information und freiwillige Teilnahme ohne Nachteile, erforderliche Ethikfreigabe |
| Institution + Fachpartner | Interpretation, Schulung und Grenzen | Abgestimmte Einführung mit Fällen und dokumentierten Lernzielen |

Die Risikoprüfung ist nicht mit einer automatisch notwendigen oder schon
abgeschlossenen DSFA gleichzusetzen. Massgeblich ist die konkrete Bearbeitung;
siehe [EDÖB zur DSFA](https://www.edoeb.admin.ch/de/datenschutz-folgenabschaetzung)
(am 14.10.2026 geprüft). Ein Schweizer Standort oder der Verzicht auf KI
ersetzt keine institutionelle Entscheidung.

## Kurze Einführung für Beratungspersonen

1. Ablauf mit fiktiven Angaben durchführen, Sitzungsende und Verlust beim
   Neuladen zeigen. Keine echten Verläufe für eine Demonstration verlangen.
2. Flaches Profil, nahe Werte und Antwortmuster gemeinsam besprechen. Ein
   Mittelwert von 4 ist kein Bevölkerungsrang und keine Eignungsgrenze.
3. Interesse, Fähigkeitseinschätzung, Zulassung und persönliche Rahmenbedingungen
   unterscheiden. Fehlende oder widersprüchliche Angaben aktiv besprechen.
4. Kopien nur bewusst erzeugen und weitergeben; Forschungsnutzung separat
   vereinbaren. Klären, wann andere Instrumente oder Fachberatung nötig sind.

Dies ist ein Selbstlernablauf, keine anerkannte oder zertifizierte Schulung.
Umfang, Qualifikation und Anerkennung sind mit der konkreten Stelle offen.
