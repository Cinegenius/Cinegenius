# Website- und Nachrichtenprüfung — 14. November 2026

Ausgangsstand: `99fd3cad9d5f1c905354679a4b719c9cee8770d5`. Änderungen auf `codex/homepage-intro-spacing`. Diese Prüfung ist keine Produktionsveröffentlichung.

## Beauftragte Änderungen

- Direkte öffentliche Headerlinks ab 1024 CSS px, direkte kompakte Suche und ein dezenter Tastaturfokus am Menüknopf. Vollständiges Logo, Nachrichten, Portrait, Flagge sowie direkte Gast-Anmeldung bleiben erreichbar. Kleine Ansichten erhalten bei Bedarf eine zweite Kopfzeile mit passenden Inhaltsabständen.
- Homepage-Punkte bewegen ihre Kacheln ohne den vorherigen Anfangssprung; nur die aktive Position ist hervorgehoben. Marktplatzangebote werden über die vorhandenen öffentlichen Kategorien verteilt und in 15-Minuten-Fenstern gewechselt, einschließlich älterer Angebote.
- Crew-, Marktplatz- und Locations-Schnellschalter. Die Gesamtzahl der Profile bleibt beim Umschalten erhalten.
- Freunde und Gruppen im gemeinsamen Nachrichteneingang, direkte Gruppenerstellung und private Bild-/Dokumentanhänge. Der Gruppenwechsel erzeugt nach erfolgreichem Speichern keine falsche Entwurfswarnung.
- Übernommene App-Übergaben: gemeinsame, kleine Angebotsvorschaubilder mit begrenzter Wiederholung; wieder sichtbare ältere Ortsangaben in gemeinsamen Filtern, ohne erfundene Länder oder bestätigte Orts-IDs.

## Browserprüfungen

Chromium auf dem Server, mit dem tatsächlichen Produktions-CSS der lokalen Vorschau. Keine native iPhone-/Android-Abnahme.

| Bereich | Nachweis |
| --- | --- |
| Kopfzeile | 234 Kombinationen aus neun Sprachen, angemeldet/abgemeldet und 320–1366 CSS px: keine überlappenden Bedienelemente, mindestens 44 px, direkte Suche und Gast-Anmeldung, passende Mehr-Menüs und Fokus nach Schließen. |
| Suche | Neun Sprachen bei 320/390/1366 px; Öffnen, Suchergebnisse, Fehler/Wiederholung, Abbrechen und Fokus. |
| Kachelreihen | Touch, Maus, Punktklick, Tastatur, vertikale Scrollabsicht, Abbruch und reduzierte Bewegung bei 320/390/1366 px. Gemessener anfänglicher Sprung entfernt. |
| Crew | Echte öffentliche Daten in neun Sprachen: alle drei Schalter, jeweils nur einer aktiv; Gesamtzahl 180 unverändert. Nach frischem Build erneut deutsch bei 320/390/1024/1366 px geprüft. |
| Ortsauswahl | Tatsächliche Seiten: Marktplatz/Berlin, Locations/Berlin, Firmen/Augsburg, Jobs/München, Filmtiere/München; Auswahl, Länderwechsel und abhängiges Zurücksetzen. URL-Filter bei Marktplatz, Locations und Jobs; Firmen/Filmtiere behalten ihre vorhandene Ansichtsverwaltung, ohne neue URL-Funktion zu behaupten. |
| Angebotsbilder | Alle neun öffentlichen Angebotsbilder des Supportprofils bei 390 und 1366 px geladen. Gemeinsamer Baustein außerdem mit einmaligem HTTP-Fehler, dauerhaftem Fehler und Quellenwechsel geprüft. |
| Nachrichten | Neun Sprachen: Freunde-Verknüpfung, Gruppenerstellung, Dokumentupload mit Fehler/Wiederholung, erhaltene Beschriftung, verkleinerter sichtbarer Bereich als Tastatursimulation, Versandbestätigung und echtes Zurück. Kontrollierte Antworten, keine Nachrichten an reale Mitglieder. |
| Dateiauswahl | Bildkomprimierung/Upload, Abbruch, verspätete Antwort eines vorherigen Kontos, fünf Dateien und 320-px-Reflow. Keine privaten Dateien in Testberichten. |

Browserartefakte auf dem Prüfserver: `/tmp/cg-responsive-polish/`. Wichtige Ergebnisse: `header-results.json`, `search-results.json`, `crew-results.json`, `crew-fresh-results.json`, `place-browser-results.json`, `public-images-results.json`, `images-results.json`, `messaging/results.json`, `rail-frames.json`.

## Automatisierte Prüfungen

- Übersetzungen: neun Kataloge, 7809 Schlüssel, keine neuen ungeprüften Quelltext-Literale. Gemeinsame Designprüfung erfolgreich.
- Nachrichten-/Anhangsgruppe: 55 Tests erfolgreich, einschließlich realer API-Handler, Inhaltsprüfung und isolierter PostgreSQL-Prüfung mit PGlite. Bindung an Konto und Gespräch, atomarer Versand, Wiederholungen, Gruppenbeitritt/-austritt, Sperren und Medienzugriff werden geprüft.
- Nach den benötigten Anpassungen der Testattrappen: 130 Tests für API-Texte, Admin-Support, Auth-Einstiege und Nachrichtendialoge; 35 für Gesprächslisten/Marktplatz; 32 für Laden/Nachrichtenoberfläche; 27 für echte Ortsfilter-API-Handler; 12 für Startseiten-Suchziele; 60 für Job-/Projektlokalisierung erfolgreich. Zahlen überschneiden sich teilweise und sind keine aufsummierte Gesamttestzahl.
- Die 86 Location-Map-/Landing-Tests im kombinierten Lauf bestanden. Der zunächst fehlgeschlagene Startseiten-Suchtest wurde anschließend separat vollständig erfolgreich ausgeführt.
- Neue Verhaltenstests prüfen außerdem Bildwiederholung, Kategorieverteilung/Rotation, öffentliche Auswahl über mehrere Datenbankseiten, Sichtbarkeitsrücknahme und alte Ortsangaben in allen Sprachen.
- Produktionsbuild, TypeScript und Seitenerzeugung erfolgreich; lokale Produktionsvorschau zusätzlich geprüft. Buildprotokoll: `build-release-check.log` mit separatem Ergebnisstatus.
- Lint der geänderten TypeScript-Dateien gegen den Ausgangsstand verglichen: keine neuen Meldungen; vorhandene Meldungen bleiben bestehen. `git diff --check` erfolgreich.

Die gesamte bestehende Testsammlung ist **nicht vollständig grün**. Ein früher Gesamtlauf ergab 3237 Tests mit 310 Fehlern. Die durch neue Imports veralteten Testattrappen wurden angepasst und die betroffenen Gruppen erneut ausgeführt. Unabhängige verbleibende Fehler wurden am unveränderten Ausgangsstand gegengeprüft: unter anderem fehlende Testimporte von `job-metadata`, ältere Projekt-/Navigationserwartungen und die Clerk-ESM-Auflösung. Keine Behauptung, die vollständige Sammlung sei nach den gezielten Wiederholungen fehlerfrei. Vergleichsprotokolle: `baseline-tests.log`, `baseline-remaining.log`.

## Grenzen und Veröffentlichung

Der ursprüngliche iPhone-Ausfall der zwei Fahrzeugbilder ließ sich im Serverbrowser nicht nachstellen; Originale und geschützte Vorschaubilder waren lesbar. Die Verbesserung verwendet kleine berechtigungsgeprüfte Vorschauen mit nachvollziehbarer Fehleranzeige, ohne Medienrechte oder Originaldateien zu ändern.

`20261113235706_private_message_attachments.sql` ist lokal geprüft, aber noch nicht auf Produktion angewendet. Vor Veröffentlichung müssen Migration, privater Bucket, RLS, RPC-Rechte und Zugriffsfälle auf dem richtigen Supabase-Projekt verifiziert werden. Danach ausschließlich der freigegebene saubere `main`-Stand über `npm run deploy:production`; siehe `docs/design-and-release.md`. Es wurden keine echten Nachrichten versandt, öffentlichen Datensätze umgeschrieben oder privaten Originale gelöscht.

Die App-Entwicklung hat die koordinierte Übernahme bestätigt und hält parallele Website-Änderungen an. Gemeinsamer Dateivertrag und Migrationsreihenfolge sind dokumentiert. Tastatur, sichere Bildschirmränder, Dateiauswahl und Zurück-Gesten benötigen zusätzlich eine echte Geräteprüfung.
