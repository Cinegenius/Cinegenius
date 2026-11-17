# Gewerke und Berufe: Abgleich vom 16. November 2026

## Ergebnis und Methode

Der aktuelle Profilkatalog enthält 25 Bereiche mit 962 auswählbaren Einträgen. Das sind nicht 962 unterschiedliche Berufe: deutsche/englische Varianten und mehrfach einsortierte Tätigkeiten tragen zu dieser Zahl bei.

Abgeglichen wurden veröffentlichte Crew-/Creditlisten von **140 unterschiedlichen Filmen** mit zusammen 860 verschiedenen Credit-Beschriftungen. Mindestumfang pro Film: 20 unterschiedliche Beschriftungen. Nach Film-ID wurden doppelte Quellen zusammengeführt. Die vollständige Quellenliste steht in [crew-credits-2026-11-16.csv](crew-credits-2026-11-16.csv). Die Auswahl umfasst Realfilm, Animation und Dokumentarfilm, darunter deutschsprachige Produktionen.

**Grenze:** Das ist ein Vergleich mit veröffentlichten Credit-Daten, keine Sichtung von 140 vollständigen Filmabspännen Bild für Bild. AFI Watch verweist seinerseits auf TMDB; diese Quellen sind also nicht unabhängig. TMDB ist redaktionell ergänzbar und nicht garantiert vollständig. Rollenhäufigkeiten sind Hinweise innerhalb dieser Stichprobe, keine Aussagen über die gesamte Filmbranche. Bei abweichenden Suchtreffern wurde der tatsächlich gelieferte Film erfasst, nicht der ursprünglich gesuchte Titel. Offizielle Sony-Classics-Pressehefte dienen zusätzlich als Gegenprüfung, zählen nicht ein zweites Mal zur Filmzahl.

Die Rohabrufe, Prüfsummen und maschinellen Zwischenstände liegen auf dem Server unter `/srv/cinegenius/research/20261116-crew-credit-audit/`. Personen aus den Credits wurden nicht als CineGenius-Mitglieder angelegt oder übernommen.

## Zuerst Zuordnungen und Synonyme bereinigen

| Fund | Empfehlung |
| --- | --- |
| „Aufnahmeleiter (1st AD)“ unter Produktion | Keine Gleichsetzung: 1st AD als Regieassistenz führen, Aufnahmeleitung separat erhalten. Bestehende IDs und Mitgliederzuordnungen vor einer Migration prüfen. |
| „Regieassistenz (Set-Runner)“ | Runner und Regieassistenz nicht als identischen Beruf behandeln. |
| „First Assistant Director“ in 93 Listen, „Second Assistant Director“ in 84 | Englische Suchbegriffe auf die vorhandene 1./2. Regieassistenz beziehen, statt neue Parallelberufe anzulegen. |
| „Production Accountant“ in 44 Listen | Vorhandene Buchhaltung präziser beschriften und als Produktionsbuchhaltung auffindbar machen. Assistenz und Lohnbuchhaltung bleiben eigenständig. |
| „Dialect Coach“ in 30 Listen | Suchalias für die vorhandenen Dialekt-/Sprach-Coaches; kein weiterer Auswahlpunkt nötig. |
| „Greensman“ in 21 Listen | Mit vorhandener Greens-/Setbegrünungs-Auswahl verbinden. |
| Perückenmacher, Data Wrangler, Green Consultant, Intimacy Coordinator in mehreren Varianten/Bereichen | Kanonische IDs und Suchsynonyme prüfen. Abteilungskontext erhalten; nicht pauschal zusammenführen. |
| Safety-/Sanitätsberufe | Qualifikationen nicht gleichsetzen; Set Medic ist kein automatischer Nachweis einer bestimmten Ausbildung. |
| Credits wie „Thanks“, „Cast“, „Other“ | Keine zusätzlichen Profilberufe daraus erzeugen. |

In der deutschen Anzeige gibt es innerhalb eines Bereichs keine exakt gleichen Beschriftungen. In den anderen Übersetzungen existieren Gruppen identischer Beschriftungen: EN 28, ES 44, IT 46, CS 45, HU 39, NL 40, NL-BE 40, SV 39. Diese Gruppen sind Prüfkandidaten, keine Freigabe zum Zusammenlegen. Hinzu kommen sieben Gruppen kollidierender Suchaliase.

## Sinnvolle Ergänzungen bzw. Spezialisierungen

| Kandidat | Beleg in der Stichprobe | Einordnung |
| --- | --- | --- |
| Set-Presse / Unit Publicist | 35 Filme, u. a. Inception, The Dark Knight | Echte feinere Auswahl unter PR; derzeit nur allgemeines Marketing/PR. |
| Archivrecherche / Archivmaterial-Recherche | 3 Filme mit „Archival Footage Research“ | Redaktion/Dokumentarfilm; zunächst Suchbegriff und Fachprüfung, da kleine Stichprobe. |
| Prosthetic Designer | 9 Filme | Eigenständige Gestaltung gegenüber vorhandenem Prosthetics Artist prüfen; nicht nur englische Dublette. |
| Prosthetic Supervisor | 9 Filme | Leitungsfunktion der Spezialmaske prüfen. |
| Prosthetics Sculptor | 5 Filme | Spezialisierung im Maskenbau; mit vorhandenen Modellier-/Maskenbaurollen abgleichen. |
| Postproduktionsbuchhaltung | 7 Filme | Spezialisierung gegenüber allgemeiner Produktionsbuchhaltung. |
| Second Second AD / Crowd AD | 36 bzw. 5 Filme | Länderabhängige Aufgabenabgrenzung; nicht automatisch mit 2nd/3rd AD gleichsetzen. |

**Nicht in diesem Änderungspaket automatisch eingeführt:** neue Berufsnamen, Umbenennungen von IDs oder Massenänderungen bestehender Profile. Die bestätigte Auswahlregel kann unabhängig davon angewandt werden. Katalogänderungen brauchen eine eindeutige Zuordnung bestehender IDs sowie dieselben Begriffe in Profil, Onboarding, Crew-Filter, Jobs, Projektcredits und allen neun Sprachen.

## Gegenprüfungen aus Originalquellen

- [ScreenSkills: Film-/TV-Berufe](https://www.screenskills.com/job-profiles/browse/film-and-tv-drama/) und [aktuelle Rollenabgrenzung für Regieassistenz, Locations und Buchhaltung](https://www.screenskills.com/news/help-us-develop-new-national-occupational-standards-for-screen-industry-roles-1/).
- [ScreenSkills: Production Accountant](https://www.screenskills.com/job-profiles/browse/film-and-tv-drama/production-management/production-accountant/).
- [ScreenSkills: Hair & Make-up, einschließlich Perücken und Prosthetics](https://www.screenskills.com/your-career/freelance-toolkit/portfolio-careers/roles-in-hair-and-make-up/).
- [Australian Production Design Guild: Berufsabgrenzungen](https://apdg.org.au/resources/starting-in-the-screen-industry).
- [Sony Classics: Animal Kingdom, offizielles Presseheft](https://www.sonyclassics.com/animalkingdom/animalkingdompresskit.pdf), [Another Year](https://www.sonyclassics.com/anotheryear/anotheryear_presskit.pdf), [A Separation](https://www.sonyclassics.com/aseparation/aseparation_presskit.pdf).
