# Gemeinsamer Prüfstand: internationale Preise, Länderfeedback und News

Stand: 21. November 2026. Branch `codex/international-news-ready-20261120`.
Dies ist ein gemeinsamer Implementierungsstand. Nur der News-Anteil `a58ee77d` und sein Übersetzungsfix `a44cdec2`
sind inzwischen separat veröffentlicht; Währungen/Feedback bleiben unveröffentlicht.
Er vereint die getrennt geprüften Pakete `65651599` (Währungen/Feedback) und
`a58ee77d` (News) auf der veröffentlichten Grundlage `3bd731f2`.

## Umfang

- 155 explizit auswählbare Währungen in Angebots-, Crew- und relevanten Preiswegen;
  historische Beträge behalten EUR, keine Umrechnung. Filter vergleichen dieselbe
  Währung, Buchungen speichern die vereinbarte Währung als Snapshot.
- Privater Mitgestalten-Bereich für unabhängig arbeitende Ländervertreter,
  Sprach-/Ländereinstieg, geführte KI-Fragen, Freitext, private Wiederherstellung,
  ausdrücklich bestätigte Rückmeldung und deutsche Admin-Zusammenfassung.
- News-Galerie mit höchstens acht geschützten Bildern, unverfälschten Bildnachweisen
  und sichtbarem Archivkontext. Aktuelle Medienrechte gelten auch für jede Galerie.
- Neue Artikelmessung nur nach ausdrücklicher erneuerter Einwilligung; bestehende
  Ablehnung gilt weiter. Tatsächlich sichtbare Karten/geöffnete Artikel statt
  vorgeladener Daten, keine Besucherprofile. Privater aggregierter Lernfeed mit
  Mindestdatenmenge und ehrlichem Kaltstart/Fehlerzustand.
- Eng begrenztes einmaliges Ausblenden belegter Altimporte nach Admin-Einzelfreigabe;
  keine automatische Übernahme fremder Artikel oder Freigabe ihrer Veröffentlichung.
- Geprüfte NEWS-Runtime-Quellen versioniert. Die laufende Runtime wird dadurch
  weder ersetzt noch aktiviert.

## Gemeinsame Prüfung

166 gezielte Prüfungen im vereinten Stand bestanden: Währungen, Buchungen,
privates Feedback, internationale Ortsauswahl, News-Galerie, Consent,
PostgreSQL-Rechte/Medienursprung, Redaktions-APIs und geschützte Navigation.
Alle 17 Kataloge / 11.274 Schlüssel und Designprüfung bestanden. Die vorherigen
Browsernachweise für beide Pakete bleiben ausdrücklich isolierte Komponenten-
beziehungsweise öffentliche Leseprüfungen; sie sind keine native App-Abnahme.
Der vollständige gemeinsame Produktionsbuild ist am 20. November 2026 um
23:35 UTC mit Exit 0 durchgelaufen; Nachweis im Release-Handoff.

## Vor Freischaltung offen

1. Betreiberfreigabe für Währungen und Feedback am 21.11.2026 mit „dann stell live“
   erteilt. Die Übernahme erfolgt separat auf den aktuellen Hauptstand mit den
   Newsfotos und anschließend über den bewachten Releaseweg mit sauberem
   `main == origin/main`. Tatsächlicher Stand: `/srv/cinegenius/handoffs/20261121-international-release/receipt.json`.
2. Die Buchungs-Währungsmigration `20261120194027_booking_currency_snapshot.sql`
   ist am 21.11. angewandt und unabhängig geprüft; alte Buchungen und Rechte sind
   unverändert. Die separate
   News-Migration `20261120230314_news_gallery_and_legacy_expiry.sql` ist bereits
   angewandt. Keine automatischen Grants, Artikeländerungen oder Runtime-Marker
   daraus ableiten.
3. Für `/api/editorial/readership` den privaten lesenden PostHog-Zugang einrichten
   und den echten Feed prüfen; derzeit fehlt `POSTHOG_NEWS_READ_KEY`. Die vorhandene
   Chat-Verbindung ist kein dauerhaftes Server-Zugriffsrecht.
4. Die neuen KI-Feedbackantworten mit dem echten Anbieter prüfen. News-Titel,
   Kurzfassung, Caption und Volltext sind nach Korrektur mit echten deutschen und
   spanischen Modellantworten geprüft. Keine pauschale sprachliche Abnahme aller
   dynamischen Inhalte oder Gleichsetzung mit der nativen App.
5. NEWS-Medien sind nach echtem privatem Upload, exakt geprüftem Derivat,
   Bildrechtenachweis und öffentlicher Artikelprüfung aktiviert. Die beiden bekannten Legacy-Imports hat NEWS bereits
   regulär über die Adminoberfläche verborgen; keine neue Freigabe hierfür setzen.
6. APP übernimmt gemeinsame Verträge und prüft echte Geräte. NEWS meldete einen
   am lokalen Simulator blockierten Prüfversuch; das ist keine native Abnahme und
   kein Nachweis eines Websitefehlers. Der bestehende native Smart/Work-Release-Halt
   bleibt erhalten.

Belege und tatsächlicher Stand:
`/srv/cinegenius/handoffs/20261120-international-news-ready/receipt.json`.
Ein APP-Handoff ist gespeichert; die direkte Chat-Nachricht konnte wegen eines
Verbindungsfehlers nicht zugestellt werden. Der tägliche Website-Prüfagent bleibt
deaktiviert. Das bestehende Design bleibt erhalten.

Separater News-Livebeleg: `/srv/cinegenius/handoffs/20261121-news-gallery-release/`.

Der News-Übersetzungsfix besteht zusätzlich 92 gezielte Prüfungen, den vollständigen
Build, zwei Komponenten-Browserfälle und echte Modellprüfungen auf der Website.
Offizielle Festivalnamen und klar erkennbare Daten werden vor der KI geschützt;
die Quelltexte bleiben unverändert. Keine neue Datenbankmigration.
