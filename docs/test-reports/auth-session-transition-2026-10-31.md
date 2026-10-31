# Sitzungswechsel: alte Seite nicht als Gast neu aufbauen

## Anlass und gesicherte Beobachtungen

Auch der Safari-Screenshot vom 31.10.2026, 10:15:30 zeigt auf dem Deployment
`dpl_ersmSPE8XyDZVaDu2eQgoLerABrC` drei rote RSC-Meldungen für `/profile`,
`/inserat` und `/`. Die vorherige Veröffentlichung hat dieses Erfolgskriterium
also nicht erfüllt.

Im zuvor gemeinsam aufgenommenen Safari-Verlauf stimmten die drei vollständigen
Fehleradressen mit GET-Anfragen überein, die um 08:44:08 UTC HTTP 200 und
`text/x-component` erhielten. Es waren gleichursprüngliche Route-Tree-Prefetches
(`next-router-prefetch: 1`, `next-router-segment-prefetch: /_tree`). Die roten
Meldungen erschienen beim späteren Abmelden um 08:44:43 UTC. Clerk bestätigte
den Abmeldeaufruf mit HTTP 200. Das beweist keine CSP- oder CORS-Verweigerung;
es beweist allein aber auch nicht den vollständigen internen Safari-Abbruchweg.

## Nachgewiesene zusätzliche Ursache im Anwendungscode

Die ausgelieferte Clerk-JS-Fassung leert ihre lokale Sitzung, bevor das Entfernen
der Serversitzungen und die Navigation abgeschlossen sind. Die bisherige
`AuthSessionBoundary` wechselte dann von der serverbestätigten Session-ID zum
Fragment-Schlüssel `signed-out`. Dadurch wurde der noch alte, authentifiziert
gerenderte Seitenbaum vollständig neu als Gast gemountet. Seine Mount-Effekte
und Links können somit während der laufenden Abmeldung erneut starten.

Eine isolierte lokale Produktionsnachstellung mit derselben Next.js-Version und
der unveränderten ursprünglichen Komponente bestätigte im Browser die Folge:
`Seite neu aufgebaut: angemeldet` → `Abmelden angeklickt` →
`Seite neu aufgebaut: abgemeldet`. Dabei wurden keine echten Konten verwendet.

## Lokaler Korrekturkandidat

- `components/AuthSessionBoundary.tsx`: Sobald der aufgelöste Client keine Sitzung
  mehr hat, der gelieferte Serverbaum aber noch eine Session-ID trägt, wird dieser
  alte Baum entfernt und nicht erneut als Gast gemountet. Ein kurzer übersetzter
  Status ersetzt ihn, bis die reguläre Clerk-Navigation beziehungsweise der
  Server-Refresh den neuen Baum liefert. Keine künstliche Wartezeit oder eigene
  automatische Neuladeschleife. Ein ausdrücklich anklickbarer nativer Startseitenlink
  ermöglicht eine frische Serverantwort auch bei fehlgeschlagener SDK-Navigation.
- `messages/{de,en,es,it,cs,hu}.json`: die beiden Status-/Linktexte.
- `lib/admin-loading.test.mjs`: die neue Logout-Grenze prüfen; unveränderte
  Hydrierung und Kontowechsel behalten ihre bisherigen Fragment-Schlüssel.
- `lib/auth-session-transition.test.mjs`: reale Komponente mit kontrolliertem
  Sitzungszustand rendern. Während des Übergangs darf der private Kindbaum nicht
  ausgeführt werden. Gäste, Serverabgleich und wiederhergestellte Sitzung prüfen.

Keine weiteren Änderungen an Links, Clerk-Aufrufen, CSP, CORS, privaten APIs,
Sitzungsisolation, Formularschutz oder Datenbank. Kein Commit oder Deployment
für diesen Kandidaten in dieser Prüfphase.

## Tatsächlich bestanden

- 70 gezielte Tests einschließlich Auth-Navigation, Prefetch-Einstellungen,
  Inbox, private API-Ablehnungen und Admin-Sitzungszustände.
- TypeScript, ESLint der geänderten Komponente und `git diff --check`.
- Sprachprüfung: sechs Kataloge, 1904 Schlüssel, keine neuen unlokalisierten Texte.
- Produktionsbuild der Anwendung.
- Browsernachstellung mit der tatsächlichen Kandidatenkomponente: beim Löschen
  der simulierten Sitzung erscheint der Übergang ohne erneuten Gast-Mount des
  alten Dashboards. Wiederherstellen der Sitzung zeigt es wieder als angemeldet.
  Eine bestätigte öffentliche Serverantwort beendet den Übergang sofort.

## Noch offen / keine weitergehende Behauptung

Die Nachstellung verwendet kontrollierte Sitzungszustände im integrierten Browser,
keine echte Clerk-Abmeldung. Die drei ursprünglichen Safari-Konsolenfehler wurden
in dieser isolierten Nachstellung nicht selbst reproduziert. Ein zusätzlicher
lokaler Testtab in nativem Safari ließ sich wegen unterbrochener Browsersteuerung
nicht zuverlässig öffnen. Der echte Safari-End-to-End-Test mit dem Kandidaten
und ein erneuter Mobilgerätetest stehen aus. Deshalb ist weder die vollständige
Ursache der Safari-Meldungen noch ihre Beseitigung durch diesen Kandidaten als
bewiesen dokumentiert.

Verwandter, vom WebKit-Team bestätigter Abbruchmechanismus, ausdrücklich keine
alleinige Diagnose für CineGenius:
https://github.com/microsoft/playwright/issues/43120
