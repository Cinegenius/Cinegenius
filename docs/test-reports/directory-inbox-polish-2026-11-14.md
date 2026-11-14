# Verzeichnisse, Profilbilder und Nachrichteneingang – 14. November 2026

Status: geprüfter Websiteentwurf auf `codex/compact-result-counts`, Ausgangspunkt `1dc2486f8a325c5649b5a6704b11c165c567fc1e`. Keine Veröffentlichung und keine Datenmigration durch diese Änderung.

## Beauftragte Änderungen

- Die Ergebnisanzeige in Crew, Marktplatz/Fahrzeugen, Locations, Firmen, Jobs, Projekten, News, Filmtieren, Suche und Karten zeigt eine Zahl. Ab 1.000 wird sie kompakt, etwa `1,1k` in Deutsch. Vollständige Beschreibungen bleiben für assistive Technik verfügbar. Ein fester Platz und tabellarische Ziffern verhindern Verschiebungen beim Laden und bei wechselnden Größenordnungen. Crew-Anbieteraktionen bleiben auf schmalen Geräten in einer festen zweiten Zeile.
- Firmenkategorien verwenden die neutralen vorhandenen Oberflächenfarben. Die öffentliche Teamordnung richtet sich nach den gespeicherten öffentlichen Funktionen: Gründung/Geschäftsführung, Abteilungs-/Projektleitung, Team. Gleichrangige Mitglieder werden nach Namen sortiert. Kontobesitz und Bearbeitungsrechte bestimmen keine öffentliche Rangfolge; diese Rechte ändern sich nicht. Eine doppelte Organisationssektion entfällt.
- Die Angebotsbilder im persönlichen Profil hatten Prozentwerte nochmals mit 100 multipliziert. Ein gespeicherter Ausschnitt von 50/33 wurde dadurch zu 5000%/3300%. Der gemeinsame Profilbereich verwendet die ursprünglichen Prozentwerte und lässt Titel, Ort und Preis auf schmalen Geräten umbrechen. Originaldateien, Ausschnitte, Eigentum und Medienfreigaben bleiben unverändert.
- Chats, Mitteilungen und ihre Ladezustände teilen Titel, Navigation und Rahmenposition. Die mobilen Tastatur- und Safe-Area-Abstände sowie die vorhandenen Kontogrenzen, Lesebelege und Wiederholungsabläufe bleiben erhalten.
- Crew, Marktplatz, Firmen und Locations nutzen dieselbe kompaktere Kartenhöhe: mobil 256–352 CSS px, ab 1024 CSS px 320–480 CSS px, abhängig von der stabilen Viewporthöhe. Zoomflächen und Quellenlinks bleiben bedienbar. Die Locations-Vorschau verwendet wie die anderen Verzeichnisse ein kleines Bild neben dem Titel, damit bei der kleineren Kartenhöhe der Name sofort sichtbar ist.

## Prüfung

- Produktionsbuild einschließlich Typprüfung und `check:i18n` erfolgreich; neun Kataloge, 7.810 Schlüssel. `check:design` und `git diff --check` erfolgreich.
- 269 gezielte automatisierte Prüffälle aus zwei Testgruppen. Die zunächst fehlenden Abhängigkeiten der isolierten Locations-/Karten-Testumgebungen wurden auf die echte neue Zählerkomponente umgestellt; alle betroffenen Fälle anschließend erfolgreich nachgeprüft. Abgedeckt: Zahlen/Sprachen, öffentliche Teamfunktionen und Berechtigungen, Angebotstypen/Bildfehler, Nachrichtenzustände und Kontowechsel, Kartenfilter/Zoom, Suchziele, Marktplatz und Profilanordnung.
- Öffentliche Browserprüfung in Chromium: neun Verzeichnisse bei 320 und 1440 px; tatsächliches Firmen-Team auf beiden Breiten; beide Support-Fahrzeugbilder bei 320 und 1440 px mit HTTP 200, korrektem Ausschnitt und lesbaren Titeln. Gemeinsame Zähler/Bedienflächen in allen neun Sprachen bei 320 px; echte Firmen-Suche mit leerem Ergebnis, Zurücksetzen und Ansichtswechsel ohne Verschiebung.
- Karten auf allen vier Verzeichnissen bei 320×780, 393×852, 844×390 und 1440×900: kompakte Höhe, kein horizontaler Überlauf, Zoomflächen mindestens 44×44 px und sichtbare Quellenangaben.
- Nachrichten: 36 isolierte Browserfälle (neun Sprachen × vier Breiten) mit den tatsächlichen Seiten-/Lade-Komponenten, aktuellen Styles und einer künstlichen kontogebundenen Testumgebung. Titel und Navigation bleiben über Chats, Mitteilungen und beide Ladezustände an denselben Koordinaten; Links und Browser-Zurück funktionieren. Keine Anmeldung an einem fremden Konto und kein Nachrichtenversand.
- ESLint meldet ausschließlich bereits im unveränderten Ausgangsstand vorhandene Befunde: sechs Fehler und vier Warnungen in Crew, Firmendetail und Suche. Betroffene Ausgangsdateien wurden separat zum Vergleich geprüft. Diese Änderung führt keine weiteren Befunde ein.

## Grenzen und App-Übergabe

Diese Prüfungen sind keine echten iPhone-/Android-/Xcode-Prüfungen. WebKit konnte auf diesem Server wegen fehlender Laufzeitbibliotheken nicht gestartet werden; seine geplanten Fälle gelten ausdrücklich als nicht durchgeführt. Die Nachrichtenansicht wurde mit isolierter Konto-Testumgebung geprüft, nicht mit einem echten angemeldeten Nutzer im Browser.

WEB CODEX übergibt den geprüften Commit und diesen Bericht an APP Entwicklung. Dort werden Xcode/WKWebView, Softwaretastatur, sichere Bildschirmränder und App-Zurück-Navigation geprüft. Das stabile `#site-navigation-menu` und die bisherige Herkunftsprüfung des App-Menüadapters bleiben unberührt. Native Quellen, der Arbeitsplatz/Grundrisse/RoomPlan-Bereich und die dort ergänzten Sprachschlüssel dürfen bei der Übernahme nicht überschrieben werden.

Keine neuen Schnittstellen, Datenfelder, Anbieter, Berechtigungen, Cookies, Tracking- oder Speicherzwecke. Für diese Darstellungsänderungen ergibt sich kein neuer Rechtstextinhalt. Der separate, noch nicht veröffentlichte Rechtstextentwurf ist kein Bestandteil dieses Pakets.

Ausführliche lokale Prüfbelege: `/srv/cinegenius/audits/20261114-directory-polish/`. Die dortigen Nutzeransichten und Videos werden nicht ins Repository aufgenommen.
