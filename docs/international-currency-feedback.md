# Internationale Preise und Ländervertreter-Feedback

Stand: 21.11.2026. Markus hat die Veröffentlichung beider Website-Funktionen mit
„dann stell live“ ausdrücklich freigegeben. Das Paket ist auf dem aktuellen
Hauptstand mit den veröffentlichten Newsfotos als `ab74924d` veröffentlicht. Der tatsächliche
Veröffentlichungs- und Live-Prüfbeleg liegt unter
`/srv/cinegenius/handoffs/20261121-international-release/receipt.json`.
Die bereits veröffentlichte Länderpriorisierung und CineGenius Redaktion bleiben
unverändert. Native Smart-/Work-Freigabe bleibt zurückgehalten.

## Preise und Währungen

- Anbieter wählen die Währung ausdrücklich in den bestehenden Formularen. Der
  Katalog enthält 155 aktuelle Umlaufwährungen nach SIX/ISO 4217 (17.09.2026),
  darunter EUR, MXN, CHF, HUF und USD. Sichtbare Namen folgen der gewählten Sprache.
- `lib/currency.ts` und `CurrencySelect` sind die gemeinsame Grundlage. Keine
  Umrechnung; Sprache, Land und Währung sind unabhängig. Fehlende alte Codes
  bedeuten weiterhin EUR. Bereits gespeicherte zurückgezogene Währungen bleiben
  lesbar und werden nicht still in EUR geändert.
- Angebote: `metadata.price_currency`; Firmen-Equipment: bestehendes `currency`;
  persönliche Crew-Gage: `crew.price_currency` zum bisherigen `day_rate`.
  Öffentliche Projektionen geben ausschließlich dieses zusätzliche Preisfeld aus.
- Erstellen, Bearbeiten, private Wiederherstellung und Onboarding für bestehende
  Angebote, öffentliche Karten,
  Detailseiten, Jobs, Merkliste und Suche verwenden dieselben Preishelfer.
- Marktplatz und Locations haben einen Währungsfilter. Preis-Sortierung und
  Preisgrenzen vergleichen nur dieselbe Währung. Ohne ausgewählte Währung startet
  Preis-Sortierung in EUR; der aktive Filter ist sichtbar und entfernbar. Filter
  sind in geteilten URLs enthalten. Normales Durchsehen zeigt alle Währungen.
- Buchungsanfragen laden Preis und Währung vom aktuell berechtigten Angebot,
  nicht aus der URL. Abweichungen vor dem Absenden liefern 409 und benötigen
  erneute Bestätigung. Notizen und Termine bleiben erhalten.
- `bookings.currency` speichert die Währung zum Anfragezeitpunkt. Spätere Änderungen
  am Angebot ändern bestehende Anfragen nicht. Anzeige in Bestätigung, persönlichem
  Bereich und Admin verwendet diesen Snapshot. Es wird keine Zahlungsabwicklung
  eingeschaltet.
- Profil-Gagen verwenden die bestehende Ganzzahlspalte. Keine stillschweigende
  Kürzung von Dezimalbeträgen; nicht passende Eingaben werden zurückgewiesen.

**Produktionsmigration am 21.11.2026 angewandt und unabhängig nachgelesen:**
`20261120194027_booking_currency_snapshot.sql`. Die Migration
fügt nur die Währung mit EUR als historischem Standard hinzu; Beträge, Zugriffsrechte
und bestehende Datensätze bleiben erhalten. Zusätzlich zur isolierten Datenbankprüfung
wurde der Produktionslauf zunächst zurückgerollt geprüft; vor dem Commit wurden
die bisherigen Buchungen, RLS und Zugriffsrechte innerhalb derselben Transaktion
auf Unverändertheit geprüft. Belege: `schema-preflight.json`, `schema-applied.json`
und `schema-live-verified.json` im genannten Release-Ordner.

## Mitgestalten

- Zugang im persönlichen Bereich unter `/mitgestalten`. Nachtrag 21.11.:
  geprüfter Menüfix `bb26a335b66272f2dfece23977d0d09550fcc97f` macht daraus eine
  reguläre Zeile direkt vor „Einstellungen“, unabhängig vom Adminstatus.
  Bestehende Texte, Ziel, Rechte und API bleiben gleich; keine zusätzliche
  Vorab-Abfrage. Der Menüfix ist auf der Website veröffentlicht; Deployment
  `dpl_BWXujHdNNMwaAHAowm2bGAv8EpVQ` READY und www-Alias laut Release-Beleg
  geprüft. Keine Freigabe neuer App-Änderungen oder iPhone-Updates.
  Beleg: `/srv/cinegenius/handoffs/20261121-feedback-entry/receipt.json`.
- Jede Person meldet sich mit dem eigenen Konto an. Getrennte Gespräche und private
  Entwürfe über den bestehenden Recovery-Dienst; kein gemeinsamer Chatverlauf.
- Admin erzeugt unter `/mitgestalten/koordination` Links mit `lang` und `country`,
  z. B. für Mexiko oder Ungarn. Links vergeben **keine** Rechte, umgehen keine
  Anmeldung und versenden keine Einladungen automatisch. Die manuelle UI-Sprache
  bleibt vorrangig; die Gesprächssprache kann vor dem ersten Austausch gewählt werden.
- Eine kurze Frage zum Einstieg (passt „Crew“?), freie Eingaben und weitere kurze
  Rückfragen. Die bestehende Sprachaufnahme kann Text vor dem Senden einsetzen.
- Originaltext bleibt erhalten. Maximal fünf Vorschläge pro Zusammenfassung,
  zusätzlich deutsche Fassung; jede Aussage verweist auf ein tatsächliches
  Nutzerzitat. Vorschläge sind ausdrücklich ungeprüft. Keine KI-Freigaben und keine
  automatischen Websiteänderungen.
- Erst nach ausdrücklicher Bestätigung wird der Bericht über `contact_support`
  an den privaten Support übergeben. Stabile Paket-IDs machen Wiederholungen
  idempotent. Ein Fehler bestätigt kein Speichern; eingefrorener Bericht und
  Wiederholungsschlüssel bleiben im privaten Entwurf.
- Koordination sieht nur vollständig bestätigte Pakete in den privaten
  Supportgesprächen. Der bestehende Admin-Eingang zeigt den vollständigen Bericht.
  Normale Mitglieder erhalten keinen Zugriff auf diese Übersicht.

### Schnittstellen

| Route | Vertrag |
| --- | --- |
| `GET /api/feedback?lang=es` | Anmeldung nötig; übersetzte Einstiegsfrage, kein KI-Aufruf, privat/no-store. |
| `POST /api/feedback` · `action: discuss` | Eigene `accountId`, gleiche Herkunft, begrenzte Eingabe; bisheriges Genie-Kontingent und vorhandener OpenAI-Zugang. |
| `POST /api/feedback` · `action: submit` | Bestätigter Bericht und stabiler UUID-Schlüssel; kein neuer KI-Aufruf; quittiert nur gespeicherte Supportpakete. |
| `GET /api/admin/feedback` | Admin und eigene `X-Feedback-Account`; seitenweise kompakte Übersicht, keine fremden privaten Nachrichtentexte in der Liste. |
| `GET /api/bookings?listingId=…` | Aktueller berechtigter Preis/Währung; kein Schreibvorgang. |
| `POST /api/bookings` | Optional `expectedPrice`, `expectedCurrency`; Server liest und speichert den aktuellen Preis mit Währung. |

Modell: bestehender Provider, `gpt-4.1-mini`, strukturierte Ausgabe, `store:false`,
keine Werkzeuge. Maximal 41 Nachrichten/18.000 Zeichen je Charge, 2.000 je Eingabe;
zeitlich begrenzte Anfragen. Vor dem Senden wird die Datenweitergabe erklärt.
Der reale Modelltest ist mangels nutzbarem Entwicklungsschlüssel noch offen;
Providerantworten wurden in isolierten Tests geprüft. Keine Aussage über native
Geräteprüfung oder aktuelle Anbieter-Aufbewahrung allein aus `store:false` ableiten.

## App-Abgleich und Abnahme

Native Anzeige muss Währungen erhalten und darf Beträge nicht pauschal als Euro
anzeigen. Gemeinsame Metadatenfelder und Wiederherstellungsregeln benutzen. Die
Web-Ansicht ist kein Nachweis einer nativen Implementierung. Handoff und Prüfbelege:
`/srv/cinegenius/handoffs/20261120-international-feedback/`.
Die frühere Übergabe war wegen der Chat-Verbindung gestört. APP Entwicklung wurde
am 21.11. über die neue ausdrückliche Freigabe und den laufenden Website-Livegang
informiert; der aktuelle Release-Beleg liegt im neuen Übergabeordner.

## Prüfstand

- 17 vollständige Sprachkataloge, gemeinsame Gestaltung und internationale
  Ortsauswahl geprüft; manuelle Sprache bleibt vor Browser-/Länderrückfall.
- Preis-/Währungsregeln, serverseitige Buchungsprüfung, Sichtbarkeitsprojektionen,
  private Feedback-Übermittlung und Fehler/Wiederholung sind isoliert getestet.
- Tatsächliche öffentliche Locations-Ansicht in WebKit mit Spanisch, Ungarisch,
  Deutsch und Französisch bei 390/768/1366/320 CSS px geprüft, einschließlich
  Währungsfilter und URL. Keine öffentlichen Daten wurden geschrieben.
- Feedback/Admin-Oberflächen mit denselben vier Konfigurationen und kontrollierten
  Konten-/API-Fixtures geprüft. Kein echter Nutzerbericht und keine reale KI-Abfrage.
- Der genaue Build-/Testnachweis wird in `verification.json` im Übergabeordner
  gesichert. Produktionsmigration, Veröffentlichung, reale Modellabnahme und native
  Übernahme sind davon getrennte Schritte.

Bestandsgrenze: Das alte Sonderanfertigungsformular `/marketplace/commission` ist
kein funktionierender Versandweg und enthält noch feste EUR-Budgetstufen. Dieser
separate Altbestand ist in der Website-Übersicht erfasst; er gehört nicht zu den
oben umgestellten Angebotsformularen.
