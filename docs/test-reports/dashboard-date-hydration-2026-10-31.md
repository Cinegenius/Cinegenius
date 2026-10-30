# Safari-Nachprüfung: Datumsabweichung im Dashboard

## Tatsächlich beobachtet

Nach der Veröffentlichung `248f773` meldete der Nutzer beim vereinbarten Safari-Ab-/Anmeldetest weiterhin einen roten Konsoleneintrag. Die anschließend tatsächlich gelesene Konsole auf `/dashboard` zeigte **React #418 (Text stimmt zwischen Server und Browser nicht überein)**, drei Schrift-Preload-Warnungen, aber keine laufende Reihe von Clerk-/Inbox-Zugriffsfehlern in dieser Ansicht. Der aktuelle Deploymentbezug war `dpl_BU6CctskftNQKWn7Kyrww94YVq7B`.

Die begrenzte Serverabfrage ab 22:55:30 UTC enthielt 27 erfolgreiche `unread-count`-, 26 erfolgreiche `notifications`- und sieben erfolgreiche Dashboard-Antworten. Die beiden 401-Antworten um 22:55:46 UTC gehören zum gezielten Gastprüffenster nach Veröffentlichung. Keine Server-Runtime-Fehler im vorher separat abgefragten Zeitfenster. Das beweist keinen fehlerfreien gesamten Safari-Lebenszyklus; insbesondere sind browserseitig abgebrochene Anfragen davon zu unterscheiden.

## Reproduzierte Ursache

`app/dashboard/page.tsx` formatierte `new Date()` beim ersten Rendern mit `toLocaleDateString("de-DE", ...)`, ohne gemeinsamen Zeitpunkt oder Zeitzone. Vercel rendert in UTC, der getestete Browser in `Europe/Berlin`. Um 23:01 UTC ist in Berlin bereits der Folgetag.

Mit exakt derselben alten Datumsberechnung wurde lokal in einem echten Browser reproduziert: Server `Freitag, 30. Oktober`, Browser `Samstag, 31. Oktober`; React meldet denselben Hydrierungsfehler und verwirft den betroffenen Teilbaum. Der Entwicklungsfehler zeigt ausdrücklich diese beiden abweichenden Texte. Das ist ein zusätzlicher Darstellungsfehler, keine fehlende CORS-Freigabe und kein Beleg einer abgelaufenen Sitzung.

## Gezielte Korrektur

- `app/layout.tsx`: den vom vorhandenen next-intl-System bereitgestellten Request-Zeitpunkt über `getNow()` parallel mit den anderen Layoutdaten laden und an den bestehenden Provider übergeben.
- `components/AppIntlProvider.tsx`: den Zeitpunkt als serialisierte Eigenschaft an `NextIntlClientProvider` weiterreichen; keine zweite Sprach- oder Zeitverwaltung.
- `components/DashboardDate.tsx`: gemeinsame Uhr mit `useNow`, Datum über `useFormatter` in der gewählten Sprache und explizit `Europe/Berlin`. Automatische Aktualisierung einmal pro Minute nur in dieser kleinen Datums-Komponente. Korrektes `<time>`-Element; keine versteckte Warnung, kein leerer Ersatz und kein zusätzlicher Seitenneustart.
- `app/dashboard/page.tsx`: ausschließlich die bisherige selbst berechnete Tageszeile durch diese Komponente ersetzen. Keine Änderungen an Inhalten, Berechtigungen, Formularen oder übrigen Dashboardansichten.
- `lib/dashboard-date.test.mjs`: die tatsächlichen Provider- und Datumskomponenten prüfen, einschließlich alter Fehlerreproduktion und serialisiertem Datum.

## Bestandene Prüfungen

- 20 Datumsprüfungen: tatsächliche Komponenten in allen sechs Sprachen, UTC/Berlin/Los Angeles, Tageswechsel sowie Beginn und Ende der Sommerzeit. Server-/Client-Markup jeweils identisch.
- Lokaler echter Chromium-Browser mit `Europe/Berlin`, Server mit `TZ=UTC`: alter Ausdruck erzeugt den Text-Hydrierungsfehler; korrigierte Komponenten erzeugen keinen neuen Konsolenfehler. Alle sechs Datumstexte stimmen; Schaltfläche nach Hydrierung bedienbar (Zähler erhöht sich).
- Insgesamt 405 gezielte Datums-/Authentifizierungs-/Navigations-/Inbox-Tests bestanden.
- TypeScript, ESLint der neuen bzw. gemeinsamen Komponenten, Prüfung der sechs Sprachkataloge und Produktionsbuild bestanden. Keine neuen Abhängigkeiten oder unübersetzten Oberflächentexte.

## Grenzen

Der lokale Vorher-/Nachher-Browservergleich simuliert den Tageswechsel mit einem festen Testzeitpunkt. Er ersetzt keinen neuen echten Clerk-Anmeldevorgang in Safari nach dieser zweiten Veröffentlichung. Der Nutzer hat den vorherigen Produktionsvorgang selbst durchgeführt; dessen Konsolenfehler wurde anschließend gelesen. Reale iPhone-/Android-Gerätetests und ein Kontowechsel mit separatem Testkonto wurden in diesem Nachschritt nicht durchgeführt.

Schrift-Preload-Warnungen sind weiterhin getrennt zu bewerten. Keine Konsolenmeldungen unterdrückt und keine Sicherheitsrichtlinie abgeschwächt.

Primärquelle zur Fehlerbedeutung: https://react.dev/errors/418.
