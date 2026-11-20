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
