# App-Hinweis und beweglicher Genie-Button

Stand: 14. November 2026. Websiteentwurf auf `codex/genie-launcher-controls`, ausgehend von `17e14e0`. Nicht veröffentlicht.

## Beauftragter Umfang

Markus möchte das bestehende Design behalten. Ergänzt werden ausschließlich der bestätigte App-Hinweis oberhalb der Startseitensuche sowie das Verschieben und Ausblenden des bestehenden Genie-Buttons. Farben, Typografie, Kartengrößen und Reihenfolge der Startseitenbereiche bleiben erhalten.

- Die Startseite zeigt „CineGenius bald auch als App.“ mit kleinem Symbol. Öffentliche Download-Adressen sind noch nicht bestätigt; Store-Schaltflächen folgen erst mit belegten Links.
- Genie lässt sich mit Finger oder Maus verschieben. Eine Bewegung öffnet den Chat nicht versehentlich. Antippen öffnet weiterhin den bisherigen Dialog.
- Position und Ausblenden gelten im aktuellen Dokument, auch bei Seiten- und Sprachwechsel. Ein neuer Seitenaufruf bzw. Neuladen zeigt Genie wieder. Rückkehr aus dem Browser-Seitencache und `cinegenius:app-resume` stellen einen ausgeblendeten Button ebenfalls wieder her.
- Die Position bleibt nach Größenwechseln im erreichbaren Bildschirmbereich, oberhalb der unteren Navigation. Alt und Pfeiltasten ermöglichen die Positionierung per Tastatur. Der Ausblenden-Button hat eine 44×44-Pixel-Trefffläche.
- Bewegungen werden pro Animationsbild zusammengefasst. Es gibt für Position/Ausblenden keinen neuen Speicher-, Netzwerk- oder Analyseaufruf.

## Prüfung

- Vollständiger Produktionsbuild, TypeScript, ESLint und `git diff --check` bestanden.
- `npm run check:i18n`: alle neun Kataloge, einschließlich Ankündigung und zugänglicher Bedienhinweise.
- 72 bestehende und ergänzte Genie-/Startseitenprüfungen bestanden; darunter Besuchsdauer, Sprach-/Seitenwechsel, Wiederherstellung, Bereinigung und bisherige Dialogbedienung.
- Chromium mit der lokal gebauten vollständigen Website: 320, 393, 834 und 1440 Pixel. Verschieben, normales Öffnen/Schließen, Tastaturverschiebung, Größenwechsel, Ausblenden, echte Navigation/Zurück, Neuladen und Wiederherstellungsereignisse geprüft. Keine Genie-API-Anfrage durch diese Bedienung. Zusätzlich alle neun Sprachen bei 320 Pixeln.
- Isolierte Browserprüfung der tatsächlichen Genie-Komponenten ergänzt abgebrochene Touch-Gesten und die kleine Variante auf Location-Karten. Anmeldung und Chatinhalt sind dort ausdrücklich Testgrenzen.
- Der App-Hinweis wurde auf der vollständigen Startseite in allen neun Sprachen sowie den vier Bildschirmgrößen geprüft: oberhalb der Suche, ohne Überlauf und ohne vorgetäuschte Downloadfunktion.

Artefakte: `/srv/cinegenius/audits/20261114-genie-launcher/`, insbesondere `build-final.log`, `tests.log`, `browser-results.json`, `isolated-browser-results.json` und `homepage-browser-results.json` sowie Bildschirmaufnahmen. Die vollständige Browserprüfung nutzt den lokalen Produktionsbuild; eine zunächst durch Clerk blockierte Entwicklungsvorschau war dafür nicht ausreichend. Browserprüfungen erfolgten als Gast. Die Produktionsdomain wurde im Testbrowser ausschließlich auf die lokale Vorschau umgeleitet; es gab keine Veröffentlichung.

## Native Abstimmung und Grenzen

APP Entwicklung übernimmt den Abgleich und die Prüfung in Xcode bzw. auf echten Geräten. Die native Hülle soll `window.dispatchEvent(new Event("cinegenius:app-resume"))` beim tatsächlichen erneuten Öffnen/Vordergrundwechsel auslösen, nicht bei jedem internen Seitenwechsel. Die Website lauscht bereits darauf. Ein Testereignis im Browser belegt noch keine native Anbindung.

`data-home-app-notice` kennzeichnet die Websiteankündigung für den Abgleich mit der eigenen App-Startseite. In einer bereits installierten App ist diese Ankündigung nicht erforderlich. App-eigene Navigation, Quellen, Sprachschlüssel und laufende native Funktionen bleiben bei der Übernahme erhalten.

Echte iPhone-/iPad-/Android-Geräte, Safari und Softwaretastaturen wurden in diesem Arbeitsschritt nicht getestet. Browser-Touch-Simulationen sind keine Gerätefreigabe. Die bestätigte gemeinsame Betreiberanschrift liegt im separaten, ebenfalls unveröffentlichten Rechtsentwurf `73c4fa0` auf `codex/legal-update-2026-11-14`.
