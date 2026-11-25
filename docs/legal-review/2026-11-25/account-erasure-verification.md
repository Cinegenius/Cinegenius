# Prüfbeleg: Löschautomatik und geänderte AGB-Klausel

Stand: 25. November 2026. Unveröffentlichter Entwicklungsstand auf `codex/privacy-review-20261125`. Keine Produktionsmigration, keine Aktivierung, keine echten Kontolöschungen, keine versendeten E-Mails und keine native Geräteabnahme.

## Tatsächliche Ergebnisse

| Prüfung | Ergebnis | Nachweis im Prüfverzeichnis |
| --- | --- | --- |
| Gesamtlauf mit 417 Testdateien | 6.343 Tests: 6.077 bestanden, 266 fehlgeschlagen, keine übersprungenen oder abgebrochenen Tests | `suite.log`, `suite-result.json` |
| Gezielte Wiederholungen nach Korrektur veralteter Testaufbauten | 610/610 bestanden; decken alle 19 im Gesamtlauf fehlgeschlagenen Testdateien sowie zusätzliche geänderte Testdateien ab | `suite-reconciliation.json` und die darin genannten vier Protokolle |
| Löschablauf, API, Client, Webhook, Nachrichten, Proxy und Scheduler | 125/125 bestanden | `final-privacy-tests.log` |
| Aktuellste SQL-/Worker-Prüfung nach den letzten Schutzergänzungen | 26/26 bestanden | `final-sql-worker-tests.log` |
| Fehler beim Authentifizierungsanbieter und Kontolösch-API | 33/33 bestanden; überschneidet sich mit anderen Teilprüfungen | `final-auth-erasure-tests.log` |
| Tatsächliche React-Komponenten in Browser-Testumgebung | 35 Fälle bestanden: 17 Sprachen, schmale Ansichten, Bedienelemente, Eingabeerhalt, verspätete Antworten nach Kontowechsel | `browser-results.json`, Bildschirmabbilder und Testaufbau |
| Gezielte Codeprüfung der neuen/veränderten Ablaufmodule | Erfolgreich, Exit 0 | `verified-lint.log`, `verified-lint-result.json` |
| Abschließender Produktionsbuild, ausschließlich lokal | Erfolgreich, Exit 0, abgeschlossen um 18:02:40 UTC; einschließlich TypeScript und Sprachprüfung mit 17 Katalogen / 11.823 Schlüsseln | `final-build.log`, `final-build-result.json` |
| Lokal gestarteter fertiger Build, nur Loopback | 6/6 Prüfungen bestanden: gleichnamiger Host beim Anmeldeverweis, geschützte Konto-/Scheduler-Zugänge, neuer deutscher AGB-Originaltext in deutscher und englischer Oberfläche | `built-server-checks.json` |

Der Gesamtlauf lief während der Aufarbeitung älterer Testaufbauten. Er ist **kein grüner Gesamtlauf des abschließenden Commits**. Nach den Korrekturen wurden die betroffenen Dateien gezielt wiederholt; der vollständige Lauf wurde nicht nochmals gestartet. Die 610 erfolgreichen Nachprüfungen machen den ursprünglichen roten Lauf nicht nachträglich grün. Die genannten Teilprüfungen überschneiden sich und werden nicht zu einer künstlichen Gesamtsumme addiert.

Die Korrekturen an bestehenden Tests folgen dem aktuellen Produktverhalten: tatsächlich vorhandene Navigations-/Filtermodule, freigegebene öffentliche Leseansichten, 17 unterstützte Sprachen und die bereits auf `main` eingeführte optionale Zusatzberufsauswahl. Die Prüfung einer ungültigen Zusatzrolle bleibt bestehen; zusätzlich wird jetzt die zulässige Auswahl ohne Zusatzrolle geprüft. Es wurde dafür kein Produktverhalten zurückgesetzt.

Der Build meldete außerdem `Recommendations unavailable` für die Startseitenempfehlungen. Er schloss erfolgreich ab; daraus wird kein Nachweis der Verfügbarkeit personalisierter Produktionsdaten abgeleitet. Bestehende vollständige Dashboard-Lintfehler aus der früheren Prüfung werden durch den gezielten erfolgreichen Lintlauf nicht als behoben dargestellt.

## Grenzen und Freigabestatus

Die SQL-Tests verwenden eine isolierte PostgreSQL-kompatible PGlite-Umgebung mit synthetischen Konten. Browserprüfungen verwenden die echten neuen Komponenten und Styles mit kontrollierten Authentifizierungs-/API-Antworten. Testdateien mit „native“ im Namen prüfen Web-Komponenten mit App-Einstellungen; sie sind keine echten iOS-/Android-Prüfungen. Kein tatsächlicher angemeldeter Zwei-Konten-Ablauf und kein Restore einer Produktionssicherung wurden durchgeführt.

Die Löschautomatik bleibt gesperrt. Betreiber, geltende Anbietervereinbarungen, tatsächliche Fristen, gemeinsame Inhalte, Ereigniskonfiguration bei Clerk und ein vom zurückgesetzten Datenbankstand unabhängiger Lösch-/Sperrnachweis benötigen weitere Arbeit und Belege. Die neue Klausel beseitigt keine bestehenden vertraglichen Ansprüche. Siehe [AGB-Entwurf](agb-loeschung-entwurf.md) und [Ablauf mit offenen Voraussetzungen](../../privacy/account-erasure.md).

Originalnachweise: `/srv/cinegenius/audits/20261125-account-erasure/`. Der externe Abschlussbeleg hält den geprüften Commit und Datei-/Patch-Prüfsummen fest. Produktionsstatus bleibt **nicht veröffentlicht**.
