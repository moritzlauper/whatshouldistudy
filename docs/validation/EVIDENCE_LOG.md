# Evidenzlog: Instrument und Empfehlungen

Stand 29.10.2026. Dieses Log trennt veröffentlichte Befunde, die Begründung
für eine Produktentscheidung und noch nicht geprüfte Annahmen. Es ist weder
eine Validierungsstudie noch ein Ersatz für die im Pilotprotokoll verlangte
unabhängige Prüfung.

## Volltextstand (29.10.2026)

Ab diesem Stand gilt: In Produkttexten, Code-Kommentaren und Berichten wird nur
zitiert, was im Zotero-Projekt `whatshouldistudy` als Volltext vorliegt und
gelesen wurde (Zotero-Tag `volltext-gelesen`, 29 Quellen). Kennwerte mit
Seitenangaben stehen im Bericht «wasstudieren: Wissenschaftliche Grundlage für
Test und Studiengang-Mapping» (https://claude.ai/artifact/S4KP2rNMbHaefe8Ndxw3hb).

Folgende unten aufgeführte Einträge haben **keinen** Volltext in Zotero und
gelten bis zur Prüfung als nicht belegt: Donnellan et al. (2006), Youyou et al.
(2015), Holland (1997), Nye et al. (2012, 2017), Tracey & Robbins (2006),
Allen & Robbins (2010), Hanna & Rounds (2020) sowie alle weiteren Einträge ohne
Tag `volltext-gelesen`. Beaton et al. (2000) ist inzwischen im Volltext
ausgewertet. Beim Verb-Interessentest liegt nur die Itemliste vor, keine
Kennwerte.

Wichtigste Folgerungen aus den Volltexten:

- Interessenpassung sagt Studienleistung kaum voraus (ρ = .01, ohne
  Grossstichproben .10), Verbleib und Zufriedenheit schwach (de Vries et al.,
  2024, S. 10). Schulnoten sind für Leistung stärker (ρ = .46; Trapmann et al.,
  2007, S. 14).
- Profilkorrelation ist der beste interpretierbare Passungsindex; Distanzmasse
  tragen fast nichts bei (Granillo-Velasquez et al., 2025, S. 7–10).
- Basisinteressen-Fit übertrifft RIASEC-Fit (Chu et al., 2025, S. 16);
  CABIN-NET ist public domain.
- KI-Ratings von Umwelten nur mit Experten-Ankern, mehreren Modellen und
  Läufen, Equating und Review (Liu et al., 2026, O*NET Report 031).
- Ein dreistufiges Passungssignal ohne Erklärung hatte keinen Effekt (Moore &
  Cruce, 2020, S. 398, 406).

Umgesetzt am 29.10.2026 (Versionen `wsis-subjects14-activities45-2026-10-29.1`,
`wsis-basic-fit-2026-10-29.2`): Interessen als Freude an den 14 Schulfächern
und 45 Tätigkeiten in 15 Bereichen ohne eigenes Schulfach, 12 davon mit den
CABIN-NET-Items, drei mit eigenen Items; RIASEC als Zusammenfassung; Rangliste
nur nach Profilkorrelation von Fächern und Bereichen mit Feldprofilen aus
O*NET-Wissensbereichen (Methode von Chu et al., 2025), ohne Distanzanteil;
Mathematiknote als grober Bereich und getrennter Hinweis zur Machbarkeit;
keine Persönlichkeits- und Werte-Fragen, Werte als Filter; eingelesene Daten
ohne Einfluss auf die Rangliste im Fragebogen-Modus; Gruppen ähnlicher Passung
und Alternativen aus anderen Bereichen; optionales KI-Ensemble aus drei
Modellen und je drei Läufen mit gespeicherter Streuung. Nicht umgesetzt: Items
der vollen CABIN (Rechte ungeklärt), Basisinteressen-Ratings aus O*NET 30.3
(noch nicht veröffentlicht), Experten-Anker und Equating für die KI-Ratings.

## Aktuelle Quellen

| Bereich | Quelle | Was sie für wasstudieren stützt | Was sie nicht stützt |
| --- | --- | --- | --- |
| RIASEC und Studienfachumwelten | Nauta (2010), *The Development, Evolution, and Status of Holland’s Theory of Vocational Personalities*, DOI [10.1037/a0018213](https://doi.org/10.1037/a0018213) | RIASEC ist ein sinnvoller theoretischer Rahmen, um Interessen und Lern-/Arbeitsumwelten zu beschreiben; die prognostische Kraft von Kongruenz ist jedoch begrenzt. | Die 24 eigenen WSIS-Items, die Feldprofile oder deren Gewichte sind dadurch nicht validiert. |
| RIASEC, Studienfach und Erwartungen | Pike (2006), *Students' Personality Types, Intended Majors, and College Expectations*, DOI [10.1007/s11162-006-9016-5](https://doi.org/10.1007/s11162-006-9016-5) | Persönlichkeitstypen, beabsichtigte Studienfächer und Erwartungen hängen zusammen; Person und Studienumwelt müssen getrennt betrachtet werden. | Keine Kausalität, keine Vorhersage individueller Studienerfolge und keine Validierung dieser Plattform. |
| Big Five | Donnellan et al. (2006), *The Mini-IPIP Scales*, DOI [10.1037/1040-3590.18.2.192](https://doi.org/10.1037/1040-3590.18.2.192) | Die Herkunft und Kurzform der 20 Mini-IPIP-Items. | Eigene Übersetzungen, Normen, Diagnosen oder eine Verwendung zur Ranglistenentscheidung. |
| Übersetzungen | Beaton et al. (2000), *Guidelines for the Process of Cross-Cultural Adaptation of Self-Report Measures*, DOI [10.1097/00007632-200012150-00014](https://doi.org/10.1097/00007632-200012150-00014) | Die Notwendigkeit eines dokumentierten, sprachspezifischen Adaptions- und Prüfprozesses. | Dass eine Übersetzung durch blosses Vorliegen gleichwertig oder validiert ist. |
| Digitale Spuren | Youyou, Kosinski & Stillwell (2015), *Computer-Based Personality Judgments Are More Accurate Than Those Made by Humans*, DOI [10.1073/pnas.1418680112](https://doi.org/10.1073/pnas.1418680112) | Digitale Spuren können unter klaren Bedingungen psychologisch relevante Informationen enthalten. | Dass ein individueller Verlauf Studieninteressen, Eignung oder Studienerfolg zuverlässig vorhersagt; die Stichprobe und Merkmale sind nicht mit WSIS gleichzusetzen. |
| Sensitivität digitaler Spuren | Kosinski, Stillwell & Graepel (2013), *Private Traits and Attributes Are Predictable from Digital Records of Human Behavior*, DOI [10.1073/pnas.1218772110](https://doi.org/10.1073/pnas.1218772110) | Digitale Spuren können Merkmale offenbaren, die Personen nicht bewusst preisgeben; Transparenz, lokale Verarbeitung und freiwillige Aktivierung sind deshalb zentrale Schutzmassnahmen. | Dass aus solchen Spuren ein fairer oder geeigneter Studienvorschlag folgt. |

Die sechs Quellen oben sind im Zotero-Projekt `whatshouldistudy` erfasst. Der
Volltext von Pike ist über den institutionellen Springer-Zugang geprüft; Nauta
und beide PNAS-Artikel sind frei zugänglich. Ein Autor:innen-PDF zu Donnellan
ist im Korpus verlinkt; für Beaton ist der Volltextzugang vor einer vollständigen
Auswertung noch explizit zu prüfen.

## Ergänzungen vom 29.10.2026

Die folgenden Einträge stützen sich auf Abstracts, Verlags- und
Katalogangaben sowie bei VIT und VIT-2 auf die Originaldokumente. Die
Volltexte der Zeitschriftenartikel sind noch nicht ausgewertet; vor einer
Zitierung in Produkttexten oder Publikationen sind die genannten Kennwerte am
Volltext zu prüfen.

### Interessen, Kongruenz und Studienverlauf

| Bereich | Quelle | Was sie für wasstudieren stützt | Was sie nicht stützt |
| --- | --- | --- | --- |
| Theorie | Holland (1997), *Making Vocational Choices* (3. Aufl.), Psychological Assessment Resources | Originalquelle für RIASEC, Umwelten und Kongruenz. | Keine Aussage über die eigenen Items oder Feldprofile. |
| Kongruenz und Leistung | Nye, Su, Rounds & Drasgow (2012), DOI [10.1177/1745691612449021](https://doi.org/10.1177/1745691612449021); dies. (2017), DOI [10.1016/j.jvb.2016.11.002](https://doi.org/10.1016/j.jvb.2016.11.002) | Interessen hängen mit Leistung und Verbleib in Arbeit und Ausbildung zusammen; Kongruenzindizes korrelieren stärker als Interessenwerte allein. | Die Höhe der Kongruenzvalidität unterscheidet sich zwischen Meta-Analysen und Operationalisierungen; kein Beleg für WSIS-Feldprofile oder Gewichte. |
| Kongruenz und Studienverlauf | Tracey & Robbins (2006), DOI [10.1016/j.jvb.2005.11.003](https://doi.org/10.1016/j.jvb.2005.11.003); Allen & Robbins (2010), DOI [10.1037/a0017267](https://doi.org/10.1037/a0017267) | Längsschnittlich hängt Interessen-Fach-Kongruenz mit Noten, Verbleib und rechtzeitigem Abschluss zusammen. | US-Colleges, ACT-Instrumente; der Zusammenhang ist moderiert. Nicht auf Schweizer Hochschulen oder die eigene Skala übertragbar. |
| Trefferquoten | Hanna & Rounds (2020), DOI [10.1037/bul0000269](https://doi.org/10.1037/bul0000269) | Gemessene Interessen treffen die spätere Laufbahnwahl meta-analytisch in geschätzt rund der Hälfte der Fälle; Basisraten gehören zur Bewertung. Grundlage für eine ehrliche Einordnung der Ergebnisse. | Keine Trefferquote für WSIS; die Quote variiert nach Inventar, Kriterium und Berechnungsmethode. |
| Deutschsprachige Längsschnittdaten | Stoll et al. (2017), DOI [10.1037/pspp0000117](https://doi.org/10.1037/pspp0000117) | RIASEC-Interessen am Ende des Gymnasiums (Deutschland, N = 3'023) sagen Lebensergebnisse zehn Jahre später über Big Five und IQ hinaus vorher. | Kein Kriterium für Studienerfolg in einzelnen Fächern; anderes Instrument. |
| Stabilität | Low, Yoon, Roberts & Rounds (2005), DOI [10.1037/0033-2909.131.5.713](https://doi.org/10.1037/0033-2909.131.5.713) | Die Rangordnungsstabilität von Interessen steigt in den Studienjahren deutlich; begründet den Retest im Pilot und Vorsicht bei Jüngeren. | Keine Retest-Kennwerte der eigenen Items. |
| Übersicht | Rounds & Su (2014), DOI [10.1177/0963721414522812](https://doi.org/10.1177/0963721414522812) | Theoretische Einordnung von Interessen (Volltext auswerten). | — |

### Instrumente

| Bereich | Quelle | Was sie für wasstudieren stützt | Was sie nicht stützt |
| --- | --- | --- | --- |
| Kurze offene RIASEC-Skalen | Armstrong, Allison & Rounds (2008), DOI [10.1016/j.jvb.2008.06.003](https://doi.org/10.1016/j.jvb.2008.06.003) | Kurze Public-Domain-RIASEC-Skalen können akzeptable Reliabilität und konvergente Validität erreichen. | Englischsprachig; keine Validierung einer deutschen Eigenfassung. |
| Austauschbarkeit von Inventaren | Phan, Chu, Russell, Hoff & Rounds (2022), DOI [10.1177/10690727221081554](https://doi.org/10.1177/10690727221081554) | RIASEC-Werte verschiedener Inventare korrelieren hoch, liefern aber oft unterschiedliche Hauptcodes. | Spricht gegen die Annahme, die Eigenfassung führe automatisch zu denselben Empfehlungen wie etablierte Tests. |
| Verb-Interessentest (VIT) | Wetzel, Hell & Päßler (2012), DOI [10.1177/1069072711417166](https://doi.org/10.1177/1069072711417166); Hell, Wetzel & Päßler (2013), Zenodo, DOI [10.5281/zenodo.6534339](https://doi.org/10.5281/zenodo.6534339), Lizenz laut Zenodo CC BY 4.0 | Deutschsprachiges, genderfair konstruiertes RIASEC-Instrument (45 Items) mit veröffentlichter Itemliste; laut ZHAW-Handbuch korrelieren VIT und AIST-R in den entsprechenden Dimensionen im Mittel um r = .65 bis .69. | Keine Normen für die Zielgruppe; ob die Lizenz auch Auswertungsregeln und Kennwerte umfasst, ist vor Produktnutzung schriftlich zu bestätigen. |
| VIT-2 | Schreiber, Weber & Rüsch (2025), *Handbuch VIT-2*, IAP ZHAW | Schweizer Weiterentwicklung (46 Items); entsprechende Dimensionen korrelieren mit dem ORVIS-R zwischen r = .54 und .75. | Kennwerte aus N = 218 Plattformnutzenden (Ø 36.5 Jahre, 13 Personen 16–19 Jahre, 63.5 % mit Hochschulabschluss); nur Alpha, kein Retest; Itemrechte ungeklärt. |
| AIST-3 | Bergmann & Eder (2019), *AIST-3 Manual*, Hogrefe | Normierter, lizenzpflichtiger Vergleichskandidat (siehe `RESEARCH_DECISIONS.md`). | Keine Übernahme von Items oder Normen in das Produkt. |
| Mini-IPIP | Baldasaro, Shanahan & Bauer (2013), DOI [10.1080/00223891.2012.700466](https://doi.org/10.1080/00223891.2012.700466); Cooper, Smillie & Corr (2010), DOI [10.1016/j.paid.2010.01.004](https://doi.org/10.1016/j.paid.2010.01.004) | In einer grossen US-Stichprobe junger Erwachsener akzeptable Reliabilität und teilweise metrische Invarianz; Modellpassung der Faktorenanalyse nicht optimal. | Keine Aussage über die eigene deutsche Übersetzung oder Normen. |
| Interessen und Persönlichkeit | Mount, Barrick, Scullen & Rounds (2005), DOI [10.1111/j.1744-6570.2005.00468.x](https://doi.org/10.1111/j.1744-6570.2005.00468.x); Vedel (2016), DOI [10.1016/j.paid.2015.12.011](https://doi.org/10.1016/j.paid.2015.12.011) | Big Five und RIASEC hängen zusammen, sind aber verschieden; Big-Five-Unterschiede zwischen Studienrichtungen sind oft mittelgross, bei Offenheit teils gross (Vedel: 12 Studien, 13'389 Studierende). | Gruppenmittelwerte erlauben keine individuelle Zuordnung; stützt die Entscheidung, Persönlichkeit im Fragebogenmodus nicht ins Ranking einfliessen zu lassen. |

### Digitale Spuren und Wirksamkeit

| Bereich | Quelle | Was sie für wasstudieren stützt | Was sie nicht stützt |
| --- | --- | --- | --- |
| Digitale Spuren (Meta-Analyse) | Azucar, Marengo & Settanni (2018), DOI [10.1016/j.paid.2017.12.018](https://doi.org/10.1016/j.paid.2017.12.018) | Big-Five-Vorhersagen aus Social-Media-Daten erreichen moderate Korrelationen (etwa .29 bis .40); mehrere Datenarten verbessern die Genauigkeit. | Betrifft Persönlichkeit, nicht Studieninteressen; YouTube-Verläufe sind nicht gesondert belegt. |
| Wirksamkeit von Laufbahninterventionen | Whiston, Li, Goodrich Mitts & Wright (2017), DOI [10.1016/j.jvb.2017.03.010](https://doi.org/10.1016/j.jvb.2017.03.010) | Grundlage für Primärziele einer späteren randomisierten Studie; Interventionen mit Fachperson wirken stärker als selbstgesteuerte. | Spricht für WSIS als Ergänzung zur Beratung, nicht als Ersatz. |

### Methoden für den Pilot

| Bereich | Quelle | Verwendung im Pilotprotokoll |
| --- | --- | --- |
| Validierungsrahmen | AERA, APA & NCME (2014), *Standards for Educational and Psychological Testing* | Validität als Evidenz für eine bestimmte Interpretation und Verwendung, nicht als Eigenschaft eines Tests. |
| Skalenentwicklung | Boateng et al. (2018), DOI [10.3389/fpubh.2018.00149](https://doi.org/10.3389/fpubh.2018.00149) | Ablauf Itementwicklung, Skalenentwicklung, Evaluation (neun Schritte). |
| Kognitive Interviews | Willis (2005), *Cognitive Interviewing*, Sage | Stufe 0, Schritt 3. |
| Messinvarianz | Putnick & Bornstein (2016), DOI [10.1016/j.dr.2016.06.004](https://doi.org/10.1016/j.dr.2016.06.004) | Prüfung zwischen Sprachfassungen und Messzeitpunkten vor Mittelwertvergleichen. |
| Unaufmerksames Antworten | Meade & Craig (2012), DOI [10.1037/a0028085](https://doi.org/10.1037/a0028085) | Mehrere Indikatoren kombinieren; das Aufmerksamkeitsitem allein begründet keinen automatischen Ausschluss. |

## Folgerungen für das Produkt

1. RIASEC bleibt ein **Orientierungsrahmen**, kein Eignungs-, Erfolgs- oder
   Zulassungsmodell. Die vorhandenen Hinweise zur Eigenentwicklung und zum
   fehlenden Validierungsnachweis bleiben verbindlich.
2. Die Anzeige zur Informationsmenge auf der Ergebnisseite darf nicht als
   Messgüte, Genauigkeit oder Wahrscheinlichkeit gelesen werden. Sie heisst
   deshalb «Wenige Signale», «Mehr Signale» und «Breites Profil» statt
   «Grundlage» und erklärt ihren rein deskriptiven Charakter im Tooltip.
3. Importierte Verläufe sind ein freiwilliges Zusatzsignal. Sie ersetzen weder
   den Fragebogen noch eine unabhängige Studienberatung; selektive Einwilligung
   und zeitliche Verzerrungen bleiben bei jeder späteren Validierung zu prüfen.
4. Neue Itemtexte, Übersetzungen, Feldprofile oder Gewichte benötigen vor
   einer Behauptung psychometrischer Qualität die im
   [Pilotprotokoll](PILOT_PROTOCOL.md) festgelegten Schritte.
5. Ergebnistexte dürfen sich auf veröffentlichte Trefferquoten etablierter
   Interessentests nur als Einordnung beziehen (Hanna & Rounds, 2020), nie
   als Kennwert dieser Plattform.
6. Der VIT ist mit offener Lizenz der naheliegendste deutschsprachige
   Vergleichs- oder Alternativkandidat zur Eigenfassung; VIT-2 bleibt ein
   Kooperationsthema mit der ZHAW. Entscheidungen dazu stehen in
   [RESEARCH_DECISIONS.md](RESEARCH_DECISIONS.md).
