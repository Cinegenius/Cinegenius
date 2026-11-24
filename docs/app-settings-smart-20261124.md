# Persönlicher App-Bereich und Smart · 24. November 2026

## Auftrag und Trennung

APP Root hat den konkreten Nutzerfolgeauftrag übergeben: den automatischen Übersetzungshinweis nur in Smart ausblenden und die große obere Leerfläche sowie die überdeckende persönliche Kopfzeile in Einstellungen beheben. Kandidat auf `6c19a8d00c3684dfbe29643b6fa2a89269746201`; Kostenoptimierung `9dc9e6fa` bleibt getrennt. Kein Deploy, keine Änderung von main, keine native Installation. Der gemeinsame Team-/Guide-Release bleibt zurückgehalten.

## Änderung

- Der native Hauptbereich reserviert den gemessenen Kopfabstand bereits. Die persönliche Seitenüberschrift hatte zusätzlich den Website-Sticky-Abstand; in verschachtelten Rückkehransichten blieb außerdem `pt-16` aktiv. Ein eigener persönlicher Bereichsmarker entfernt diesen zweiten Abstand auch unter einem Wrapper. Die Überschrift scrollt im App-Modus mit dem Inhalt, ohne über Einstellungszeilen liegen zu bleiben. Bei großer Schrift kann der Angebotsknopf in eine zweite Zeile wechseln. Dieselbe gemeinsame Kopfzeile anderer persönlicher Tabs erhält dieselbe Korrektur.
- Nur die native Smart-Instanz blendet den Satz zur automatischen Übersetzung aus. Originalmodusstatus, Sprachumschalter, Wiederholen und Karteninfo bleiben erhalten. Andere native Bereiche behalten ihren Hinweis; die gewöhnliche Website behält Text und Darstellung.
- Keine neue Anfrage, Kontofunktion, Sprachkopie, Berechtigung, Migration, Modelländerung oder Aktivierung von Gmail. Inhalte und Eingaben werden nicht verändert.

## Prüfstand

115 gezielte Fälle für Inhaltsgeometrie/-beobachtung, persönliche Einstellungen/Navigation, Übersetzung und Smart-Verhalten bestanden. Zwei neue Geometrieverträge mit kausalen Negativkontrollen sind Teil des bestehenden Designgates; insgesamt22 Designfälle bestanden. Vollständiges TypeScript und17 Sprachkataloge mit11760 Schlüsseln bestanden.

ESLint ist nicht insgesamt grün: Im unveränderten Dashboard-Bestand bestehen7 Hook-Fehler und1 Navigationswarnung. Der maschinenlesbare Vergleich mit6c19 bestätigt exakt dieselben Meldungen; beide weiteren geänderten TSX-Dateien sind ohne Meldung. Keine neuen Lintprobleme und keine beiläufige Änderung alter Kontologik.

Browserbelege liegen außerhalb des Repositories unter `/srv/cinegenius/handoffs/20261124-app-settings-spacing`. Verwendet werden echte extrahierte Dashboard-Struktur, PersonalSettings, Übersetzungsprovider/-aktionen, Karteninfo, Inhaltsbeobachter und CSS. Die Prüfung ersetzt Clerk, Datenschutz-Unterformular und Übersetzungsdienst durch kontrollierte Attrappen und bildet die native Kopfleiste geometrisch nach. Sie ist kein vollständiger angemeldeter Websiteablauf und keine physische App-/Dynamic-Type-Abnahme. Erwartete React-Key-Warnungen aus dem Vorschauadapter werden getrennt protokolliert; keine externen Anfragen.

32 kontrollierte Chromiumfälle bestanden (12 Settings-Paare,2 öffentliche Settings-Vergleiche,17 Smart-Sprachen,1 öffentlicher Smart-Hinweis). Browsermatrix: Settings bei320/393/820px,16/24px Grundschrift, direkt und verschachtelt; alter und neuer Stand, Scrollen, Kontoeinstellungen bewusst öffnen, Datenschutzbedienung, Titelumbruch und horizontaler Überlauf. Gewöhnliche Settings bei320/820px mit gleicher Geometrie und gleichem Markup bis auf den neutralen Bereichsmarker. Smart-Aktionen und Originalmodus in17 Sprachen bei320px, Karteninfo öffnen/schließen, öffentlicher Übersetzungshinweis erhalten. Bei393px/16px blieb der alte persönliche Kopf trotz180px Scrollweg bei215px stehen; der neue Kopf bewegt sich von139px auf−41px mit. Mit zusätzlichem Wrapper beginnt die erste Einstellungszeile jetzt bei224 statt288px. Diese Messwerte gelten für die dokumentierte Browserattrappe. Ergebnis und Hashmanifest stehen im separaten Kandidatenbeleg.

Ein vollständiger Next-Produktionsbuild, Zusammenführung, Veröffentlichung und physische Prüfung bleiben getrennte Schritte; dieser Quellkandidat behauptet keinen solchen Nachweis.

## Schnellwahl: ausschließlich Bestandsprüfung, keine Implementierung

Root erstellt zuerst die Vorschau. Die aktuelle native Smart-Quellenwahl enthält Crew, Marktplatz, Locations, Firmen, Jobs und Projekte. Smart selbst ist die Sammelansicht. Eine Reihe Crew / Locations / Smart / Firmen / Jobs benötigt weiterhin einen sichtbaren Zugang zum Marktplatz; Projekte dürfen nicht durch das Entfernen des Stern-Menüs zu einem unerreichbaren aktiven Filter werden.

| Bestand | Folge für den späteren Entwurf |
| --- | --- |
| `NativeSmartFilters`: `hiddenAreas` und eigener `browse`-Filterbestand | Nur Quellenwahl verändern; Land, Region, Stadt, Umkreis und Detailfilter erhalten. Keine versteckten wirksamen Filter zurücklassen. |
| `UnifiedSearchResults` und `useViewState`: konto-/pfadgebundener `smart.controls`-Zustand im echten Verlauf | Keine künstlichen Zurück-Einträge, kein Reset fremder Konten oder gespeicherter Ansichten. |
| Smart-Sammelansicht gegenüber echten Verzeichnisrouten | Bewusst entscheiden, ob die Reihe innerhalb Smart filtert oder zu `/creators`, `/locations`, `/props`, `/companies`, `/jobs` navigiert. Das sind unterschiedliche Bedienabläufe. |
| Serverseitig projizierte Gruppen, Cursor, Kartenpunkte und Ergebnisanzahlen | Neue Knöpfe gewähren keine Berechtigung und dürfen keine nicht berechtigten Bereiche oder erfundene Kartenpunkte hinzufügen. |

Keine Änderungen an Navigation, Filtern oder Ergebnisverarbeitung in diesem Kandidaten. Die Vorschau und Nutzerentscheidung bleiben Voraussetzung für den getrennten Umbau.
