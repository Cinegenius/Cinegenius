# Kamerabühne / Grip: Bezeichnungen und Einordnung

Geprüft am 21. Oktober 2026. Diese Liste ist ein kuratierter, überprüfbarer Plattformkatalog, keine weltweit vollständige Norm. Gewerke und Credits variieren nach Land, Produktionsgröße und Vertrag.

## Quellen

- [Bundesverband Beleuchtung & Kamerabühne (BVB): Berufsbilder](https://bvb-verband.de/mitglieder/berufsbilder/) — ordnet Kamerabühne als eigenes Gewerk ein und führt 1. Kamerabühne, 2. Kamerabühne sowie Kamerabühnenassistenz; nennt Dolly- und Kamera-Kran-Systeme.
- [BVB: Aufnahme in den Verband](https://bvb-verband.de/verband/aufnahme/) — unterscheidet Kamerabühne und Kamerabühnenassistenz und nennt Dollyfahrer*in.
- [Crew United: Sascha Ronge](https://www.crew-united.com/de/Sascha-Ronge_255337.html) — Beispiel für die im deutschen Profilkontext verwendeten Credits 1. Kamerabühne, Dolly Grip, Kranoperator und Kamerabühnenassistenz Grip.
- [Crew United: Jan Hagen](https://www.crew-united.com/en/Jan-Hagen_71512.html) — führt Key Grip, Dolly Grip und Rigging Grip als getrennte Tätigkeiten.
- [IMDb: 6 Below — Full Cast & Crew](https://www.imdb.com/title/tt5503688/fullcredits/) und [Horrible Bosses — Full Cast & Crew](https://www.imdb.com/title/tt1499658/fullcredits/) — Credits weisen Grip, Key Grip, Best Boy Grip, Dolly Grip und Rigging-Grip-Positionen separat aus. Credits belegen verwendete Titel, aber keine allgemeingültige Berufsordnung.
- [Screen Ireland: Grip Department](https://www.screenireland.ie/images/uploads/general/Booklet_7_-_Grip_Department_2024.pdf) — Branchenleitfaden beschreibt je nach Teamzuschnitt Grips, Remote-Head-Techniker*innen, Crane Operator und Tracking-Car-Fahrer*innen im Zusammenhang mit Grip-Arbeit.
- [IATSE Local 891: Job Descriptions](https://iatse.com/_content/documents/public/Application%20forms/ourwork/IATSE%20891%20Job%20Descriptions-FINAL%20Aug%203-2021-WEBSITE.pdf) und [IATSE Local 856: Collective Agreement 2024](https://www.iatse856.com/wp-content/uploads/2024/02/2024-Collective-Agreement.pdf) — nordamerikanische Tarif-/Berufslisten führen unter anderem Key Grip, Dolly Grip, Rigging Grip, Grip Best, Crane Operator und Rigging-Varianten; die Einteilung ist regional.
- [BECTU Grips Branch](https://www.gripsbranch.org.uk/) — führt im britischen Kontext Grips und Crane Technicians gemeinsam im Fachbereich.

## Im Produktkatalog

Die zentrale Quelle ist `lib/gripTaxonomy.ts`. Jede Tätigkeit hat eine sichtbare Bezeichnung, englischen Titel, Suchalternativen und eine kurze Erläuterung.

| Plattformbezeichnung | Einordnung |
| --- | --- |
| Key Grip | Leitende Grip-/Kamerabühnenposition in vielen englischsprachigen Credits. Nicht in jedem Land exakt gleichrangig mit „1. Kamerabühne“. |
| Best Boy Grip / 2. Kamerabühne | Assistenz- bzw. zweite Position; die Bezeichnungen überschneiden sich in manchen Märkten, sind aber keine überall garantierten Synonyme. |
| Dolly Grip / Dollyfahrer*in | Spezialisierung für Dolly und Schienen; im deutschen BVB-Kontext ist Dollyfahrer*in belegt. |
| Grip / Kamerabühne | Allgemeiner Eintrag für mechanische Kameraunterstützung und Grip-Teamarbeit. |
| Kamerabühnenassistenz / Grip Assistant | Assistenzposition, getrennt von leitenden Rollen. |
| Rigging Grip | Grip-Aufbauten, die häufig vor Drehbeginn oder standortbezogen vorbereitet werden. |
| Rigging Key Grip | Leitende Rigging-Spezialisierung, sofern die Produktion diese Position separat besetzt. |
| Rigging Best Boy Grip | Assistenz-/Koordinationsrolle im Rigging-Team, wo sie separat geführt wird. |
| Spezialkonstruktionen (Kamerabühne) | Individuelle mechanische Kameraaufbauten; keine allgemeine Bezeichnung für Szenenbild- oder Setbauarbeiten. |
| Kamera-Kran- / Jib-Operator*in | Bedienung eines Kamera-Krans/Jibs. Operator- und technische Aufbauaufgaben sind getrennt; notwendige Qualifikation hängt vom System und Einsatzort ab. |
| Kamerakran-Techniker*in | Technische Einrichtung und Unterstützung, nicht automatisch identisch mit Operator. |
| U-Crane / Technocrane Operator*in | Gerätespezifische Kran-Spezialisierung. |
| Remote-Head-Techniker*in / -Operator*in | Spezialisierte Technik oder Bedienung fernsteuerbarer Kameraköpfe. |
| Praktikant*in Kamerabühne / Grip | Einsteigerposition. |

„Camera Car Driver“, Luftbildpilot*innen, Kamera-Drohnenpilot*innen und Spidercam-Pilot*innen bleiben als angrenzende Kamera-/Fahrzeug-/Broadcast-Tätigkeiten getrennt auswählbar. IMDb-Credits zeigen, dass „Camera Car Driver“ je nach Produktion in unterschiedlichen Abteilungen geführt wird; die Plattform zählt es deshalb nicht als Grip-Synonym. Auch Grip und Beleuchtung (Best Boy Electric, Gaffer) bleiben getrennte Bereiche.

Ältere gespeicherte Positionsnamen wie „1. Kamerabühne“, „2. Kamerabühne“, „Kamerabühnenassistent*in“, „U-Crane Operator“ und „Stabilized Remote Head Technician“ bleiben in öffentlichen Profilen erhalten und werden über Alias-Suche der passenden Tätigkeit zugeordnet, wo die Bezeichnung hinreichend klar ist.
