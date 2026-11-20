# Website-Freigabe · 20. November 2026

Markus hat nach der geprüften Übergabe ausdrücklich „stell live“ beauftragt.
Freigegeben ist der Produktstand `f490b47c80d030aa2078b630b9acdb31fbf5519f`:

- konsistente gefilterte Crew-Gesamtzahl,
- kompakte Karten-Vorschaufenster ohne gestreckte Leerfläche,
- neue Crew einen Tag bevorzugt, danach wechselnde Auswahl,
- regionale Inhalte zuerst; ausdrückliche Orts-/Länder-/Alle-Wahl bleibt maßgeblich.

162 gezielte Tests und 32 Chromium-/WebKit-Prüffälle für Regionalisierung bestanden.
Vorherige Zähler- und Popup-Prüfungen sind in ihren Einzelbelegen dokumentiert.
17 Sprachkataloge, Designprüfung, Typprüfung und vollständiger Produktionsbuild
bestanden. Keine neue Datenbankmigration, keine Änderung privater Inhalte oder
Veröffentlichungsrechte. Bestehende Lint-Befunde nicht als behoben ausgegeben.

Die Browserprüfungen verwendeten kontrollierte Beispieldaten. Echte native
Geräte-/Regionsprüfungen stehen aus. Der neue native App-Stand, Mehrwährungen,
Länderfeedback und redaktionelle Veröffentlichungen gehören nicht zum Release.

Die abschließende App-Nachricht scheiterte am Chat-Transport. Vollständige Übergabe:
`/srv/cinegenius/handoffs/20261120-country-first/APP-HANDOFF.md`.

Der Livegang erfolgt ausschließlich über `npm run deploy:production` von sauberem
`main` gleich `origin/main`. Tatsächliches Deployment und nachfolgende Liveprüfungen:
`/srv/cinegenius/handoffs/20261120-country-first-release/receipt.json`.
Ein Freigabeauftrag ist noch kein Nachweis einer erfolgreichen Veröffentlichung.

## Korrektur aus der Live-Prüfung

Die erste Veröffentlichung `5d4aadba` zeigte, dass der bestehende Proxy den
neuen Gastabruf von `/api/browse-preference` noch mit 401 sperrte. Die genaue
Route wird deshalb wie andere öffentliche Lese-APIs freigegeben. Mutationen,
Unterpfade, private Kontoendpunkte und Herkunftsprüfung behalten ihre Schutzregeln.
Ein neuer Regressionstest reproduzierte den Fehler vor der Korrektur; danach
bestanden alle 25 zugehörigen Proxy-/Zugriffs-/Regionsprüfungen.


## Randpin aus der Live-Prüfung

`4d93523a` wurde erfolgreich veröffentlicht. Regionale Gastpräferenz liefert
200 mit privatem No-Store; Privatrouten bleiben geschützt. Die vier öffentlichen
Verzeichnisse zeigen rechnerisch konsistente Summen. Ein tatsächlicher normaler
Klick auf einen Randpin in Firmen/Crew löste Leaflets Fokus-Autopan aus und
schloss die Vorschau. Ein Klick ohne Fokus verdeckte den Fehler.

Die Korrektur erhält die ausgewählte Einzelvorschau, solange ihr aktueller Punkt
im Ausschnitt liegt. Außerhalb liegende Punkte und Cluster-Auswahlen werden
weiter geschlossen. Keyboard-Fokus/Auto-Pan bleiben verfügbar. Neuer Test vor
der Korrektur reproduziert genau das unerwünschte Schließen; danach bestehen
43 Karten-/Lebenszyklus-/Zähltests und die gezielte ESLint-/Designprüfung.
Die zusätzliche Browserprüfung verwendet echtes Leaflet, Fokus und Panning
mit synthetischen Daten; Ergebnisdateien liegen im Release-Verzeichnis.
Abschließende Live-Abnahme und Deployment-ID stehen ausschließlich im Receipt.

32 zusätzliche Chromium-/WebKit-Fälle bestanden, darunter sechs echte Randpin-
Fokus-/Pan-Prüfungen, alle vier Vorschautypen, 320–1366 CSS px, lange Texte,
Cluster-Auswahl, Schließen/Wiederöffnen und Profil-/Angebotslink. Testdaten und
ersetzte Basiskarte; kein nativer Gerätetest.
