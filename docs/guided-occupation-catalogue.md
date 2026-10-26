# Gewerke- und Tätigkeitsbestand für die geführte Profilerstellung

Abgeglichen am 21. Oktober 2026. Die geführte Profilerstellung verwendet dieselben ausgewählten Tätigkeiten wie Profilbearbeitung, Crewfilter und Job-/Projektausschreibungen.

## Verbindliche Crewfilter-Regel (26. Oktober 2026)

Alle ausdrücklich ausgewählten Tätigkeiten bestimmen die Auffindbarkeit: sowohl im zugehörigen Gewerk als auch im konkreten Berufsfilter. Mehrfachauswahl über mehrere Gewerke ist erlaubt; unter „Alle Bereiche“ erscheint eine Person weiterhin einmal. Die Haupttätigkeit dient zur Hervorhebung und Sortierung der Berufsangaben, nicht als Ausschlusskriterium für andere ausgewählte Berufe. Diese Regel ersetzt die frühere Einschränkung auf eine Haupttätigkeit beziehungsweise ein einziges eindeutiges Gewerk.

`lib/crew-occupations.ts` löst ausschließlich gespeicherte Berufsangaben und deklarierte exakte Synonyme auf. Onboarding und Profilbearbeitung speichern für neue Auswahlen zusätzlich `crew.occupations` mit Gewerke- und Rollenkennung im vorhandenen JSON-Feld. Öffentliche Crewseite und Nachlade-API verwenden daraus dieselben `occupationIds`; synthetische Profiltyp-Beschriftungen werden nicht als ausgewählte Berufe ausgewertet. Gleichlautende Berufe in verschiedenen Gewerken werden anhand ihrer gespeicherten Kennung unterschieden. Nicht eindeutig auflösbare ältere Freitextangaben werden nicht ungeprüft fremden Gewerken zugeordnet.

## Bestandsabgleich

Die bestehende Profil- und Crewquelle `lib/departments.ts` enthielt 20 Bereiche. Die Job-/Projektquelle `lib/filmRoles.ts` enthielt 30 Fachbereiche mit 761 auswählbaren Rolleneinträgen. Diese 30 Bereiche werden per `FILM_TO_PROFILE_DEPARTMENT` auf die gemeinsame Auswahl abgebildet. Rollen werden im Zielbereich anhand ihrer kanonischen Bezeichnung und gepflegten Aliasnamen zusammengeführt, damit sie nicht als doppelte Auswahl erscheinen.

Der resultierende Katalog umfasst 22 Gewerke und 955 sichtbare Tätigkeiten. Die zwei bisher fehlenden auswählbaren Bereiche „Drehbuch & Schreiben“ und „Public Relations“ wurden ergänzt. Die übrigen Jobbereiche werden fachlich in bereits bestehende Profile-Gewerke einsortiert.

| Gewerk in der geführten Auswahl | Tätigkeiten |
| --- | ---: |
| Produktion | 118 |
| Regie | 42 |
| Kamera | 78 |
| Licht | 22 |
| Kamerabühne / Grip | 14 |
| Ton | 51 |
| Art Department | 101 |
| Kostüm | 62 |
| Maske & Hair | 26 |
| Postproduktion | 122 |
| Musik & Audio | 23 |
| Set / Logistik | 70 |
| Cast & Performance | 38 |
| SFX | 18 |
| TV / Broadcast | 40 |
| Virtual Production | 17 |
| Redaktion & Content | 38 |
| Social Media | 13 |
| Fotografie | 13 |
| KI & AI | 12 |
| Drehbuch & Schreiben | 34 |
| Public Relations | 3 |
| **Gesamt** | **955** |

## Zuordnung der Job-/Projektbereiche

| Bereiche aus `filmRoles.ts` | Gemeinsames Profilgewerk |
| --- | --- |
| Vor der Kamera, Besetzung, Stunts | Cast & Performance |
| Regie | Regie |
| Kamera | Kamera |
| Licht | Licht |
| Grip | Kamerabühne / Grip |
| Ton, Ton-Post | Ton |
| Maske | Maske & Hair |
| Kostüm | Kostüm |
| Szenenbild | Art Department |
| Produktion, Filmgeschäftsführung, Producer | Produktion |
| Post, VFX, Animation 3D | Postproduktion |
| Drehbuch | Drehbuch & Schreiben |
| Musik | Musik & Audio |
| Sende-/Veranstaltung | TV / Broadcast |
| Spezialeffekte | SFX |
| TV-/Web-Content | Redaktion & Content |
| Virtual Production | Virtual Production |
| Public Relations | Public Relations |
| Weitere Crew | Set / Logistik |
| Content Creation | Social Media |
| Social Video | Social Media |
| Fotografie, Foto-Post | Fotografie |

## Verhalten beim Speichern

- Die geführte Profilerstellung speichert kanonische Tätigkeitsnamen im vorhandenen `positions`-Feld und leitet erlaubte Profiltypen aus den gewählten Gewerken ab.
- Eine Suche nach Gewerk oder Berufsbezeichnung zeigt passende Berufschips direkt an; ein Berufstreffer wählt zugleich das zugehörige Gewerk.
- Ältere Entwürfe mit dem vorherigen `gripPositions`-Feld oder der früheren kurzen Rollenliste werden beim Fortsetzen in die gemeinsame Auswahl übernommen.
- Wird ein Gewerk entfernt, werden seine exklusiven Tätigkeitsauswahlen nach einer sichtbaren Bestätigung entfernt. Eine gleiche Tätigkeit bleibt erhalten, falls ein anderes ausgewähltes Gewerk sie ebenfalls führt.
- Der Katalogtest kontrolliert, dass alle 30 Job-/Projektbereiche zugeordnet sind, Rollen im gemeinsamen Katalog auffindbar sind und die Zusammenführung innerhalb eines Gewerks keine doppelten sichtbaren Bezeichnungen erzeugt.
