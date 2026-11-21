# App-Abgleich: Währungen, Mitgestalten und Cache-Schutz

Stand: 21. November 2026. Die Website/API ist als
`ab74924dd659454d1d0746c535c514c70251e62a` veröffentlicht, Deployment
`dpl_BuCRJ3WyFFrfnKjSYfoKP9t1MBz3` READY. Geprüfte WEB-Dokumentation:
`5649d3c4d7a77a11472b1b0dd78b74166faee385`. Release-Beleg:
`/srv/cinegenius/handoffs/20261121-international-release/receipt.json`.

## Was hier tatsächlich übernommen wurde

Der veröffentlichte [Währungs-/Feedback-Vertrag](international-currency-feedback.md)
und die Statusangaben in beiden bestehenden Übersichten sind abgeglichen. Die
ebenfalls bereits veröffentlichte Länderpräferenz ist unter
[Länderpriorisierung](country-first-discovery.md) festgehalten; ihre native
Geräteabnahme bleibt offen.

Der kleine Produktfix aus `ab74924d` ist separat in den vorbereiteten App-Zweig
übernommen (App-Produktcommit `67cc599dfcd3c531d03f18f5dff3de94916d8a5b`):
alle lokalisierten frühen Auth-, Origin- und Kontingentfehler des
Proxy setzen `Cache-Control: private, no-store, max-age=0`,
`CDN-Cache-Control: no-store` und `Vercel-CDN-Cache-Control: no-store`.
Bestehende Berechtigungen, Herkunftsprüfung, Kontingente, manuelle Sprache und
native Gesprächswege bleiben erhalten.
Bei einer Integration ausschließlich diesen kleinen Header-Delta übernehmen;
keinesfalls die ältere `proxy.ts` über den aktuellen Hauptstand kopieren. Dessen
neuere öffentliche Länderabfrage und Redaktionszugangsregeln müssen erhalten bleiben.

Die 37 gezielten Proxy-Regressionstests bestehen mit allen 17 Sprachen, darunter
401/403/429, abweichende Herkunft, gemeinsames Web-/Native-Kontingent und
Feedback-Zugangsschranken. Lint: keine Fehler oder Warnungen. Die Tests führen
den tatsächlichen Proxy mit ersetzten Auth-/Antworttransporten aus. Sie prüfen
nicht die Feedback-Handler oder einen echten angemeldeten App-Ablauf.
Keine geänderten Sprachtexte; alle Kataloge bleiben bytegleich zur App-Basis.
Für diesen begrenzten Header-Fix kein erneuter Gesamtbuild oder Browserlauf.

## Noch erforderlicher funktionaler App-Abgleich

Die untersuchte App-Basis `77ed339a` ist älter als das neue Website-Paket. Sie
darf den veröffentlichten Serverstand nicht ersetzen. Insbesondere wurde die
100-Dateien-Funktionserweiterung nicht pauschal auf diesen alten Zweig kopiert.
Die gemeinsamen Web-Seiten nutzen bereits den Live-Vertrag; daraus folgt keine
Abnahme nativer Anzeigen, Editoren oder einer installierten App-Version.

| Bereich | Befund in den vorbereiteten App-Quellen | Vertrag für die spätere Integration |
| --- | --- | --- |
| Preishelfer und Suchkarten | `lib/listing-price.ts` formatiert noch mit festen Euro-Zeichen; strukturierte Angebote setzen EUR. SearchResultCard verwendet vorzugsweise den gelieferten `priceLabel`. | Aktuelle gemeinsame Currency-/Preishelfer und vollständige öffentliche Projektionen erhalten. `metadata.price_currency`, `crew.price_currency`, Equipment-`currency` verwenden. Keine Umrechnung oder EUR-Ersetzung vorhandener Codes. |
| Formulare, Filter, Wiederherstellung | Gemeinsame ältere Editoren/Listen sind noch nicht mit dem neuen Paket abgeglichen. | Gleiche gespeicherte Währung in Erstellen/Bearbeiten/Entwurf und Anzeige. Preisgrenzen/Sortierung nur innerhalb der gewählten Währung; gewöhnliche Listen behalten alle Währungen. |
| Buchungen | Checkout enthält feste EUR-Anzeigen; ältere Buchungsroute speichert noch keinen Währungssnapshot. | Aktuellen erlaubten Preis per API lesen, erwarteten Preis/Währung mitgeben, bei 409 erneut bestätigen lassen. Termine/Notizen behalten. Bestehende Anfragen verwenden `bookings.currency`. |
| Mitgestalten | Neue Feedback-Seiten/-Handler sind in dieser älteren App-Basis nicht vorhanden. | Gemeinsame Live-Routen verwenden: eigener privater Entwurf/Konto, bestätigter Bericht mit stabilem UUID-Schlüssel; Admin nur abgeschlossene Berichte. Länder-/Sprachlinks verleihen keine Rechte. |
| Native Quellen | Der hier vorhandene ältere `mobile/`-Preview lädt die Website; er ist kein Nachweis des aktuellen lokalen Swift-/Work-Builds. | Aktuelle lokale Xcode-Quellen erhalten und die tatsächlich installierten Ansichten prüfen. Keine älteren Swift-Dateien darüberkopieren. |

Die Migration `20261120194027_booking_currency_snapshot.sql` ist **bereits
produktiv angewandt und unabhängig nachgelesen**. Bestehende Beträge, RLS und ACL
blieben laut Release-Beleg erhalten. Hier wurde sie weder erneut angewandt noch
als ausstehende Migration eingestuft.

Für die nächste Geräteabnahme: EUR/MXN/CHF/HUF/USD ohne Umrechnung, Altpreise ohne
Code als EUR, Währungswechsel im privaten Entwurf, Preis-/Währungskonflikt vor
Buchungsbestätigung, Kontowechsel und verworfene veraltete Antworten, Fehler und
Wiederholung in Mitgestalten, manuelle Sprache und echte Zurück-Navigation prüfen.
Keine echte Buchung, KI-Anfrage, Nachricht oder Einladung wurde hier ausgelöst.

## Grenzen und Übergabe

WEB meldet 176 Ausgangstests und 52 überlappende Folgeprüfungen; diese Zahlen
werden nicht addiert. WEB-Build, vier kontrollierte Feedback-Browserfälle und
vier öffentliche Livekonfigurationen bleiben getrennte Belege. Echte angemeldete
KI-/Versandabnahme und native Geräteprüfung stehen weiterhin aus.

App-Prüfbeleg, geprüfte Commit-IDs und Erhaltungsnachweis:
`/srv/cinegenius/handoffs/20261121-app-international-handoff/receipt.json`.
Die laufende Abstimmung erfolgt über WEB CODEX zur lokalen App-Arbeit.
**Kein App-Livegang, keine Installation; Smart-/Work-Halt bleibt bestehen.**
Push, Shots-Aktivierung und täglicher Website-Prüfagent bleiben unverändert aus.
