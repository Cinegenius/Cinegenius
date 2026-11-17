# Berufliche News-Vorauswahl – 17. November 2026

Basis: `fbaef73d85a1992675c7841ab580d04bf9455ace`, Branch
`codex/smart-guided-discovery`. Vertrag: `docs/home-news-topics.md`.

## Verhalten

Technische gespeicherte Tätigkeiten wählen ohne eigene Themenwahl `technology`
vor. Startseite und `/news` verwenden denselben Resolver. Direkte Themenlinks
und die eigene gespeicherte Auswahl einschließlich `all` haben Vorrang.
Explizite Themenwechsel, Entfernen und Zurücksetzen gelten anschließend auf
beiden Seiten; Suche oder Öffnen allein speichert keine abgeleitete Vorliebe.
Der Länderfilter bleibt unverändert.

Nur die aktuellen eigenen Berufsangaben werden bei Bedarf serverseitig gelesen.
Kein fremdes Konto, kein öffentliches Profil-Mirroring, keine neuen Tabellen,
keine Profiländerung, kein KI-Aufruf und kein zusätzlicher Client-Berufskatalog.
Crew-Kacheln/-Liste/-Karte sowie die anderen Directory-Entwürfe wurden in dieser
Änderung nicht bearbeitet. Die aktuelle Crew-Ansicht bleibt ausdrücklich erhalten.

## Prüfung

- 70 gezielte Tests bestanden: Berufskatalog/Altangaben/mehrdeutige Tätigkeiten,
  Profile ohne Angaben, kontogebundene Auswahl und Kontowechsel, Gastverhalten,
  URL-Vorrang, explizites `all`, Datenfehler und Wiederholung, Cookie-Fehler mit
  erhaltenem Entwurf, bestehende regionale Filter und News-/Organisationsdarstellung.
- Alle 17 Kataloge geprüft (11.045 Schlüssel, keine neuen UI-Literale).
  Der neue Zustand nutzt ausschließlich vorhandene Übersetzungen. Alle 17
  Sprachen sind in den ausgewählten Komponenten-/Server-Tests enthalten.
- Gemeinsame Designprüfung und gezieltes ESLint bestanden.
- Vollständiger Build einschließlich TypeScript bestanden. Der erste Lauf
  stoppte nach dem bereits bekannten Next.js-Upgradehinweis. Der normale
  Wiederholungslauf war erfolgreich; die Sicherheitswarnung ist damit **nicht**
  behoben und bleibt separat offen. Keine Paketversion wurde verändert.
- Die neue Select-Abfrage wurde zusätzlich schreibfrei gegen eine absichtlich
  nicht vorhandene Testkonto-ID ausgeführt: gültiger Query-Vertrag, `null` ohne
  Datenfehler. Es wurden dafür keine Mitgliederprofile gelesen oder verändert.

## Browser

Browser-Plugin nicht verfügbar; vorhandenes Playwright/Chromium verwendet.
Lokaler Produktionsbuild unter `http://localhost:3037`, nachweislich ausschließlich
an `127.0.0.1` gebunden. Keine veröffentlichte Testseite und kein Auth-Bypass.

Sechs Fälle bestanden: Deutsch bei 320, 390, 834 und 1440 CSS px, Englisch und
Japanisch bei 390 px. Eine gespeicherte Technik-Auswahl wird in `/news` korrekt
angezeigt. „Alle“ lässt sich speichern, bleibt auf der Startseite erhalten und
kann dort durch ein tatsächlich angebotenes Thema ersetzt werden. Das Thema
wird beim erneuten Newsbesuch und bei echter Browser-Zurück-Navigation erhalten.
Auswahlziele mindestens 44 px hoch; kein horizontaler Überlauf. Screenshots
vorhanden. Keine JavaScript-Laufzeitfehler oder Framework-Fehleransicht.

Die Konsole meldete HTTP 400 vom produktiven Clerk-SDK auf localhost sowie bei den späteren wiederholten
Durchläufen zusätzliche HTTP 429. Diese Ausgaben sind in den Browserbelegen
erhalten; eine bestandene Interaktion bedeutet keine fehlerfreie Netzwerkkonsole.
Die ergänzende Netzdiagnose bestätigte die 400-Antworten von
`clerk.cinegenius.co/v1/environment` und `/v1/client`; sie zeigte keine 429 mehr.
Die genaue Quelle der vorherigen 429 wurde in der ersten Serie nicht
mitgeschnitten. Die ursprünglichen Befunde bleiben deshalb im Beleg erhalten.

Die automatische Ableitung aus einem echten angemeldeten Benutzerkonto wurde
in der Browserumgebung nicht getestet; dafür sind serverseitige kontrollierte
Profil-/Auth-Fälle vorhanden. Kein Safari-, physischer iPhone/iPad- oder nativer
Xcode-Test. Die App-Übernahme und deren Gerätetest erfolgen getrennt.

## Übergabe und Veröffentlichung

Die Änderung veröffentlicht keine Artikel und verändert keine News-Automation.
Agent NEWS erhält den Themenvertrag; APP Entwicklung erhält Commit, Prüfungen,
native Auswahlregeln und diese Grenzen. Kein Livegang im Rahmen dieser Prüfung.
Die Freigabe und die geschützte Veröffentlichung vom sauberen Hauptstand stehen
separat an. Andere vorbereitete Smart-/Directory-Arbeiten sind keine impliziten
Bestandteile dieser Veröffentlichung.

Belege: `/srv/cinegenius/research/20261117-news-topic-default/`
(Test-/Build-/i18n-Protokolle, Browser-Skript, Screenshots und Ergebnis-JSON).
