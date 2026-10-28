# Admin-Prüfansicht – erste vereinbarte Ausbaustufe, 28.10.2026

## Umfang und Bestand

Nach der Promptbesprechung wurde zuerst die geschützte vollständige Vorschau mit
bestehenden Prüfaktionen umgesetzt. Kontoeinschränkungen, Sperren, dauerhafte
Moderationsentscheidungen und Kontolöschung gehören zu den folgenden, noch nicht
umgesetzten Stufen. Produktionsveröffentlichung anschließend ausdrücklich durch den Nutzer beauftragt.

| Bestand vor der Änderung | Befund | Priorität |
| --- | --- | --- |
| Serverprüfung von Adminbereich und Admin-APIs | funktioniert: Proxy, Layout und `requireAdmin` vorhanden | erhalten |
| Paginiertes Verzeichnis für Profile, Firmen, Inserate, Projekte | funktioniert; Listenstatus über bestehende History-Verwaltung erhalten | erhalten |
| „Öffentlich ansehen“ bei privaten Inseraten | fehlerhaft als Prüfweg: öffentliche Detailseite kann einen privaten Entwurf nicht zeigen | hoch |
| Vollständige geschützte Vorschau | fehlt | hoch |
| Admin-Veröffentlichung aus der Liste | unvollständig: keine Bindung an die tatsächlich betrachtete Version; Protokoll und Statuswechsel getrennte Schreibvorgänge | hoch |
| Bildprüfung bei einer Freigabe | unvollständig: gespeicherte Referenz allein belegt keine erreichbare Originaldatei | hoch |
| Gemeinsame Veröffentlichungsvalidierung | veraltet: akzeptierte nur absolute HTTPS-Bildadressen, nicht die inzwischen verwendeten stabilen `/api/media/...`-Verweise | hoch |
| Geschützte Admin-Vorschau privater Bilder | fehlt; bestehende Medienprüfung meldet Berechtigungen, liefert aber bewusst keine privaten Bytes | hoch, eng begrenzen |
| Projektentwürfe, Schwarzes Brett, Firmenequipment als prüfbare Quellen | fehlender gemeinsamer Einstieg | mittel |
| Supportdialog mit Eigentümerermittlung und manuellem Versand | funktioniert; direkt wiederverwendet | erhalten |
| Ablehnung, dauerhafte Moderationssperre, Konto sperren/löschen | fehlt; bewusst nächste Stufe statt `published` als dauerhafte Sperre misszuverstehen | gesondert |

## Umsetzung

- Neuer Bereich **Inhalte prüfen**, mit Quelle, Suche und Pagination. Explizite
  Quellen: Inserate (einschließlich Location, Fahrzeug, Equipment, Job usw.),
  Firmen, Personenprofile, Projekte, Projektentwürfe, öffentliche Aushänge und
  Firmenequipment. Nachrichten und Supportdateien sind keine Prüfquellen.
- Direkte Prüflinks in den bestehenden Inserate-, Firmen-, Profil-, Projekt- und
  Kontolisten sowie für unterstützte Meldungsziele.
- Geschützte Detailansicht: vollständige gespeicherte Beschreibung, Kategorien,
  Details und Kontakte; alle zugeordneten Bilder in gespeicherter Reihenfolge,
  vollständige Großansicht, technische Erstellerzuordnung getrennt vom Anbieter,
  verantwortliche Person einschließlich öffentlicher Namensfreigabe, Zeitstempel
  und Versionskennung. Fehlende Pflichtangaben werden bei Inseraten markiert.
  Weniger gebräuchliche Metadaten bleiben als technische gespeicherte Feldnamen
  lesbar. Die Ansicht ist eine Prüfansicht, keine identische Kopie sämtlicher
  öffentlicher Detailseiten und ihrer Nebenbereiche.
- Kein Scheinlink zu einem fehlenden Personenprofil. Ein Anbieter ohne öffentliches
  Personenprofil kann weiterhin über das verantwortliche Konto nachvollzogen werden.
- **Nachbesserung anfordern** öffnet den bestehenden Supportdialog für Inserate,
  Firmen oder Personenprofile. Empfänger, Vorlage und Text werden vor manuellem
  Versand geprüft. Projekt-/Aushang-spezifische Supportziele sind noch nicht ergänzt;
  hier erfolgt keine irreführende automatische Erinnerung an Personenprofilfelder.
- **Geprüften Stand veröffentlichen / Vorläufig ausblenden** für Inserate:
  Begründung und Prüfbestätigung, Fingerabdruck von Inhalt und Anbieter,
  Prüfung aller aktuellen Bilder, anschließend atomarer Vergleich und
  Statuswechsel zusammen mit Protokolleintrag. Auch das ältere API bietet keine
  Freigabe ohne geprüfte Revision mehr an. Wiederholungen erzeugen keine doppelten
  Statusänderungen oder Protokolleinträge.
- Bei zwischenzeitlichen Änderungen: 409, aktuellen Stand neu laden und prüfen.
  Bei Protokollfehler: Veröffentlichung in derselben DB-Transaktion zurückrollen.
  Cache-Aktualisierung nach erfolgreicher Speicherung ist getrennt behandelt,
  damit ein Cachefehler nicht fälschlich als fehlgeschlagene Speicherung erscheint.
- Veröffentlichungsregeln der Anbieter bleiben erhalten. **Vorläufiges Ausblenden
  ist keine dauerhafte Moderationssperre.** Berechtigte Anbieter können weiterhin
  selbst veröffentlichen. Ablehnungen und Moderationssperren sind noch offen.
- Kein allgemeiner Admin-Bypass im öffentlichen Medienendpunkt. Der neue
  Prüfmedien-Endpunkt prüft die aktuelle Administration und den kanonischen
  Ursprung des jeweiligen Fotos. Ein fremdes privates Bild wird durch Spiegeln
  in einem geprüften Eintrag nicht lesbar. Nur vorhandene zugeordnete Referenzen,
  keine frei übergebenen Downloadadressen. Alte öffentliche Storage-Bilder nur
  aus tatsächlich öffentlichen Buckets; externe Zugriffe nur auf `img.clerk.com`,
  ohne Redirect-Folgen. Private, signierte und beliebige Fremdadressen gesperrt.
- Originaldateien unverändert; begrenzte Dateigröße und Pixelzahl, kleine
  Vorschauvarianten, keine gemeinsamen Caches oder Next-Optimizer-Kopien für
  geschützte Prüfbilder. Alle Prüfantworten `private, no-store` und `noindex`.
- Neue Texte und die betroffenen gemeinsamen Galeriebeschriftungen in DE, EN,
  ES, IT, CS und HU. Namen und selbst verfasste Inhalte unverändert.

## Geänderte Dateien

- `app/admin/page.tsx`, `components/admin/AdminAccounts.tsx`,
  `components/admin/SupportMessageAction.tsx`.
- Neue Komponenten `components/admin/AdminReviewDetail.tsx`,
  `AdminReviewLink.tsx`, `AdminReviewQueue.tsx`.
- Neue Seite `app/admin/review/[kind]/[id]/page.tsx` und drei API-Routen unter
  `app/api/admin/reviews/` (Liste, Datensatz/Aktion, Bildauslieferung).
- `lib/admin-review.ts`, `admin-review-server.ts`, `admin-review-media.ts`,
  `admin-review-release.ts`; `app/api/admin/listings/route.ts`.
- `lib/listing-publication.ts`, `lib/protected-media.ts`, `components/MediaImage.tsx`,
  `ListingPhotoGallery.tsx`, `Lightbox.tsx`, `proxy.ts`.
- Sechs bestehende Sprachkataloge, ergänzte bestehende Regressionstests plus
  `lib/admin-review.test.mjs` und `lib/admin-review-db.test.mjs`.
- `docs/design-and-release.md` und diese Dokumentation.

## Datenbank

Vorbereitete kompatible Migration:
`supabase/migrations/20261028160000_admin_review_release.sql`.
Sie ergänzt nur eine servicegeschützte Funktion, keine Tabellenänderung und keine
Datenkorrektur. In isoliertem PostgreSQL (PGlite) mit eigenen Testdatensätzen geprüft.
**Am 28.10.2026 auf CineGenius main PRODUCTION angewendet und verifiziert.**
Gäste/Mitglieder ohne Ausführungsrecht, Service-Rolle berechtigt. Prüfsummen der
vorhandenen 16 Inserate und 9 Firmen unverändert, 80 Profile weiterhin vorhanden.
Ein eigener Testeintrag wurde innerhalb einer vollständig zurückgerollten
Transaktion erstellt: Freigabe, Ausblenden, Ablehnung einer veralteten Revision
und genau zwei Aktionsprotokolle geprüft. Kein Testeintrag oder Testprotokoll
dauerhaft gespeichert.

## Tatsächlich geprüfte Abläufe

Automatisierte Tests verwenden ausschließlich eigene lokale Fixtures:

- Quellen-Whitelist; Gast-/Mitgliedsverweigerung vor Daten- oder Dateizugriff.
- Private Entwürfe vollständig laden ohne Änderung/Veröffentlichung.
- 20 Bilder, gespeicherte Reihenfolge, Firmengalerie und Projektentwurfbilder.
- Fehlende Datensätze gegenüber echten Datenbankfehlern unterschieden.
- Technischen Ersteller bei Firmenangeboten nicht als Anbieter einsetzen.
- Privates Bild nur bei passendem kanonischem Elternobjekt; Spiegelungen,
  fremde Eltern, Nachrichten-/Supportquellen und unzulässige Fremdadressen gesperrt.
- Fehlende Originaldateien, veraltete Bildidentität, keine Optimizer-Kopie,
  richtige Thumbnail-Parameter, unverzerrte Hochformat-Verarbeitung.
- Freigabe ohne Revision oder mit verändertem Inhalt abgelehnt; fehlende Datei
  verhindert Freigabe; vollständige Serverdaten und tatsächlicher Admin gehen
  in die Transaktion.
- In echtem lokalem PostgreSQL: Veröffentlichen, Ausblenden, Wiederveröffentlichen,
  Änderung ohne `updated_at`-Änderung, geänderte Anbieterzuordnung, wiederholte
  Anfragen ohne doppeltes Protokoll, vollständiger Rollback bei Protokollfehler.
- SQL-Funktionsrechte: `anon`, `authenticated`, `PUBLIC` ohne Ausführung;
  `service_role` berechtigt.
- Insgesamt 716 Tests bestanden, einschließlich der bestehenden 696
  Regressionstests und 20 ergänzter Prüfungen. Vollständiger Produktionsbuild
  ebenfalls bestanden.
- Übersetzungs-/Platzhalterprüfung: sechs Kataloge, keine neuen unübersetzten
  UI-Literale. Bestehende allgemeine Übersetzungsschulden werden nicht als
  vollständig erledigt behauptet.

Browser: tatsächliche neue React-Komponenten mit eigenen erfundenen Testdaten
und isolierter lokaler API-Simulation, keine echten Supabase-/Clerk-Konten:

- Desktop: Galerie öffnen, per Pfeiltasten wechseln, mit Escape schließen,
  Nachbesserungsdialog mit richtigem Testempfänger öffnen, fehlende Begründung
  führt zum Feld, Freigabe aktualisiert Status/Version und Erfolgsbestätigung.
- Handy-Simulation 390 und kleine 320 CSS-px-Ansicht: Umbrüche, erreichbare Aktionen,
  Fehlerfokus; Tablet-Simulation 820 CSS px. Gemessene Inhaltsbreite entspricht
  verfügbarer Breite (315/315 und 815/815 px nach Scrollbarabzug).
- Alle sechs Sprachen auf kleiner Breite geöffnet, keine Seitenüberbreite;
  eigener Titel/Beschreibung unverändert. Gemeinsame Galerie nun ebenfalls
  übersetzt. Keine physischen iOS-/Android-Gerätetests.

## Vor einer Live-Freigabe noch offen

- Migration und Rechteprüfung auf Produktion abgeschlossen.
- Vollständiger Test mit eigenen realen Admin-/Mitgliedskonten und privaten
  Testuploads auf dem tatsächlichen Clerk-/Supabase-System, einschließlich
  Supportversand/Antwort und Rückkehr in reale gefilterte Adminlisten.
- Produktive Vorschauwege der historischen Bilder/Datensatzvarianten abgleichen;
  fremde Nutzerinhalte wurden weder geändert noch veröffentlicht.
- Folgestufen: dauerhafte Ablehnung/Moderationssperre, Kontomaßnahmen, vollständige
  Beschwerdeentscheidung und abgesicherte Löschung. Zugehörige Freigabe- und
  Aufbewahrungsentscheidungen sind noch nicht implementiert.
