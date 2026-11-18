# Gemeinsame Entdeckung – Website und App, 18. November 2026

Folgepaket zum UI-Stand `b02040d`. Nicht veröffentlicht; die unten genannte Migration ist in diesem Auftrag nicht in Produktion angewendet worden.

## Enthalten

- Die zufällige Crew- und Fotoentdeckung aus App-Commit `a928057e22333745d27986b1b5e3c9228b80dc2f` ist in die Website integriert. Eine öffentliche Zufallskennung hält Reihenfolge und Nachladen innerhalb desselben Besuchs stabil. Alte Crew-API-Aufrufe ohne Kennung behalten ihren bisherigen Vertrag. Datenschutzprüfungen bleiben pro Anfrage aktuell.
- Die Startseitenbilder beginnen nach der neueren Betreiberentscheidung mit bis zu drei neuen zulässigen Bildern verschiedener Anbieter. Danach folgt eine Mischung, ohne dieselbe Bildadresse mehrfach auszuwählen. Die kurze Beschriftung „Neue Bilder / Entdecke Bilder von Mitgliedern.“ aus `b02040d` bleibt erhalten.
- Die öffentliche Online-/Zuletzt-gesehen-Anzeige entfällt in Crew-Karten und im früheren Creator-Detail. Der Browser startet keinen PresencePing mehr. Berufliche Verfügbarkeit, Chat-Lesestatus, Authentifizierung und der bestehende API-Endpunkt bleiben erhalten.
- Firmenlogos erhalten innerhalb unveränderter Kachel- und Listenrahmen etwa 18–20 % mehr Platz; Bilder bleiben unbeschnitten.
- Tatsächlich veröffentlichte Projekte erscheinen als kompakte horizontale Mini-Karten am bisherigen Startseitenplatz. Der direkte Projektlink bleibt auch während einer langsamen oder fehlgeschlagenen Abfrage erreichbar. Private Entwürfe werden nicht abgefragt; unbestätigte Bilder und private Lizenznotizen gelangen nicht in die Vorschau. Höchstens zwölf Datensätze, vier Sekunden Abfragezeit, keine erfundenen Projekte.

## Gemeinsamer Vertrag und Reihenfolge

Vor Veröffentlichung der neuen Zufallsauswahl ist `supabase/migrations/20261117153538_randomized_discovery.sql` im Zielsystem anzuwenden und zu verifizieren. Die drei RPCs sind nur für `service_role` freigegeben. Keine neuen öffentlichen Schreibrechte und keine Änderung gespeicherter Medienrechte. Siehe `docs/randomized-discovery.md`.

Native Quellen bleiben separat. Nur die betroffenen Abläufe und kleinen Quelldifferenzen übernehmen; insbesondere nicht die gesamte Startseitendatei über App-eigene Arbeit kopieren. Alle neuen Webtexte stehen in den 17 bestehenden Katalogen. Kein nativer Raumscanner und keine nativen Aktivitätskataloge wurden in die Website übernommen.

## Prüfungen und Grenzen

Prüfbelege: `/srv/cinegenius/research/20261117-map-pin-previews/`.

- Regressionen für SQL-Rechte und zufällige Reihenfolge, Crew-Paginierung, Medienauswahl, Verlauf, Fotos und Streaming. Projektprüfungen umfassen Medienrechte, private Metadaten, langsame/fehlgeschlagene Abfragen, echte Links und alle 17 Sprachen.
- Standalone-TypeScript sowie Sprach- und gemeinsame Designprüfung. Die beiden bestehenden Effect-/Deklarationsfehler in `CreatorsContent.tsx` sind keine neuen Fehler dieses Pakets; der frühere zusätzliche Aktivitäts-Purity-Fehler entfällt mit der Online-Anzeige.
- Isolierte Browserdarstellung der tatsächlichen Projektkomponente mit synthetischen Datensätzen: 320, 390, 834 und 1440 CSS px; kein Seitenüberlauf, kompakte Karten und vier Karten nebeneinander am Laptop. Firmenlogos werden gegen die vorhandenen öffentlichen Karten gemessen. Das ersetzt keine echte Geräte-/Xcode-Prüfung.
- Der vorherige vollständige Framework-Build scheiterte nach Kompilierung, Typprüfung und Seitenerzeugung an einer gemeldeten Framework-Sicherheitswarnung. Sie ist durch dieses Folgepaket nicht behoben; ein erfolgreicher vollständiger Produktionsbuild wird nicht behauptet.

## Weiterhin getrennt offen

Die berufsfreie Profilwahl „Kompakt / Großes Bild – Schwebende Karte“, kontenübergreifend exklusive persönliche Avatare/Cover mit atomarer Vergabe und Nachfüllung sowie auswählbare wiederverwendbare Firmenmotive sind noch nicht Teil dieses Pakets. Bereits verwendete Bilder dürfen dabei nicht stillschweigend ausgetauscht werden. Die Firmenkategorien `kostumfundus` und `requisite` existieren bereits; keine doppelten Kategorien anlegen. Ebenfalls separat: Angebotsformulare/strukturierte Suchangaben, optionaler Tierprofil-Einstieg für Tierberufe und der echte angemeldete Smart-Test mit dem bestehenden Hundprofil.

## Rückübernahme aus dem App-Abgleich

Der App-Stand `3165592b48c6b767dcfba1c45c15c30ac71ef7e4` meldete einen Überlauf der langen russischen Galerieaktion bei 320 CSS px. Nur die Aktionsgruppe und ihr Link dürfen jetzt umbrechen; der Pfeil bleibt unverzerrt. Drei veraltete Testadapter wurden an die vorhandenen Tier-Sichtbarkeitsprüfungen, Homepage-Abhängigkeiten und Organisations-Taxonomie angepasst. Keine App-eigenen Produktänderungen oder nativen Kataloge wurden übernommen.

Eigene Website-Nachprüfung: 49 gezielte Regressionen bestanden; Komponenten-Lint bestanden. 20 Browserfälle prüfen die tatsächliche Galeriekomponente mit synthetischen Daten: alle 17 Sprachen bei 320 px sowie Russisch bei 390/834/1440 px. Die Kopfzeile bleibt innerhalb des Viewports und Pause/Fortsetzen funktioniert. Die Prüfung betrifft Textumbruch und Bedienelemente, keine echte Anmeldung, privaten Uploads oder native Geräte. Belege: `app-follow-up-tests.log`, `gallery-locales-browser.json` und `gallery-follow-up-lint.log` im oben genannten Prüfverzeichnis. Veröffentlichung und Migrationsstatus bleiben unverändert: nicht live, Migration nicht in Produktion angewendet.
