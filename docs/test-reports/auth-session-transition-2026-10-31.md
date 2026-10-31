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

## Nachtest: vorläufiger Clerk-Zustand ebenfalls berücksichtigen

Der Nutzer meldete nach Veröffentlichung von `d04b079` weiterhin rote Meldungen
bei funktionierender An-/Abmeldung. Damit ist das Konsolen-Erfolgskriterium für
diese Veröffentlichung nicht bestanden.

Die bisherige lokale Nachstellung bildete nur `session=null, isLoaded=true` ab.
Der tatsächlich ausgelieferte Clerk-Code setzt beim Beginn von `signOut`
zunächst `session=undefined` und sendet diesen Ressourcenstand an seine Listener.
Der installierte `useSessionBase` liest diesen Stand; `useSession` liefert dafür
`isLoaded=false`, obwohl die bereits initialisierte Clerk-Instanz weiter
`loaded=true` ist. Die bisherige Bedingung wartete auf `isLoaded=true` und ließ
die alte Seite in dieser früheren Phase noch stehen. Das ursprüngliche Testmodell
hatte diesen Unterschied übersehen.

Ein neuer Regressionstest führt die tatsächlichen installierten Module
`@clerk/shared/dist/react/hooks/base/useSessionBase.js` und
`@clerk/shared/dist/react/hooks/useSession.js` mit kontrolliertem Ressourcenstore
aus. Er reproduzierte vor der Ergänzung einen fehlschlagenden Test: die alte
private Kindkomponente wurde im vorläufigen Abmeldezustand noch ausgeführt.
Der lokale Kandidat prüft nun zusätzlich das öffentliche `clerk.loaded`. So
entfernt er die alte Seite bereits in dieser Phase, ohne die initiale
SDK-Hydrierung vorzuladen oder private Gastinhalte freizugeben.

Nach der Ergänzung: 77 gezielte Tests bestanden, einschließlich beider
Abmeldezustände in allen sechs Sprachen und unverändertem ersten Serverrender.
TypeScript, Komponenten-Lint und Sprachprüfung bestanden. Die lokale
Produktions-Browsernachstellung verglich die tatsächliche vorherige und neue
Komponente mit `session=undefined, isLoaded=false, clerk.loaded=true`: vorher
blieben Profil-/Inserat-/Startseitenlinks vorhanden, nachher verschwanden sie
sofort zugunsten des Status. Die bestätigte neue Serverantwort beendet diesen
Status ohne Timer.

Ein separater generischer Fetch-während-Dokumentwechsel-Vergleich auf localhost
reproduzierte die Safari-Konsolenfehler nicht: alle drei Testanfragen erhielten
200. Er ist kein Nachweis für die Fehlerursache auf CineGenius. Auch die
oben beschriebene SDK-Lücke allein beweist noch nicht, dass der verbleibende
Safari-Fehler damit vollständig beseitigt ist. Dafür stehen weiterhin die genaue
Zuordnung im aktuellen Safari-Fenster und ein echter Nachtest aus.

## Native Safari-Reproduktion vor Veröffentlichung der Ergänzung

Im vom Nutzer freigegebenen Safari-Fenster war zunächst ein älterer Startseitentab
mit `dpl_7FMaKagdpWATcmBjPWaQC95aLCCu` und der früheren Clerk-CSP-Sperre geöffnet.
Nur diesen Startseitentab neu geladen: danach eindeutig
`dpl_FksmXncJuPqtvFYd5R7b5KuYTJVW`, aktive Sitzung, keine roten Meldungen.
Diese alte Tabversion erklärt ausdrücklich nicht sämtliche früheren Tests.

Dann im so bestätigten aktuellen Tab einmal über das Kontomenü abgemeldet.
Während des Übergangs waren vier neue RSC-Zugriffsfehlermeldungen für `/search`,
`/dashboard`, `/ki-transparenz` und `/locations` sowie zwei `TypeError: Load failed`
sichtbar. Vorübergehend erschien die vorhandene App-Fehleransicht. Anschließend
schloss die Dokumentnavigation ab und die normale öffentliche Startseite mit
Anmelden/Registrieren war wieder sichtbar. Das ist eine echte Reproduktion des
Übergangsfehlers auf der aktuellen vorherigen Version, kein fehlerfreier Test.

Ohne aktiviertes dauerhaftes Netzwerkprotokoll wurden die alten Anfragen bei der
abschließenden Dokumentnavigation ersetzt. Es wird deshalb kein nicht beobachteter
HTTP-Status dieser vier Fehlversuche behauptet. Keine Cookies, Tokens, Codes,
Kennwörter oder privaten Nachrichteninhalte wurden für diesen Test ausgelesen.
Der Nachtest mit der ergänzten frühen Zustandsprüfung steht noch aus.
