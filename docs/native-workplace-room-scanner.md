# Nativer Arbeitsplatz: Locations und Grundrisse

Auftrag vom 14. November 2026: Der App-Bereich heißt **Arbeitsplatz** und enthält
Werkzeuge nach Abteilungen. Die erste Abteilung ist **Locations**, ihr erstes
Werkzeug sind **Grundrisse** mit einem neu entwickelten nativen Raumscanner.
Das vorgesehene reale Aufnahmegerät ist Markus' iPhone 15 Pro.

## Bedienung und Grenzen

Arbeitsplatz → Locations → Grundrisse führt zur lokalen Planübersicht. Von dort
werden ein Raum gescannt, die erkannten Wände und Maße geprüft, ein Name und
optional ein lokales Projekt-/Location-Label angegeben und der Plan gespeichert.
Ein ausdrücklich gekennzeichneter Beispielraum erlaubt die Ansicht auch im
Simulator. Dieses Beispiel darf weder in der Bibliothek noch im PDF als echte
Aufnahme erscheinen. Weitere Abteilungen werden erst mit nutzbaren Funktionen
ergänzt. Die fünf öffentlichen Links unten und der vorhandene Genie bleiben.

Die Erfassung verwendet Apples **RoomPlan** mit Kamera und LiDAR, ohne den alten
Webscanner. Vor einer Aufnahme werden OS-Version, `RoomCaptureSession.isSupported`
und Kameraberechtigung geprüft. Kamera und Sensorerfassung starten erst auf
ausdrücklichen Aufruf. Ein Simulator kann Bedienung und Geometrieverarbeitung,
aber keine tatsächliche Raumerfassung oder Messgenauigkeit nachweisen.

Wände werden anhand ihrer räumlichen Lage und Länge in die X/Z-Ebene projiziert;
Türen, Fenster und Öffnungen bleiben unterscheidbar. Ein Begrenzungsrechteck ist
keine Raumfläche. Maße sind Sensorschätzungen, kein vermessungstechnischer
Nachweis. Für wichtige Produktionsmaße ist die Kontrolle vor Ort erforderlich.

## Private Speicherung

Die erste native Fassung arbeitet **lokal auf dem Gerät und unabhängig vom
CineGenius-Konto**. Es gibt keine automatische Veröffentlichung, keinen Upload,
keine Kontosynchronisierung und kein Cloudbackup. Ein lokales Projektlabel
stellt keine Verbindung zu einem Online-Projekt her. Die private Bibliothek
erfordert die Geräteentsperrung; bei einem Hintergrundwechsel wird sie gesperrt.

Gespeicherte Pläne und vorhandene erfasste Quelldaten gehören in atomar
geschriebene, geschützte Dateien außerhalb einer öffentlichen Dateifreigabe und
werden von Gerätesicherungen ausgeschlossen. Lade- oder Schreibfehler dürfen
bestehende Daten nicht überschreiben. Löschen braucht eine ausdrückliche
Bestätigung. Export ist eine eigene Aktion und erstellt eine vom Nutzer
weitergegebene Kopie; bereits exportierte Kopien werden durch lokales Löschen
nicht zurückgerufen. Die App zu löschen entfernt auch ihre lokalen Daten.

## Native Einbindung während der Entwicklung

Die bestehende App ist weiterhin eine Debug-Vorschau, deren Webansicht die
veröffentlichte Website lädt. Die neue native Funktion ist über das eigene
Xcode-Schema **CineGenius Arbeitsplatz**, den Startparameter
`--cinegenius-workplace` und die native Schnellaktion am App-Symbol erreichbar.

Für den gewünschten Einstieg im bisherigen Menü wird **nur in dieser App**
`mobile/src/workplace-menu.js` als gebündeltes Hauptframe-Skript geladen. Es
ersetzt ausschließlich die erkannte deaktivierte KI-Zeile innerhalb
`#site-navigation-menu` durch **Arbeitsplatz / Locations**. Ohne Native-Handler,
bei unbekannter Origin, in eingebetteten Frames und bei nicht passender
Menüstruktur bleibt die Seite unverändert. Die native Seite überprüft Frame und
Origin unabhängig. Die Nachricht enthält nur Aktion und Sprachcode; keine
Scan-Daten, Dateipfade, Sitzungsinformationen oder Kamera-Erlaubnisse.

Ein Tap öffnet den nativen Bereich. `dialog.close()` nutzt das vorhandene
React-Cleanup, ohne künstliche Browser-History. Die native Schnellaktion bleibt
ein zusätzlicher Einstieg, falls eine zukünftige Website-Struktur nicht mehr
zum begrenzten Adapter passt. Dieser Adapter ist eine Übergangslösung der
Remote-Vorschau und muss beim endgültigen App-Verpackungskonzept neu bewertet
werden. Er ist keine Website-Veröffentlichung.

## Sprachen und Vorbereitung

Alle Texte kommen aus `NativeRoomScanner` in den vorhandenen neun
`messages/*.json`-Katalogen. `mobile/scripts/native-resources.mjs` erzeugt beim
üblichen `prepare:preview`:

- `www/native-room-scanner/{locale}.json` sowie die zentrale Sprachliste;
- das auf die konfigurierte Origin begrenzte `www/workplace-menu.js`;
- native `InfoPlist.strings` für Kamera- und Face-ID-Berechtigung.

Diese Dateien werden generiert; es gibt keine separat gepflegten Übersetzungen
im Swift-Code. Die bestätigte App-Sprachwahl hat Vorrang vor der Gerätesprache.
Änderungen im Web-Chat werden mit geprüftem Commit und Live-Status an diesen
App-Stand weitergegeben; native Quellen und Sprachschlüssel bleiben erhalten.

## Prüfungen

Die fünf Node-Konfigurations-/Katalogtests und die allgemeine Katalogprüfung
sichern vorhandene Origins und identische native Texte/Platzhalter ab.
`mobile/tests/workplace-menu.browser.mjs` läuft mit der bestehenden Playwright-
Werkzeugkette (`PLAYWRIGHT_MODULE` kann deren Modulpfad angeben). Es prüft die
neun Sprachen, Tastatur/Tap, Sprachwechsel, fehlende native Fähigkeiten,
Origin-Verwechslungen, Subframes und die unveränderte History.

Zusätzlich wurden die tatsächlichen öffentlichen Menüansichten bei 320 px in
neun abgemeldeten Browserkontexten mit dem App-Adapter geprüft. Dabei wurden nur
öffentliche Seiten gelesen; App-Starts wurden als Bridge-Aufrufe aufgezeichnet.
Das ersetzt keine native WKWebView-Prüfung. Der native Build, Geometrie-/Archiv-
Tests und Simulator-Ergebnisse werden im zugehörigen Mac-Prüfbericht festgehalten.
Echte LiDAR-Erfassung, Kameraerlaubnis und Messvergleich auf dem iPhone 15 Pro
bleiben bis zu einem tatsächlichen Gerätetest ausdrücklich offen.

Artefakte: `/srv/cinegenius/handoffs/20261114-native-room-scanner/`.

## Installation auf dem Test-iPhone

Markus möchte die Funktion auf seinem iPhone 15 Pro testen. Auf seine Nachfrage
zu TestFlight wurde die bestehende Mitgliedschaft geprüft; er hat ausdrücklich
bestätigt, dass noch keine Apple-Developer-Program-Mitgliedschaft besteht. Es
wird keine kostenpflichtige Anmeldung begonnen. Der aktuelle Weg bleibt die
kostenlose Geräteinstallation mit Xcodes Personal Team. Dafür sind die Anmeldung
mit der bestehenden Apple-ID in Xcode, ein verbundenes/vertrautes iPhone und
gegebenenfalls die vom iPhone verlangte Entwicklermodus-Freigabe erforderlich.
Diese persönlichen Anmeldungen/Gerätebestätigungen nimmt Markus selbst vor.

Apple begrenzt kostenlose Geräteprofile auf sieben Tage; danach muss die Test-App
erneut gebaut und installiert werden. Den Datencontainer dabei erhalten, keine
App oder gespeicherten Pläne zur Behebung von Signierproblemen löschen.
Ein künftiger TestFlight-Upload braucht eine aktive Mitgliedschaft, passende
App-Store-Connect-Rechte und eine überprüfte Release-Architektur. Die bestehende
Sperre gegen Veröffentlichung der Remote-Content-Debug-Vorschau bleibt erhalten.

[Apple: Personal Team und Gerätetests](https://developer.apple.com/help/account/basics/about-your-developer-account)

Apple-Quellen:

- [RoomPlan](https://developer.apple.com/augmented-reality/roomplan/)
- [Geräteunterstützung](https://developer.apple.com/documentation/RoomPlan/RoomCaptureSession/isSupported)
- [RoomCaptureView](https://developer.apple.com/documentation/RoomPlan/RoomCaptureView)
