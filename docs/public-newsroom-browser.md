# Öffentliche Redaktion: Beiträge finden

Veröffentlichter Website-Stand `34373818` vom 21. November 2026, 14:15 Uhr
(Europe/Berlin), auf Basis `62cf7331`. Auftrag aus Agent NEWS:
auch die öffentliche Redaktionsseite nach Land, Thema, Beitragsart und tatsächlicher
Originalquelle erschließen. Markus gab diese öffentliche Erweiterung separat frei;
veröffentlicht über den regulären sauberen Hauptstand. Vercel READY und der
tatsächliche www-Alias bestätigen denselben Quellcommit.

## Bedienung

Die vorhandene Organisationsseite bleibt erhalten. Unter „Aktuelle Beiträge“ stehen
Titelsuche/Quellensuche, Land, Thema, Beitragsart, Originalquelle und Datumssortierung.
Am Handy bleiben Suche und Land direkt sichtbar; weitere Filter sind aufklappbar.
Es gibt keine horizontale Leiste. Alle Länder mit passenden öffentlichen Beiträgen
bleiben wählbar; keine künstlichen Länderorganisationen. „Alle“ und Zurücksetzen
öffnen wieder die Gesamtansicht. Eine Auswahl ohne Treffer bleibt ausdrücklich leer.

Jede Filterauswahl erzeugt eine echte URL. Suchtext wird erst mit Suchen/Enter
angewandt. Die Parameter `country`, `topic`, `type`, `source`, `search`, `sort` und
`page` erhalten den Stand bei Artikelbesuch, Zurück/Vorwärts und erneutem Öffnen.
Eine Filteränderung beginnt auf Seite 1. Datumssortierung verwendet das
Erstellungsdatum mit ID als stabilem Zweitschlüssel, zwölf Beiträge je Seite.
Alte Organisationslinks leiten mit den gültigen öffentlichen Filtern weiter.

Die Karten zeigen Titel, Kurzbeschreibung, Land, Datum und Originalquellen-Domain.
Vorhandene Titelfotos oder ein gültiges Galeriefoto werden kompakt und unbeschnitten
gezeigt, mit vorhandenen Bildnachweisen. Fehlende Bilder bleiben zulässig. Kein
Logo als erfundenes Artikelfoto, keine Änderung an Originalen oder Quellenhistorie.

## Öffentliche Daten und Privatsphäre

Ein separater Serverleser prüft bei **jedem** Datenabruf sowohl den freigegebenen
Herausgeber als auch den öffentlich zulässigen Beitrag (`approved`/`ended`).
Keine Admin-/Workspace-API und keine Mitgliedschaftserweiterung. Entwurf, Prüfung,
Ausblendung und Ablehnung sind keine öffentlichen Filter. Auch als Administrator
liefert diese öffentliche Ansicht nur öffentliche Ergebnisse.

Nur ein kompakter Metadatenindex wird vollständig und mit ID-Pagination gelesen;
kurze Anbieter-Teilseiten beenden die Abfrage nicht verfrüht. Erst für die gewählte
Seite werden Kurzbeschreibung und Bilddaten geladen. Keine vollständigen Texte,
privaten Kontakt-/Prüffelder oder gesamten Galerien gelangen in die Browserdaten.
Trefferzahlen und Filteroptionen stammen aus derselben öffentlichen Menge;
jede Filterzahl berücksichtigt alle anderen aktiven Filter.

Die Landesangabe stammt ausschließlich vom Beitrag. Herausgebersitz, Sprache,
Browserland und Quelldomain ergänzen kein fehlendes Land. `none` bedeutet ehrlich
fehlende Zuordnung; keine erfundene Europa-/International-Kategorie. Es werden keine
Profilpräferenzen verändert und keine Standortrechte angefragt.

Lesefehler oder Änderungen an den ausgewählten Datensätzen zwischen Index- und
Seitenabruf ergeben eine wiederholbare Fehlermeldung statt falscher Nullzahlen oder
veralteter Treffer. Die Abfragen sind kein atomarer Datenbankschnappschuss; aktuelle
Freigaben werden erneut geprüft und nicht über Anfragen hinweg zwischengespeichert.

## Abnahme und App-Abgleich

Nachweise: `/srv/cinegenius/handoffs/20261121-public-newsroom/`.
Die Daten-/Rechteprüfung verwendet echtes PostgreSQL über PGlite und die vorhandenen
Migrationen; Browsertests die echten UI-Komponenten mit kontrollierter Navigation,
Bildtransport und Beispieldaten. Das ersetzt weder eine Liveprüfung noch ein iPhone.
Geprüft sind 34 gezielte Modell-, Datenbank-, Rechte- und Bildauswahlfälle, darunter
1.007 Beiträge, kombinierte Filter, Seitenenden, private Beiträge, Freigabeentzug
und wiederholbare Abfragefehler. 21 Browserkonfigurationen umfassen alle 17 Sprachen
bei 320 px sowie 390, 768 und 1.366 px; fünf vollständige Bedienabläufe prüfen
Filterkombinationen, Artikel/Zurück, erneutes Öffnen, leere Suche, Seitenwechsel,
Sortierung, Tastatur und Fehler/Wiederholung. Die Browserprüfung verwendet WebKit
und Chromium mit kontrollierten Beispieldaten, nicht die Live-Datenbank.

Alle Texte verwenden die vorhandenen 17 Sprachkataloge (11.309 Schlüssel, keine
neuen unübersetzten Quelltexte). Designprüfung und gezielte Codeprüfung bestanden.
Der vollständige Produktionsbuild einschließlich TypeScript ist am 21.11.2026 um
14:10 Uhr (Europe/Berlin) bestanden; die geprüften Programmdateien blieben während
des Builds unverändert. Ein Produktionsbuild ist keine Veröffentlichung.

Native Implementierung und Installation gehören separat zu APP Entwicklung.
Dieses Paket aktiviert keine Dienste, ändert keine Inhalte/Organisationen und
führt keine Migration durch. Native Umsetzung/Installation bleibt separat.

## Tatsächlicher Live-Abgleich

Nach Veröffentlichung wurden 26 öffentliche Beiträge über drei Seiten, darunter
3 Mexiko-Beiträge, mit einem ausschließlich lesend erfassten Bestand verglichen.
Ein vorhandener privater Beitrag bleibt in Ergebnissen, Facetten und ausgelieferten
IDs ausgeschlossen. Vier Browserkonfigurationen (1366 DE, 390 DE, 320 ES, 768 HU)
prüfen echte öffentliche Daten; zwei vollständige Bedienabläufe einschließlich
Filterkombinationen, Suche/Leerzustand, Sortierung, allen Seiten und Artikel/Zurück.
Kein seitlicher Überlauf, keine privaten Verwaltungsanfragen. Kein nativer Test.

Beim schnellen WebKit-Seitenwechsel wurde eine Übersetzungs-Netzwerkdiagnose mit
einer abgebrochenen Anfrage aufgezeichnet. Der zusätzliche ruhende Aufruf liefert
Übersetzungen mit HTTP 200, alle sechs Technik-Bilder vollständig und keine
Laufzeit-/Netzwerkfehler. Die Diagnose bleibt im Livebeleg dokumentiert. Der
begrenzte Vercel-Runtime-Abruf für dieses Deployment lieferte null Fehlerdatensätze.

Deployment: `dpl_B9Y7wAAxkENkDesYwf3nyZTSDNKa`. Prüfberichte und Grenzen in
`live-after.json`, `live-settled.json` und `receipt.json` im obigen Belegordner.
