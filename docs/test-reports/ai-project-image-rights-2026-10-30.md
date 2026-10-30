# KI-Hinweis und Projektbildrechte · 30.10.2026

## Umfang und Ursache

Der Betreiber hat `/hero-bg.jpg` ausdrücklich als KI-generiert bestätigt. Bisher fehlte dafür ein sichtbarer Bildhinweis. Die Kennzeichnung ist eine exakte Liste bestätigter Websiteassets, keine automatische Erkennung und keine Kennzeichnung von Mitgliederbildern. Startseite und Schwarzes Brett verwenden dasselbe Asset und denselben Hinweis. Der Footer erklärt die KI-Unterstützung bei der Entwicklung; `/ki-transparenz` trennt Entwicklung, Gestaltung und Mitgliederinhalte.

Projektposter und Projektfotos wurden bisher direkt aus `poster_url`/`images` ausgegeben, ohne dokumentierte Nutzungserlaubnis. Die gemeinsame Projektion `publicProjectMedia` entfernt diese URLs aus öffentlichen Listen, Detaildaten, Metadaten und verknüpften Filmografien, bis der aktuelle Projektverantwortliche die Grundlage für die konkreten URLs bestätigt. Projekttexte, IDs, Mitwirkende und Originaldateien bleiben bestehen. Private Eigentümerentwürfe behalten die ursprünglichen Daten.

## Umsetzung

- `lib/site-image-provenance.ts`, `AiDisclosureBadge`, Footer, Startseite, Community und neue Informationsseite: kleine statische Hinweise, keine zusätzliche Animation oder Bildanalyse.
- `lib/project-media-rights.ts`: Nutzungsgrundlage, Rechteinhaber, Referenz und optionaler öffentlicher Bildnachweis; bestätigende Konto-ID und Zeitpunkt werden ausschließlich serverseitig gesetzt. Eine andere URL oder geänderte Eigentümerschaft übernimmt die alte Bestätigung nicht.
- Bestehende private Projektvorschau: Angaben vor Veröffentlichung, private Zwischenspeicherung über den vorhandenen Entwurfswriter und Verlassensschutz. Keine Bestätigung erforderlich, wenn kein Bild angegeben ist.
- Öffentliche Projektseiten, Kategorie-/Gesamtlisten, API, Filmografien und OpenGraph nutzen dieselbe Projektion. Private Rechtehinweise werden nicht öffentlich ausgeliefert.
- `/bildrechte` und Footer: Hinweise und Meldeweg an die vom Betreiber vorgegebene Adresse. Keine Änderung der verbindlichen AGB und keine automatische Übernahme fremder Bilder.
- Alle neuen Texte in de/en/es/it/cs/hu; beide Informationsrouten exakt öffentlich freigegeben, benachbarte geschützte Routen bleiben geschützt.

## Tatsächlich ausgeführte Prüfungen

- 59 gezielte automatisierte Tests bestanden: bestätigte Assetherkunft, sechs Sprachfassungen, bestehende Footer-/Navigationsregeln, fortbestehendes Homepage-Streaming, Projektdatenprojektion, nicht bestätigte/ausgetauschte URLs, Rechtevalidierung vor öffentlichem Schreiben, Projekte ohne Bild und verweigerte fremde Veröffentlichung.
- PGlite-Datenbanktests: Originaldateizugriff für Eigentümer, verweigerter Gast-/Fremdzugriff ohne Bestätigung, erlaubter Zugriff auf bestätigte URLs, Entzug bei geändertem Eigentümer/URL sowie bestehende Privatheits-, Blockierungs- und Firmenregeln.
- Produktionsbuild, Katalogprüfung (1884 Schlüssel), gezieltes ESLint und gemeinsame Designprüfung erfolgreich.
- Isolierte Browservorschau mit den tatsächlichen neuen Komponenten, ausschließlich erfundenen Testangaben: Rechteauswahl, ausgeblendete Quellenfrage bei eigenen Rechten, Rücksetzen der Bestätigung bei geänderter Grundlage, KI-Bildlink, Informationsseite und korrekter Meldekontakt. Kein horizontaler Überlauf bei 390×844 und 1366×900 in allen sechs Sprachen. Dies sind Browser-Simulationen, keine physischen iPhone-/Androidtests.
- `20261030170000_project_media_rights.sql` in CineGenius main PRODUCTION ausgeführt. Transaktion verglich vor/nach dem Schritt die vollständigen Projekt-Fingerprints: alle 25 Datensätze unverändert. Ergebnis: `unconfirmed_withheld=true`, `confirmed_allowed=true`, `client_execute_denied=true`. Kein öffentliches Original gelöscht oder verändert.

## Grenzen

Eine Selbsterklärung ist kein juristischer Nachweis und ersetzt keine tatsächlichen Nutzungsrechte. Eine IMDb-URL oder ein Download allein genügt nicht. Bestehende externe oder alte öffentliche Storage-Adressen bleiben beim jeweiligen Speicherbetreiber erreichbar; diese Änderung entfernt ihre Anzeige und öffentliche Datenprojektion auf CineGenius. Bereits heruntergeladene oder anderweitig zwischengespeicherte Kopien können nicht zurückgerufen werden. Geschützte `/api/media`-Dateien werden bei jedem Abruf anhand der aktuellen Rechte geprüft.

Es wurden keine echten Mitglieder angeschrieben, keine fremden Projekte bearbeitet und keine vollständige reale Registrierung/Veröffentlichung unter einem fremden Konto getestet. Der vorhandene vorübergehend deaktivierte Projektposter-Dateiupload wurde durch diese Korrektur nicht neu aufgebaut. Die Rechteabfrage gilt für die im bestehenden Entwurf gespeicherten Projektbilder und Bildadressen.
