# Organisations- und Redaktionsverwaltung · 21. November 2026

Website-Paket `69f4be8f` auf Basis `42b7d1eb` ist am 21. November 2026 veröffentlicht.
Markus hat den gesonderten Livegang in Agent NEWS ausdrücklich mit „ok dann live“
freigegeben. Native Umsetzung und Installation bleiben vom Auftrag ausgenommen.

## Bedienung

Unter `/organization-dashboard` startet „Beiträge“ mit einer kompakten Liste
statt dem langen leeren Formular. Land → Thema → Originalquelle sind kombinierbar,
ebenso Herausgeber, Titelsuche/Quellensuche und gespeicherter Moderationsstatus.
Die Gesamtansicht bleibt erhalten. Mexiko, Italien, Ungarn, Frankreich, Spanien
und Tschechien werden bei vorhandenen Einträgen vor weiteren Ländern sortiert.
Weitere tatsächlich vorhandene Länder sowie „Ohne Zuordnung“ bleiben erreichbar.

Statusauswahl: Alle, Entwurf, Zur Prüfung, Freigegeben, Ausgeblendet,
Änderungen erforderlich, Abgelehnt und Beendet; bestehende Status-IDs unverändert.
Datumssortierung meint das Erstellungsdatum des Eintrags. Auf dem Handy steht die
Statusauswahl in einem gemeinsamen BrowseSelect, auf größeren Bildschirmen in
kompakten Schaltflächen. Aktive Filter sind einzeln entfernbar; Zurücksetzen setzt
auch die Seite und Sortierung zurück. Reale `news_*` URL-Parameter erhalten die
Auswahl bei Zurück/Vorwärts und erneutem Öffnen. Suchtexte ersetzen den aktuellen
History-Eintrag nach kurzer Eingabepause, Auswahländerungen sind echte Navigation.

Ein Beitrag öffnet das bestehende private Bearbeitungsformular. Dessen
Wiederherstellung, Uploads, explizite Speicherung, Einreichung und Revisionsprüfung
bleiben erhalten. Ein Filterwechsel selbst ist keine Inhaltsänderung. Die
Admin-Organisationsverwaltung verwendet denselben Browser; einen Beitrag muss
man gezielt öffnen, bevor die vorhandenen Moderationsaktionen erscheinen.
Organisationsprüfung und Delegationsschalter stehen im separaten Organisationsbereich.

## Daten und Rechte

- `GET /api/organizations/entry-browser`: aktuelle eigene Organisationen und
  aktive Owner/Admin-Mitgliedschaften. Detail mit `?id=<uuid>` wird erneut geprüft.
- `GET /api/admin/organizations/entry-browser`: bestehende Server-Adminprüfung.
- Filterparameter: `country`, `topic`, `source`, `publisher`, `status`, `search`,
  `sort=newest|oldest`, `page`. Landeswert `none` bedeutet fehlende Zuordnung.
- Eine kompakte, berechtigte Metadatenmenge liefert Treffer, Statuszahlen und
  Filteroptionen. 24 Zeilen pro Seite; stabile Sortierung mit ID als Zweitschlüssel.
  Serverseitige ID-Pagination liest auch hinter einer Anbietergrenze weiter.
  Kurze Teilseiten werden nicht fälschlich als Ende interpretiert; Lesefehler
  melden keinen leeren Erfolg. Bei gleichzeitigen Inhaltsänderungen wird die
  aktuelle Menge pro Anfrage neu gelesen, kein dauerhafter Schnappschuss behauptet.
- Artikeltext und Galerie kommen erst beim Öffnen eines Eintrags. Die erste
  Dashboard-Antwort und `workspace?summary=1` enthalten keine vollständige
  Artikelsammlung. Der bisherige Workspace-Vertrag bleibt ohne diesen Parameter
  verfügbar, jetzt mit vollständiger Pagination und der bisherigen Sortierung
  „neueste zuerst“.
- Antworten einschließlich Ablehnungen sind privat/no-store. Kein öffentliches
  Caching, keine neue Rolle, kein neuer Schlüssel, keine Migration, keine
  Sammelfreigabe, kein Inhaltsumzug. Ein Kontowechsel verwirft Browser- und
  Detailzustand; alte Anfragen werden abgebrochen.
- Fotos verwenden bestehende geschützte MediaImage-/Admin-Medienwege. Keine
  Änderung an Bildern, Originalquellen, Urhebern, Slugs oder Quellenhistorie.

## Länder und Quellen ehrlich unterscheiden

Nur `organization_entries.place_country_code` bestimmt die Landesansicht. Ein
Herausgeber in Deutschland, eine französische Domain oder ein spanischer Text
begründen keine neue Landeszuordnung. Diese Anzeige behauptet weder
Veranstaltungsort noch Teilnahmeberechtigung. Quelle ist die tatsächlich
hinterlegte `external_url`, gruppiert nach Domain, getrennt vom Herausgeber.

Die vorhandene Artikelstruktur enthält keine verlässliche eigenständige
Europa-/International-Reichweite. Deshalb gibt es dafür keine erfundenen Filter;
fehlende Länder bleiben „Ohne Zuordnung“. Eine spätere explizite Reichweitenangabe
ist ein separater Datenvertrag. Ein Artikel mit Land, aber ohne Stadt behält sein
Land jetzt auch bei einer reinen Textkorrektur im bestehenden Editor.

## Prüfung und Grenze

34 gezielte API-/Datenbanktests mit realen SQL-Regeln in PGlite: Rechte,
Mitgliedschaftsentzug, Status, Länder/Quellen, 1.007 Einträge über 42 Seiten,
Anbietergrenzen, Fehler statt Teil-Erfolg und Erhalt von Länderangaben.
20 kontrollierte Browserkonfigurationen mit echtem Browser-/Auswahlkomponenten-Code:
17 Sprachen bei 320 px sowie 390/768/1366 px, vier vollständige Bedienabläufe
inklusive Suche, Filter, echte Back-Navigation, Wiederholung und Kontowechsel.
Eine zusätzliche Editorprüfung bestätigt den Erhalt ungespeicherter Eingaben beim
Filtern, die Sperre eines Beitragswechsels bei fehlgeschlagener Zwischenspeicherung
und den Tastaturfokus beim Öffnen. Zusammen 21 kontrollierte Browserprüfungen.
Authentifizierung, Navigationseinbindung, Wiederherstellung und API-Daten waren
kontrollierte Prüfadapter, keine echte angemeldete Sitzung und kein natives Gerät.

Der vollständige Produktionsbuild, ESLint, die gemeinsamen Designregeln und
`check:i18n` mit 17 Katalogen/11.303 Schlüsseln sind bestanden. Die abschließende
API-Suite prüft auch die bisherige Reihenfolge der Workspace-Antwort.

Der geschützte Produktionsablauf veröffentlichte genau `69f4be8f` aus sauberem
`main == origin/main`. Vercel meldet READY; `www.cinegenius.co` zeigt auf dieses
Deployment. 13 echte Live-HTTP-Prüfungen bestätigen die öffentlichen Seiten,
Anmeldeweiterleitungen mit erhaltenen Filtern und private, nicht cachebare
API-Ablehnungen ohne Anmeldung. Keine echte angemeldete Live-Sitzung und kein
natives Gerät geprüft. Deployment-ID, Quellenkennung und Antworten stehen im
folgenden externen Nachweis; es gab keine Migration oder Aktivierung.

Prüfbelege und endgültiger Build-/Commitstatus:
`/srv/cinegenius/handoffs/20261121-newsroom-browser/`.
Native Übernahme und Installation bleiben gemäß App-Stopp ausgenommen.
