# App-Quellabgleich, 18. November 2026

## Stand und Umfang

Der App-Zweig integriert den geprüften Web-Stand
`9c9c5abd53482c9e972155ea24640d951516a7c9` einschließlich `831e51d` und `b02040d`.
Ausgangspunkt war App-Commit `37b6f5ad1e1451c8d5460803aac4cf5adf9e7a67`.
Der genaue Merge-Commit steht im externen Prüfbeleg
`/srv/cinegenius/handoffs/20261118-app-web-refresh/receipt.json`.

Enthalten sind gemeinsame Kartenhinweise, die überarbeiteten Community-, Tier-,
Merkliste-, Buchungs-, Organisations- und Hilfeansichten, private Homies,
Startseitenbilder mit bis zu drei neuen Bildern unterschiedlicher Anbieter vor
der Mischung, größere Firmenlogos innerhalb derselben Kacheln und echte
Projekt-Minikarten. Öffentliche Online-Anzeigen und der Browser-PresencePing
entfallen; berufliche Verfügbarkeit und private Kontosicherheit bleiben erhalten.

Die eigene App-Prüfung fand zusätzlich einen reproduzierbaren Überlauf des langen
russischen Galerie-Links bei 320px. Die gemeinsame Aktionsgruppe kann nun
umfließen; Pause und Link behalten ihre Bedienflächen und den bisherigen Stil.

Smart aus `dcf06be` und `37b6f5a` bleibt erhalten. Die Smart-Karte übergibt ihre
öffentliche Beschreibung nun im gemeinsamen `subtitle`-Feld. Admin-Grenzen,
Sprachverständnis, Bedingungen, Pagination und Kontoprüfungen werden durch die
Übernahme nicht ersetzt. Die App-eigene Startkennung für Crew-Verlauf und die
privaten Aktivitätseinstellungen bleiben ebenfalls erhalten.

Alle 123 erfassten Dateien unter `mobile/` und die `NativeRoomScanner`-Inhalte
aller 17 Kataloge sind gegenüber dem Ausgangspunkt unverändert. Das belegt die
Erhaltung dieser Serverquellen, nicht den Abgleich noch laufender Änderungen
auf dem Mac. Dortige native Freunde-/Grundrissarbeit bei der späteren Übernahme
weiterhin separat erhalten.

## Schnittstellen, Sprache und Veröffentlichung

- Keine Produktionsschreibzugriffe, bezahlten Modellaufrufe oder Veröffentlichung.
  Dieser Web-Stand liegt auf einem Entwicklungszweig, nicht auf veröffentlichtem
  `main`. Die App-Quellübernahme installiert nichts auf dem iPhone.
- `20261117153538_randomized_discovery.sql` ist weiterhin vor einer späteren
  Freigabe koordiniert anzuwenden und zu prüfen. Ohne diese Aktivierung wird
  keine funktionierende produktive Zufallssuche behauptet.
- Homies verwendet den vorhandenen kontogebundenen
  `cinegenius.friendships.v1`-Vertrag; diese UI benötigt keine zusätzliche
  Migration. Private Merkliste und akzeptierte Kontakte bleiben getrennt.
- Alle 17 Kataloge enthalten 11.262 Schlüssel; die Sprachprüfung meldet keine
  neuen unübersetzten Quelltexte. Das ist keine vollständige inhaltliche
  Sprachabnahme aller älteren Seiten.
- Der bestehende Remote-Content-Modus verwendet weiterhin den veröffentlichten
  Web-Stand. Unveröffentlichte Smart-/API-Erweiterungen müssen gemeinsam
  freigegeben werden; siehe `docs/smart-search-foundations.md`.

## Automatisierte Prüfungen

- 353 unterschiedliche gezielte Regressionstests bestanden: 314 unveränderte
  Fälle aus dem ersten Lauf sowie 39 Fälle nach Aktualisierung dreier veralteter
  Testadapter. Die ersten 27 Fehler waren fehlende Abhängigkeiten in diesen
  Adaptern; sie sind in den ursprünglichen Logs erhalten. Tierdetail prüft
  zusätzlich, dass auch ein veröffentlichtes, aktuell verborgenes Angebot
  weiterhin 404 und `noindex` liefert.
- 37 bestehende mobile Quell-/Vertragstests bestanden. Das sind keine Swift-,
  Simulator- oder LiDAR-Laufzeittests.
- Sprach- und gemeinsame Designprüfung bestanden. Keine Merge-Marker oder
  Whitespacefehler. Geänderte TypeScript-Dateien behalten acht bereits vorhandene
  Lint-Fehler in Crew/Dashboard; vor dem Merge waren es dort zehn. Andere im
  Paket geänderte TypeScript-Dateien sind lint-fehlerfrei.
- Der vollständige Build des zusammengeführten Standes vor der abschließenden
  Galerie-Umbruchkorrektur hat Kompilierung,
  TypeScript-Prüfung und Seitenerzeugung durchlaufen, endet anschließend aber
  mit `SecurityFatalError` für das installierte Next.js 16.4.3. **Kein erfolgreicher
  Produktionsbuild.** Die Sperre wurde nicht umgangen. Die Meldung benennt keine
  konkrete CVE oder geprüfte Zielversion. Der ergänzende Paket-Audit meldet
  sieben bestehende Abhängigkeitshinweise (sechs hoch, einen mittel); kein
  vollständiger Sicherheitsreview und keine automatische Paketaktualisierung. Die abschließende reine
  Klassenänderung besteht den separaten Lint-, Sprach-, Design- und
  TypeScript-Check; der blockierte vollständige Build wird nicht als grün gemeldet.

## Browserprüfung

Die isolierte lokale Vorschau verwendet die tatsächlich zusammengeführten
App-Komponenten, den neu kompilierten Stil, die tatsächlichen Schriften sowie
`app-viewport.css` und `app-presentation.css`. Daten, Konten und Schreibantworten
sind klar gekennzeichnete Testdaten. Es gibt weder eine echte Anmeldung noch
Produktionsänderungen. Der vollständige Next-Router, Header und native Container
sind in dieser Komponentenvorschau nicht enthalten.

65 Browserfälle bestehen: sieben Galerieabläufe (Chromium 320/390/834/1440,
WebKit 320/390/834), 17 Sprachprüfungen bei 320px, drei WebKit-Bildfehlerfälle,
ein Kontowechsel, zwei Kartenabläufe, acht Community-/Merkliste-/Homies-Fälle,
15 Tier-/Firmen-/Hilfefälle, vier Projekt- und acht Organisationsdarstellungen.
Die zusätzlichen vier Wiederholungen eines WebKit-Zurück-Falls werden nicht
nochmals in diese Anzahl eingerechnet. Der Abschlussbeleg enthält die Details.

Ein früher WebKit-Zwischencheck scheiterte beim Lesen der Animationsposition nach
festen 250ms. Der abschließende Ablauf wartet auf die tatsächliche Wiederaufnahme
und zwei Zeichenzyklen, bevor er die erhaltene Position vergleicht; alle sieben
Varianten bestehen. Das ist keine Behauptung eines behobenen physischen
Gerätefehlers. Die ursprünglichen Logs bleiben erhalten.

Prüffälle umfassen Community-Ladefehler/Wiederholen, Dialog-Schließen und Wiederöffnen,
Erhalt fehlgeschlagener Eingaben, Merkliste, Homies-Stern mit bestätigter Antwort,
Kontoänderung während einer Anfrage, Bilderfehler und begrenzte Wiederholung,
Bilderleistenbewegung und echtes Browser-Zurück, reduzierte Bewegung,
Kartenhinweise und dauerhafte Vorschau, Tier-/Firmenansichten und Hilfe.

Projekt- und Organisationsansichten sind tatsächliche serverseitig gerenderte
Komponenten mit erfundenen Datensätzen. Layout, Links und natives horizontales
Scrollen werden geprüft; diese statischen Vorschauen belegen keine hydrierte
Punkt-Navigation. Andere Komponenten sind mit React interaktiv gerendert.
Browser-WebKit unter Linux ist kein iOS-WebKit-Gerätetest.

## Offene Abnahme

XcodeBuildMCP kann auf diesem Server `xcrun` nicht starten (`ENOENT`). Echte
Anmeldung, iPhone-Installation, Fingergefühl, Softwaretastatur, Safe Areas,
Vordergrundwechsel und RoomPlan-Aufnahme bleiben ungeprüft. Auch eine
vollständige angemeldete Smart-Suche gegen echte Produktionsangebote und die
Qualität des bezahlten Modells werden mit dieser Übernahme nicht behauptet.

Der tägliche Website-Prüfagent bleibt deaktiviert. Spätere Veröffentlichung,
Datenbankaktivierung und Geräteabnahme sind getrennte Schritte.
