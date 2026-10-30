# Clerk-CSP und Nachrichtenabfragen – 30.10.2026

## Nachgewiesener Ausgangszustand

Lesender HTTP-Abgleich der produktiven Startseite, der Weiterleitung von `cinegenius.co` nach `www.cinegenius.co` und von `/sign-in`:

- HTTP 200, jeweils genau ein CSP-Header, kein zusätzlicher CSP-Meta-Tag.
- Startseite: 35 Skripte, davon 34 mit passender Nonce. Das Clerk-Skript von `clerk.cinegenius.co/npm/@clerk/clerk-js@6/dist/clerk.browser.js` hatte keine Nonce.
- Anmeldung: 25 Skripte, davon 24 mit passender Nonce. Wieder fehlte sie ausschließlich beim Clerk-Skript.
- Der Screenshot zeigt genau diese Blockierung sowie wiederholte 401-Antworten für Nachrichten und Benachrichtigungen trotz eines sichtbaren Namens.

Der installierte Next.js-Clerk-SDK 7.9.21 rendert den Server-Skriptslot mit der Nonce nur bei `ClerkProvider dynamic`. Dieser Schalter fehlte. Hostfreigaben allein helfen bei der bestehenden `strict-dynamic`-Richtlinie nicht. Zusätzlich wurde die eigene CSP bisher nur auf die Antwort gesetzt; sie wird jetzt identisch an die serverseitige Darstellung weitergereicht.

Unabhängig davon gab es eine unbegrenzte Fehlerwiederholung: Navbar und beide gleichzeitig montierten, über CSS umgeschalteten NotificationCenter-Varianten hatten eigene Intervalle. Bei angemeldeter Anzeige konnten damit drei Zähler- und zwei Benachrichtigungsabfragen pro Intervall entstehen. Fehlgeschlagene Antworten wurden ignoriert; 401 stoppte die Intervalle nicht. Ein Netzfehler konnte in der Oberfläche wie eine leere Liste aussehen. Ein ungültiger Client-/Server-Sitzungszustand konnte daher die im Screenshot sichtbare Folge auslösen und dauerhaft fortsetzen.

Die tatsächliche Sitzung aus dem Screenshot wurde nicht ausgelesen. Dass sämtliche dortigen 401 ausschließlich durch die blockierte Skriptdatei entstanden, ist daher **nicht** abschließend bewiesen.

## Korrekturen und Dateien

- `app/layout.tsx`: vorhandener ClerkProvider mit `dynamic`; vorhandene Anmeldung und Weiterleitungen bleiben erhalten.
- `proxy.ts`: identische Nonce/CSP für Darstellung und Antwort. `strict-dynamic`, vorhandene Zugriffskontrollen und Same-Host-Weiterleitungen bleiben bestehen. Ergänzt sind die von Clerk dokumentierten Cloudflare-Challenge- und Protect-Quellen, mit abweichenden Ports ausschließlich für den ausgewiesenen Protect-Verbindungsbereich. Keine allgemeine Skript-/Verbindungsfreigabe, kein SDK-Upgrade.
- `lib/inbox-polling.ts`: eine gemeinsame, zeitlich begrenzte und abbrechbare Anfragegruppe; SDK-Token vor geschützten Anfragen; 401 löscht den privaten Snapshot und sperrt weitere automatische Abrufe bis zum gezielten Wiederholungsversuch beziehungsweise einer neuen Sitzung. Netzwerkfehler bleiben Fehler und lösen keine Abmeldung aus. Wiederholungen nach Verbindungsfehlern erfolgen mit wachsendem Abstand. Ein bereits bestätigter Lesestatus wird nicht durch eine ältere Antwort überschrieben.
- `lib/use-authenticated-inbox.ts`: Abrufe nur nach abgeschlossener Initialisierung einer aktiven, zu Benutzer und Sitzung passenden Clerk-Sitzung. Ein Intervall für beide Header-Varianten, keine Abrufe im unsichtbaren/offline Tab. Abbruch, Entfernen von Listenern und Zurücksetzen nutzerbezogener Zustände bei Sitzungswechsel/Abmeldung. Vorher begonnene Abfragen werden nach einer bestätigten Nachrichtenlesung verworfen und einmal aktualisiert.
- `components/Navbar.tsx`: nutzt den gemeinsamen Abruf statt eines eigenen Nachrichtenintervalls. Ein bestätigtes Sitzungsproblem wird nicht weiter als gültige Anmeldung dargestellt.
- `components/NotificationCenter.tsx`: nutzt denselben Snapshot für Desktop und Handy; unterscheidet Laden, Gast, echte leere Liste, Verbindungsfehler und ungültige Sitzung. Gezieltes Wiederholen sowie Anmeldung mit Rückkehr zu Benachrichtigungen. Kein automatisches Weiterleiten oder Neuladen.
- `app/api/unread-count/route.ts`, `app/api/notifications/route.ts`: auch die Handler selbst antworten bei Gästen mit nicht zwischenspeicherbarer 401 statt falschem Erfolg. Datenbankfehler werden als Fehler geliefert; „alle gelesen“ meldet bei fehlgeschlagener Speicherung keinen Erfolg mehr. Datenabfragen bleiben auf die aktuelle Benutzerkennung begrenzt.
- `messages/{de,en,es,it,cs,hu}.json`: fünf Meldungen/Aktionen je Sprache ergänzt.
- Tests: `lib/inbox-polling.test.mjs`, `lib/auth-inbox-integration.test.mjs`, Ergänzung von `lib/private-api-auth.test.mjs` und Anpassung des Navbar-Mocks in `lib/admin-navigation.test.mjs`.

Keine Datenbankänderung. Keine bestehenden Profile, Bilder, Nachrichten, Zugangsdaten oder Sicherheitsrollen geändert.

## Tatsächlich bestandene Prüfungen

35 gezielte automatisierte Tests mit synthetischen Konten/Antworten und echten Komponenten beziehungsweise API-Handlern:

```
node --experimental-strip-types --import ./scripts/register-test-aliases.mjs --test \
  lib/auth-inbox-integration.test.mjs lib/inbox-polling.test.mjs \
  lib/private-api-auth.test.mjs lib/admin-navigation.test.mjs \
  lib/admin-loading.test.mjs lib/auth-redirect.test.mjs lib/unread-count-store.test.mjs
```

Abgedeckt: frische und unverfälschbare Nonce, identische CSP in Request/Response, dynamischer Clerk-Skriptslot des installierten SDK; Gast ohne Datenbank- oder Nachrichtenabruf; aktive Sitzung als Voraussetzung; ein gemeinsamer Abruf bei parallelen Verbrauchern; kein weiteres HTTP nach 401, auch nach 100 simulierten Wiederholungen; explizite Wiederaufnahme; fehlendes Token; Netzwerk-/Datenbankfehler; langsame Antworten; Timeout einschließlich Tokenbeschaffung; Abbruch und verspätete Altantwort nach Kontowechsel; React-Effect-Neustart; korrektes und bestätigtes Markieren als gelesen; keine Rückkehr veralteter Zähler nach einem Leseereignis; Benutzereinschränkung der echten Handler; bestehende Adminlinks und sichere Rücksprungadressen. Fehler-/Gast-/Lade-/Leerzustände sind mit allen sechs Katalogen gerendert geprüft.

Produktionsbuild (`npm run build`) nach den letzten Codeänderungen bestanden.

Zusätzlich: TypeScript, ESLint der betroffenen Produktionsdateien, `check:i18n`, `check:design` und `git diff --check` bestanden. Übersetzungsprüfung: sechs Kataloge mit 1902 Schlüsseln, keine neuen unübersetzten Oberflächentexte. Der vorhandene Übersetzungsrückstand außerhalb der Änderung bleibt bestehen.

## Browserprüfung und Grenzen

Lokale, ausdrücklich als Simulation gekennzeichnete Testansicht außerhalb des Repositorys: echte NotificationCenter-Komponente und echter Anfrage-Controller mit ausschließlich synthetischen Antworten. Keine temporäre Testseite und keine Authentifizierungsumgehung wird ausgeliefert.

- Native Safari auf dem Mac: Gast ohne Abruf, eigenes simuliertes Konto, 401 und verständlicher Sitzungsstatus. Der Abfragezähler blieb auch bei späterer erneuter Kontrolle unverändert; keine automatische HTTP-Wiederholung.
- In-App-Browser: simulierter Gast, Konto A/B, Abmeldung, gezielter erneuter Versuch, erfolgreicher Leerzustand, Verbindungsfehler und langsame Antwort.
- Breiten 390, 768 und 1366 CSS-Pixel: kein horizontaler Seitenüberlauf; das geöffnete Fenster bleibt innerhalb des Bildschirms. Alle sechs Sprachversionen des Fehlerfensters auf 390 Pixel geprüft.
- Kein echter iPhone-/Android-Gerätetest; die schmalen Breiten sind Simulationen.

Ein lokaler Start des vollständigen Produktionsbuilds war wegen fehlender lokaler Clerk-Schlüssel nicht verwendbar; die aufgerufenen Seiten/Handler lieferten deswegen 500. Dies ist **kein** bestandener Login-Test. Es wurden keine Schlüssel erzeugt, Sicherheitsregeln umgangen oder Produktionsgeheimnisse kopiert. Der Testserver wurde beendet.

Noch offen vor einer abschließenden Erfolgsaussage zur produktiven Anmeldung: echter Login mit kontrolliertem Testkonto, Nachrichten/Benachrichtigungen, Neuladen, Navigation, Logout und Kontowechsel mit der korrigierten Version; ausgelieferte Nonce und ausbleibende 401-Schleifen auf dem Deployment erneut prüfen. Nicht allein von einem Namen im Header oder einem bestandenen Build auf eine gültige Sitzung schließen.

## Primärquellen

- [Clerk: CSP und dynamischer Provider](https://clerk.com/docs/guides/secure/best-practices/csp-headers), am 30.10.2026 abgerufen.
- Lokale Next.js-16.4.3-Dokumentation: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.
- Installierter SDK-Code: `app-router/server/ClerkProvider.js`, `DynamicClerkScripts.js` und `utils/clerk-script-tags.js` unter `node_modules/@clerk/nextjs/dist/esm/`.
