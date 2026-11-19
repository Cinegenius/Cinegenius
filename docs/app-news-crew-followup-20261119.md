# App: faire Crew-Entdeckung, vollständige Fotos und News-Struktur

Status: vorbereitet auf `codex/app-smart-colors-20261119`, keine Veröffentlichung dieser Folgearbeit. Die frühere Freigabe ist verbraucht. Aktuelle veröffentlichte Quellenbasis ist `e18e666a1041d7170919e092c774c2eafbaf5dfc` (WEB CODEX bestätigt, Deployment `dpl_4Q4J2pnXASpjox6nRjrLh7Wy6FzK`). Deren Gast-Sprachwahl wird erhalten. Keine Migration, kein Provideraufruf, keine Aktivierung von Shots/Push und kein Produktionsschreibzugriff durch diese Folgearbeit.

## Verhalten und Ursachen

- Smart → Alle verwendete für Crew eine feste Reihenfolge nach `user_id`. Es gab dort keinen expliziten Eigentümerbonus. Der neue native Aufruf mischt alle aktuell berechtigten Crew-Profile deterministisch mit einer zufälligen Kennung pro Verlaufseintrag. Keine Auswahl nur aus den ersten zwölf Datensätzen. Keine unbeabsichtigte Bevorzugung des angemeldeten Kontos.
- Beide App-Styles überschrieben die vollständige Bilddarstellung der Crew-Karte mit `object-fit: cover`. Crew/Creator-Fotos verwenden jetzt vollständige Darstellung in einem quadratischen Bildbereich. Zwei Spalten bleiben möglich; kleinere Karten allein würden den Beschnitt nicht beheben. Gespeicherte Bilddaten, Bildrechte und Fokuspunkte bleiben unverändert.
- Ein gemeinsamer Satz App-Farbwerte gilt für Bereichsauswahl, Gruppensymbol, Kartenkennzeichen und Kartenpunkte: Koralle/Gold/Lime/Blau/Violett. Helles Theme nutzt dunklere lesbare Varianten. Die gewöhnlichen Website-Farben bleiben erhalten.
- Die globale Suchfokussierung zeigte einen abgeschnittenen dicken Schatten. In der App zeigt nun ein dünner, vollständig sichtbarer Rahmen um die Eingabezeile den Tastaturfokus. Übrige Eingaben und die Website behalten ihre Behandlung.
- News enthält zwei direkte Abschnitte: Beiträge und Organisationen. Der doppelte Organisationspunkt im App-Menü entfällt; `/organizations` und Detail-URLs bleiben verfügbar und aktivieren unten News. Die Organisations-Logo-Reihe über News wird durch diesen Abschnittswechsel ersetzt; dadurch entfällt ein zusätzlicher Organisationsabruf auf News.
- Organisationen: Name suchen, Land und Stadt wählen, Liste oder Karte mit Liste, echte Seitenlinks. Freigegebene Organisationen werden vor der Begrenzung gefiltert und exakt gezählt. Stadtoptionen stammen aus dem vollständigen freigegebenen Länderbestand, in schmalen Datenbankseiten gelesen. Gleichnamige nicht bestätigte Orte verschiedener Länder bleiben getrennt. Unbekannte Kartenpositionen bleiben in der Liste; die Anzeige benennt ausdrücklich den Umfang der geladenen Seite. Kein Erfassen exakter Adressen.
- Bei 320px versteckte die bisherige kompakte Leiste den zweiten Filter. Die Organisationsleiste erhält beide kompakten Ortsfilter zusammen mit den zwei Ansichten. Andere Leisten behalten ihr bisheriges Verhalten.
- Zusätzlich war `view: "list"` beim Such-Nachladen trotz bestehender Clientverwendung nicht akzeptiert. Der Dienst akzeptiert jetzt den expliziten Listenmodus.

## Schnittstellen und Sicherheit

`GET /api/native/v1/discovery` akzeptiert optional `seed` mit genau 32 kleinen Hexzeichen und spiegelt ihn in der Antwort. Bestehende Header, frische Konto-/Sitzungsprüfung und die Smart-Adminprüfung bleiben erforderlich. Ohne Seed bleibt das bisherige Verhalten bestehen. Ein Seed ist nur eine Darstellungsreihenfolge, keine Berechtigung.

`POST /api/search/unified` akzeptiert optional `discoverySeed` ausschließlich mit dem unveränderten generischen nativen Discovery-Plan. Crew-Gruppen können `discoveryCursor: { key, id }` liefern; der Client schickt ihn als `cursor.discovery` zurück. Andere Suchpläne, Anforderungen, Rangfolgen, Berechtigungen und Kartenprivatsphäre werden nicht gelockert. Normale Website- und ältere Clientaufrufe ohne Seed behalten ihre Reihenfolge.

Die Auswahl verwendet SHA-256 über Seed und Profilkennung nach der aktuellen Sichtbarkeitsprüfung. Nur eine Seite plus Vorschau wird gehalten; für jede Crew-Seite wird der vollständige zulässige Bestand geprüft. Das erhält Privatsphäre und faire Auswahl, erfordert bei großen Beständen aber reale Leistungsprüfung. Das vorhandene 20-Sekunden-Zeitlimit bleibt wirksam; ein Abbruch wird als Fehler mit Wiederholungsweg behandelt, nicht als leere Trefferliste. Kein kontenübergreifender Ergebnis-/Berechtigungscache.

Der Seed wird über den bestehenden kontogebundenen `useViewState` auf dem echten Verlaufseintrag erhalten. Kein künstlicher Zurück-Eintrag; keine Sitzung oder Antwortdaten im Verlauf. Der Client verwirft fremde Konten, veraltete Anfragen und unpassende Seeds. Detail/Back, Sprachwechsel, Fokuswechsel und Retry behalten die Reihenfolge.

Organisationsfilter verwenden echte URLs mit `country`, `city`, `q`, `page`. Suchname wird als gebundener Datenbankwert behandelt. Es werden ausschließlich freigegebene öffentliche Organisationsinformationen gelesen. Originalnamen werden nicht übersetzt. Organisationskarte und Liste verwenden dieselbe geladene Seite, einschließlich Einträgen ohne Koordinaten. Kartenpunkte sind ungefähre Ortsmitten, keine Adressen und keine Tätigkeitsregionen. Der gemeinsame Kartenbaustein behält seinen bestehenden Wiederholungsweg.

## Sprachen und Prüfungen

Neue Oberflächentexte stehen in `NativeOrganizations` aller 17 Kataloge, weitere Beschriftungen verwenden bestehende gemeinsame Schlüssel. Keine Änderung an `NativeRoomScanner`, keine neue Übersetzungsarchitektur.

- 66 Tests für Discovery, echte gesamte Kandidatenmenge mit 241 synthetischen Profilen, Privat-/Ghost-Ausschluss, stabile vollständige Pagination ohne Doppelungen, Kartenreihenfolge, Rechtewechsel, ungültige Parameter, Ausfälle, Race-Handling und alle Sprachkataloge der Smart-Einstiegsansicht: bestanden.
- 66 weitere zielgerichtete Tests für Organisationsabfragen/Facetten, Länderbedienung, News, App-Navigation, Verlauf und gemeinsame Karten-/Ergebnisdarstellung: bestanden. Die Testdaten sind synthetisch; dies ist kein Produktionslasttest.
- 8 Chromium/WebKit-Komponentenfälle für Smart-Farben, vollständige Hoch-/Querformat-Testbilder, Tastaturfokus und globale Suche: bestanden, 320/393px, beide Theme-Varianten, alle 17 Sprachen. Website ohne exakten App-Marker und unabhängiges Eingabefeld zusätzlich geprüft.
- 10 Chromium/WebKit-Komponentenfälle für Organisationen und echten Smart-Einstiegsbaustein: bestanden. Land/Stadt, Tastaturauswahl, Karte mit Liste einschließlich unbekannter Position, echte Browser-Zurück-Navigation, Suche, Seitenlinks, Sprachwechsel, Retry und Kontowechsel geprüft. Organisatorische und API-Daten, Clerk, Router/RSC und Kartenrenderer sind kontrollierte Test-Fixtures; das ist keine echte Anmeldung oder Karten-Netzprüfung. Theme-Werte kommen aus dem Test-Fixture, da der aktuelle native Theme-Rücklauf fehlt.
- `check:i18n`: 17 Kataloge, 11189 Schlüssel, keine neuen ungeprüften Textliterale. Geänderte TypeScript-Dateien: ESLint ohne Fehler; eine bereits bestehende Warnung zur unbenutzten Variable `uiText` in der Organisationsdetailseite bleibt. TypeScript-Prüfung mit 4 GiB Heap bestanden; der erste Versuch mit Standardlimit scheiterte am Speicherlimit.

Der vollständige Build auf `e11a92d81ecb742d510e12948826667ccb237691` bestand mit Exit 0 in 84,32 Sekunden, einschließlich TypeScript und 162 statischen Seiten. Die Umgebung enthält keine Produktions-Datenbankzugänge; zwei bestehende Build-Abfragen melden deshalb fehlende Supabase-Konfiguration. Das ist kein Datenbank-/Anmeldetest. Der erste Build erreichte ebenfalls die Routentabelle, endete jedoch mit Status 143; der dokumentierte Wiederholungslauf hat einen explizit aufgezeichneten Exit 0. Nach dem erfolgreichen Build wurden ausschließlich Test und Dokumentation ergänzt.

Build-Ergebnis und endgültiger Commit stehen im Übergabebeleg unter `/srv/cinegenius/handoffs/20261119-app-smart-colors/receipt.json`.

## Noch ausdrücklich offen

Aktuelle Swift-/Xcode-Quellen wurden nicht ersetzt. Kein neuer Xcode-Build, keine iPhone-Installation, keine echte Anmeldung, Softwaretastatur oder Gerätegeste auf iPhone 15 Pro durch diesen Serverlauf. Die vollständige native Integration und deren Theme-Regeln benötigen den aktuellen Mac-Rücklauf und einen Gerätetest. Bildtests verwenden vollständige synthetische Fotos, keine Veränderung realer Mitgliedermedien. Echte Datenbank-/Netzlaufzeiten der vollständigen Crew-Auswahl sind vor einer Veröffentlichung zu messen. Die pausierte allgemeine Smart-Verständnisarbeit bleibt pausiert.
