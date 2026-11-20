# Kompakte Kartenvorschau · App-Abgleich vom 20. November 2026

Beim Antippen eines Smart-Kartenpunkts spannte sich die Vorschau auf kleinen
Bildschirmen fast über die gesamte Kartenhöhe. Eine zusätzliche leere Kopfzeile
vergrößerte den Abstand zum Eintrag. Die Vorschau richtet ihre Höhe jetzt nach
dem Inhalt; Kategorie und Schließen teilen die Kopfzeile. Lange Inhalte bleiben
innerhalb einer begrenzten Vorschau scrollbar.

## Quelle und Übernahme

- WEB-Vorgabe: `acd306e395db9e1c71664c71a8fb283bef0cfbee`.
- APP-Basis: `8072645238f69aaae263a53ed4ca793eae62cf61`, einschließlich der zuvor
  abgeschlossenen Crew-Anbieter-Zählerkorrektur.
- Geprüfter Produktcommit: `37f234a4` auf
  `codex/app-compact-map-preview-20261120`.
- Übernommen wurden ausschließlich zwei Darstellungsänderungen in
  `app/globals.css` und `components/SmartSearchMap.tsx`. Keine Änderung an
  Schnittstellen, gespeicherten Daten oder Sprachtexten.
- Native Farben, umbrochene Texte, Portraitdarstellung, Zähler und „Alle anzeigen“
  bleiben erhalten. Rechte und Admin-Zugang wurden nicht geändert. Die separat
  gesicherte Homepage-Rotation `0c5e63fd` ist nicht Bestandteil dieses Zweigs.

## Prüfung

| Prüfung | Ergebnis und Umfang |
| --- | --- |
| Browserabläufe | 30 Fälle bestanden: Chromium und WebKit, 320/393/834/1366 CSS px, Deutsch/Spanisch/Ungarisch/Französisch. Davon 28 mit App-Darstellungskennung und zwei gewöhnliche Web-Ansichten. |
| Tatsächliche Bausteine | SmartSearchMap, LocationMap, ResultCard und Leaflet-Punkte/Cluster; Auswahl, Schließen, Wiederöffnen, Detailnavigation, Überlappung, 44px-Bedienflächen und Höhenbegrenzung geprüft. |
| Vergleichbare Ansichten | Smart: Crew, Marktplatz, Locations, Firmen; zusätzlich Verzeichniskarten für Crew/Marktplatz/Firmen und die eigenständige Locations-Karte. |
| Lange Texte | Zwei zusätzliche Chromium-/WebKit-Fälle mit simuliertem Antippen von Punkt und Schließen sowie tatsächlicher Mausradbedienung des scrollbaren Inhalts bestanden. Kein Nachweis einer physischen Fingergeste. |
| Darstellungsmaße | Kurze native Smart-Vorschauen 120–129px hoch, abhängig vom Textumbruch. Lange Fälle bei 393px auf 162px begrenzt und scrollbar. Keine künstliche feste Höhe auf Kosten des Texts. |
| Regression | 68 Karten-, Lebenszyklus- und Zählertests bestanden. |
| Sprachen/Design/Lint | 17 Kataloge mit 11211 Schlüsseln, keine neuen Texte; Designprüfung bestanden; SmartSearchMap ohne Lint-Fehler oder -Warnungen. |
| Sichtprüfung | WebKit-Screenshots bei 320px und mit sehr langem Inhalt bei 393px kontrolliert. |

Die Browserfälle verwenden tatsächliche Komponenten mit ausdrücklich künstlichen
Testdaten und lokaler Ersatzkarte. Anmeldung, Übersetzungsversorgung, Link- und
Medientransport sind in der Testumgebung ersetzt. Es gab keinen Test mit einem
echten Konto, Produktionsdaten, externen Kartenkacheln oder dem installierten
iPhone-Paket. Kein neuer vollständiger Produktionsbuild oder separater
TypeScript-Lauf für diese reine CSS-/Klassenkorrektur; frühere Buildbelege gehören
zu ihren jeweiligen Quellständen.

## Übergabe und Veröffentlichung

Prüfbelege, Screenshots, Erhaltungsprüfung und endgültige Commit-IDs:
`/srv/cinegenius/handoffs/20261120-app-compact-map-preview/receipt.json`.

Nur den geprüften Zwei-Dateien-Produktdelta in den neueren lokalen App-Stand
übernehmen; weder den gesamten abweichenden Zweig noch ältere native Quellen
übertragen. Die eingefrorene UI-Folgearbeit `4327fc6` bleibt unverändert.
**Nicht veröffentlicht, nicht neu auf einem Gerät installiert.** Der App-Release
bleibt wegen der separat bearbeiteten Smart-/Work-Hänger angehalten. Die
[gemeinsamen Prioritäten](AKTUELLE-AUFTRAEGE.md) und die
[App-Übersicht](CINEGENIUS-APP-UEBERSICHT.md) führen die weitere Arbeit.
