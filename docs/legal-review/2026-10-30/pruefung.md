# Prüfergebnisse und Grenzen

Prüfstand der ersten Vorbereitung: 30. Oktober 2026. Keine Veröffentlichung oder Aktivierung neuer Vertragsrechte. Die anschließend freigegebene Einbindung der kurzen Uploadhinweise wird separat im [Releasebericht](../../test-reports/upload-notices-2026-10-30.md) dokumentiert.

## Tatsächlich durchgeführt

- Bestehende AGB, Datenschutz- und Impressumsseiten mit Registrierung, aktuellen Veröffentlichungsregeln, Medienherkunft, Projektbildrechten, Firmenzugehörigkeit, Nachrichten/Support, Meldungen, Bewertungen, Anfragebestätigung und Kontolöschung gezielt im Quellcode abgeglichen.
- Aktuelle amtliche Gesetzes- und Behördenquellen recherchiert; Fundstellen und offene Einordnung in `quellen.md` dokumentiert. Keine fremden AGB übernommen.
- `node --experimental-strip-types --import ./scripts/register-test-aliases.mjs --test lib/content-usage-notice.test.mjs lib/project-media-rights.test.mjs`: **17 Tests bestanden**. Darin rendert die neue Komponente alle **120 Kombinationen** aus sechs Sprachen, fünf Quellen und vier Sichtbarkeitszuständen. Nicht öffentliche Zustände enthalten keine Zusage öffentlicher Fotoauswahl. Es gibt kein neues Eingabe- oder Zustimmungsfeld.
- Bestehende Projektbildtests erneut bestanden: unbestätigte Projektbilder werden öffentlich nicht ausgegeben, bestätigte Erklärungen gelten nur für die bezeichneten Bilder, private Nachweise bleiben geschützt, Veröffentlichung ohne Foto bleibt möglich. Diese Tests verwenden isolierte Daten und simulierte API-Aufrufe, keine echten Mitglieder.
- `npm run check:i18n`: **bestanden**, sechs Kataloge und 1.896 Schlüssel; kein neuer fest eingebauter Oberflächentext. Der vorhandene Übersetzungsrückstand wird dadurch nicht als vollständig gelöst bezeichnet.
- `npx eslint components/ContentUsageNotice.tsx lib/content-usage-notice.test.mjs`: **bestanden**.
- `npx tsc --noEmit --incremental false`: **bestanden**.
- Browserprüfung in einer getrennten lokalen Vorschau mit echten Projektstilen und der vorbereiteten Komponente: alle sechs Sprachfassungen bei **390 und 1.366 CSS-Pixeln** geprüft; Aufklapper geöffnet, Textumbruch und Dokumentbreite kontrolliert. Kein horizontaler Seitenüberlauf; Bedienfläche des Aufklappers 44 CSS-Pixel hoch.
- Deutsche private Entwurfsansicht geprüft: erklärt ausdrücklich die nicht öffentliche Speicherung. Öffnen per Tastatur und Informationslink zur vorhandenen Bildrechteseite geprüft. Der Link führt auf `/bildrechte`.

Die erste schnelle Vorschau betätigte den nativen Aufklapper teilweise noch vor der React-Hydrierung und erzeugte dadurch Entwicklungswarnungen über das veränderte `open`-Attribut. Die abschließenden Sprach-/Breitenprüfungen warteten auf die fertige Vorschau. Das ist kein Nachweis eines bereits fehlerfreien Zusammenspiels mit allen produktiven Uploadformularen; diese Integration bleibt bewusst ausstehend.

## Screenshots

- [Kompakter Hinweis auf Handybreite](/Users/markusmueller/.codex/visualizations/2026/10/01/01a0f6ab-47e2-72d2-9d2b-c15137c043fd/rechtshinweis-vorschau-handy.png)
- [Aufgeklappte Erklärung auf Handybreite](/Users/markusmueller/.codex/visualizations/2026/10/01/01a0f6ab-47e2-72d2-9d2b-c15137c043fd/rechtshinweis-details-handy.png)
- [Aufgeklappte Erklärung auf Laptopbreite](/Users/markusmueller/.codex/visualizations/2026/10/01/01a0f6ab-47e2-72d2-9d2b-c15137c043fd/rechtshinweis-details-laptop.png)

Die Bildschirmgrößen sind Browser-Simulationen, keine physischen Geräteprüfungen. Der Uploadbereich in der Vorschau ist beschriftete Darstellung; es wurde dort keine Datei hochgeladen.

## Geänderte Dateien

- `docs/legal-review/2026-10-30/README.md`
- `docs/legal-review/2026-10-30/agb-entwurf.md`
- `docs/legal-review/2026-10-30/uploadhinweise.md`
- `docs/legal-review/2026-10-30/marketingfreigabe-entwurf.md`
- `docs/legal-review/2026-10-30/datenschutz-und-technik.md`
- `docs/legal-review/2026-10-30/umstellung-und-offene-fragen.md`
- `docs/legal-review/2026-10-30/quellen.md`
- `docs/legal-review/2026-10-30/pruefung.md`
- `components/ContentUsageNotice.tsx`, noch ohne Einbindung in aktive Formulare.
- `messages/de.json`, `en.json`, `es.json`, `it.json`, `cs.json`, `hu.json`: ausschließlich neuer Namespace `ContentUsageNotice`.
- `lib/content-usage-notice.test.mjs`.

## Nicht durchgeführt und noch offen

Keine neuen Rechtstexte live gestellt, keine Zustimmungen oder Marketingrechte erzeugt, keine Datenbankmigration ausgeführt und keine Nutzerinhalte verändert. Die bestehenden Rechtstextseiten und Authentifizierungsabläufe bleiben unverändert. Ein Produktionsbuild und Deployment wurden für diese nicht aktivierte Vorbereitung nicht ausgeführt.

Offen sind die anwaltliche Freigabe einschließlich DSA/P2B/Verbraucherrecht, die überprüfte Anbieter- und Vertragskonfiguration, eine belastbare Löschprüfung, Korrektur der irreführenden Anfragebestätigung, die Entscheidung über Replay sowie ein vollständiger Melde-/Entscheidungsweg. Auch der Sonderweg zur Veröffentlichung nicht eingereichter privater Entwürfe benötigt eine belegte Veröffentlichungsgrundlage.

Erst danach die Hinweise in echte Formulare integrieren und mit eigenen Konten vollständige Registrierung, nötige Fassungserfassung, Upload, private Speicherung, Veröffentlichung und Löschung nachweisen. Es wurden keine Testnachrichten, Werbeeinwilligungen oder Vertragszustimmungen an echte Mitglieder versendet.
