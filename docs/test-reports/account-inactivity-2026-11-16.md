# Kontoinaktivität: gemeinsame Prüfung von Website und App

Stand: 16. November 2026. Quellbasis `ca05634`, Implementierung `d270974` und
`f6140f4` sowie Mitteilungseinbindung/Rechtstextpräzisierung `38283e0`; APP-Client begrenzt aus `3f501035544033005cd0778fe44f17bf72477d27`
übernommen. Der Prüfbericht ergänzt diese Implementierung ohne Laufzeitänderung.

## Nachweise

- **177 fokussierte Tests bestanden**: real ausgeführte PostgreSQL-Migration in
  PGlite, Zeitgrenzen und Zustellnachweise, Rückkehr/alte Zyklen, Rechte auf Tabellen
  und Funktionen, Medien-/Profilsichtbarkeit, Kontolösch-Bereinigung, signierte
  Clerk-Ereignisse, API-Authentifizierung/Herkunft, Cron-Secret und Methoden,
  App-Client sowie E-Mail-/Mitteilungsdarstellung in allen neun Sprachen.
- **38 ergänzende Mitteilungsprüfungen bestanden** nach Einbindung des neuen
  Typs in beide bestehenden Ansichten und deren Systemfilter. Diese Suite
  überschneidet sich teilweise mit der vorherigen fokussierten Prüfung.
- **27 isolierte Chromium-Fälle bestanden**: neun Sprachen bei 320, 768 und
  1440 CSS-Pixeln mit den echten neuen Settings-/Admin-Komponenten und den
  gemeinsamen Styles. Kein horizontaler Überlauf, Schaltflächen mindestens
  44 Pixel hoch/breit, fehlgeschlagener Abruf und erneuter Versuch geprüft.
  Konten, API und Router waren simuliert; Schrift-Fallback Arial im Prüfrahmen.
- **i18n bestanden**: neun Kataloge mit 8105 Schlüsseln und unverändertem
  Bestand zulässiger Alttexte. Neue Rechts-Ergänzungen bleiben als deutsche
  Originalfassung gekennzeichnet. Interface- und Mailtexte sind lokalisiert.
- **Designprüfung bestanden**; gezieltes ESLint für alle neuen Laufzeitdateien,
  beide Client-Komponenten, Admin-Panel, neue Routen und Clerk-Webhook ohne Fehler.
- APP Entwicklung lieferte zusätzlich 30 fokussierte Tests und zwölf isolierte
  Browserfälle. Das sind ergänzende Client-Nachweise, keine Geräteabnahme.

Die Tests verwenden isolierte Datensätze und nachgebildete Anbieterantworten.
Es wurden keine echten Konten gealtert, versteckt oder gelöscht und keine
Testbenachrichtigungen an Mitglieder versandt.

## Gesamtprüfung

**Vollständiger Build einschließlich TypeScript bestanden (Exit 0)**:
`NODE_OPTIONS=--max-old-space-size=4096 npm run build`, 160 Seiten erfolgreich
erzeugt. Die vorhandenen lokalen Projekteinstellungen wurden ausschließlich für
den Build eingelesen; `VERCEL_ENV=development` und
`ACCOUNT_INACTIVITY_ENABLED=false` hielten die Automatik ausdrücklich inaktiv.
Keine Konfigurationsänderung am Projekt und kein Cloud-Build.

Ein vorheriger Versuch scheiterte an `ENOSPC` auf dem gemeinsamen
Serverdatenträger. Nur der in diesem Auftrag erzeugte Webpack-Cache wurde
entfernt. Die zusätzliche vollständige Typprüfung deckte fehlende
Symbolzuordnungen des neuen Mitteilungstyps in zwei bestehenden Ansichten auf;
diese wurden ergänzt und anschließend durch den erfolgreichen vollständigen
Build sowie die 38 Mitteilungsprüfungen bestätigt.

## Betriebsgrenzen

Keine Produktionsmigration, keine Aktivierung, kein produktiver Versand und
keine Veröffentlichung. Die 12/15/18/24-Monatsstufen enden in einer
Betreiberprüfung, nicht in einer automatischen endgültigen Kontolöschung.
Der vollständige Erstzeitraum schützt Bestandsmitglieder vor rückwirkenden
Konsequenzen. Rechtliche Einbeziehung geänderter AGB und erforderliche
Aufbewahrungsentscheidungen bleiben vor Aktivierung zu klären.

Echte iPhone-/iPad-/Android-Rückkehr, Offline-Verhalten im Gerät, unterbrochene
Sitzungen und produktive Zustellbestätigungen benötigen noch den gemeinsamen
Abnahmelauf. Browser-Simulation ist dafür kein Ersatz.

Serverbelege: `/srv/cinegenius/handoffs/20261116-account-inactivity/`;
zusätzlicher APP-Beleg:
`/srv/cinegenius/handoffs/20261116-app-account-activity-client/`.
Reihenfolge und Schnittstellen: [Betriebsbeschreibung](../account-inactivity.md).
Rechtsabgleich: [Kontoinaktivität](../legal-review/2026-11-16/account-inactivity.md).
