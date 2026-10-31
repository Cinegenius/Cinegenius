# Safari-RSC-Anfragen beim Sitzungswechsel

## Anlass und nachgewiesene Abgrenzung

Der Screenshot vom 31.10.2026, 00:36:20 Europe/Berlin zeigt auf dem aktuellen Deployment `dpl_F4dUB2tWWZDbehPvy6icaRSBFyju` viele `Fetch API cannot load ...?_rsc=... due to access control checks`-Einträge. Der vorher zusätzlich identifizierte alte Safari-Tab erklärt diesen neuen Fall ausdrücklich nicht.

Die Fehleradressen entsprechen den vorab geladenen Links aus Fußzeile und Hauptnavigation, darunter Fahrzeuge, Custom Requisiten, Inserat, Projekte, Community und rechtliche Seiten. `Footer` verwendete für alle 19 Inhaltslinks das automatische Next.js-Vorausladen, auch auf den Anmeldeseiten. Die Desktop-Hauptnavigation lud dort zusätzlich die sechs Verzeichnisse vor. Auf `/dashboard` verschwindet die Fußzeile wieder; beim Sitzungswechsel werden außerdem Next-/Clerk-Routen und Caches aktualisiert. Eine sichtbare Fehlermeldung auf der Zielseite kann daher einer zuvor begonnenen Anfrage der Ausgangsseite zuzuordnen sein.

Im begrenzten Produktions-Serverabgleich von 23:35:55 bis 23:36:25 UTC antworteten u. a. `/props`, `/projects`, `/companies`, `/locations`, `/inserat`, `/dashboard`, `/sign-in`, `/sign-up` und die privaten Inbox-Endpunkte erfolgreich. Einige im Screenshot genannte Adressen sind in diesem Ausschnitt nicht enthalten. Daraus lässt sich keine bestätigte serverseitige CORS-Verweigerung ableiten. Es ist auch kein alleiniger Beweis, dass jeder Eintrag ausschließlich ein Browserabbruch ist. Die identifizierte unnötige spekulative Netzwerklast wird gezielt entfernt; Meldungen und Fehlerbehandlung werden nicht unterdrückt.

## Änderungen

- `components/Footer.tsx`: alle 19 Inhalts-/Informationslinks mit `prefetch={false}`. Echte Linknavigation bleibt erhalten, einschließlich Registrierungspflicht am Erstellen-Ziel. Der Footer lädt nicht mehr vorsorglich zahlreiche unabhängige Seiten. Logo, Gestaltung, Texte und Ziele bleiben unverändert.
- `components/Navbar.tsx`: sechs öffentliche Desktop-Verzeichnislinks laden während `/sign-in`, `/sign-up` und einer laufenden Abmeldung keine anderen Bereiche vor. Außerhalb dieser Situationen bleibt das bisherige Next.js-Standardverhalten erhalten. Die ausdrücklich vorausgeladenen direkten Anmelde-/Registrierungslinks bleiben unverändert.
- `lib/auth-prefetch.test.mjs`: tatsächliche Komponenten mit kontrollierten Hook-/Link-Adaptern in allen sechs Sprachen rendern. Alle 19 Footerziele vorhanden und ohne Vorab-Anfrage; alle sechs Hauptziele auf Authrouten ohne Prefetch; direkte Anmelde-/Registrierungslinks weiter mit Prefetch; Standardverhalten der Hauptnavigation auf normalen Seiten erhalten.

Keine CSP-/CORS-Erweiterung, kein Abschalten von Clerk-Sitzungsprüfungen, keine Änderungen an Nachrichtenberechtigungen oder gespeicherten Inhalten. Keine neuen Oberflächentexte und keine Abhängigkeiten.

## Tatsächlich geprüfte Abläufe

- 30 neue Renderprüfungen, insgesamt 437 gezielte Auth-/Navigation-/Datums-/Inbox-/Footer-Zugriffstests bestanden.
- TypeScript, ESLint der beiden betroffenen Komponenten, sechs Sprachkataloge und Produktionsbuild bestanden.
- Lokaler Produktionsbrowser mit derselben Next.js-Version und der tatsächlichen geänderten Footerkomponente: Impressumslink öffnen und über Browser-Zurück zur ursprünglichen Seite zurückkehren; keine Konsolenfehler. Auch der Vergleichslink vor der Änderung bleibt navigierbar. Keine zusätzlichen Zwischenansichten.

Eine quantitative Vorher-/Nachher-Messung des automatischen Prefetch-Volumens ließ sich im isolierten Browserfixture nicht zuverlässig auslösen; daraus wird kein gemessener Reduktionswert behauptet. Das explizite Verhalten der tatsächlichen Linkkomponenten ist über ihre übergebenen Eigenschaften geprüft. Die Produktions-Safari-Sitzungswechsel sind separat zu kontrollieren.

## Grenzen

Der vollständige echte Safari-Ab-/Anmeldevorgang nach diesem Schritt ist noch nicht als bestanden dokumentiert. Der bisherige Nutzer-Test bestätigte funktionierende An-/Abmeldung, aber eben diese neuen RSC-Einträge. Keine pauschale Aussage, dass sämtliche WebKit-Abbruchmeldungen beseitigt seien. Reale mobile Gerätetests und ein neuer Kontowechsel wurden in diesem Nachschritt nicht durchgeführt.

Primärgrundlage: installierte Next.js-Dokumentation `node_modules/next/dist/docs/01-app/02-guides/prefetching.md` und `03-api-reference/02-components/link.md`: `prefetch={false}` verhindert automatisches Vorausladen; die normale Linknavigation bleibt bestehen.

## Gemeinsamer Safari-Test am Morgen und verbleibender privater Link

Der Nutzer hat An- und Abmeldung anschließend bewusst getrennt durchgeführt. Nach „angemeldet“: `/dashboard`, keine roten Konsoleneinträge, drei Schriftlade-Warnungen. Im begrenzten Server-Prüffenster ab 07:56:50 UTC antworteten Dashboard und beide Inbox-Endpunkte ausschließlich mit 200 (18 Notifications-, 17 Unread- und drei Dashboard-Antworten). Die Abfrage ist zeit-/deploymentbegrenzt, kein Protokoll aller Konten oder aller vorherigen Schritte.

Nach dem getrennten Abmelden: öffentliche Startseite mit Anmelden-/Registrierungslinks; Safari-Konsole ab 09:00:34 Europe/Berlin enthält **genau eine** verbliebene `Fetch API cannot load`-Meldung zu `/dashboard?tab=listings&_rsc=...`. Dieser konkrete Fall stammt aus der weiterhin automatisch vorausladenden gemeinsamen persönlichen Navigation. Der Anmeldeschritt und der Fehler beim Abmelden werden deshalb nicht mehr gleichgesetzt.

Zusätzliche minimale Korrektur: `components/PersonalAreaNavigation.tsx` setzt `prefetch={false}` an den drei gemeinsam gerenderten Linkstellen (Hauptziele für Desktop/Mobil, zusätzliche Bereiche, Sicherheit). Links, aktuelle Auswahl, Nachrichtenanzeige, Rechte, Entwurfsschutz und tatsächliche Navigation bleiben unverändert. Keine weiteren Änderungen an Clerk, CSP, Weiterleitungen oder Datenbank. Keine Annahme, ein Umbenennen des Fehlers oder eine breite CORS-Freigabe würde die Ursache lösen.

`lib/auth-prefetch.test.mjs` rendert jetzt auch die tatsächliche persönliche Navigation für alle sechs Sprachen mit geschlossenem und geöffnetem Mehr-Menü. Alle acht Desktop-/Mobil-Hauptlinks und die neun zusätzlichen Ziele bleiben erreichbar und laden keine privaten Seiten spekulativ vor. Auf öffentlichen/Auth-Seiten erscheint diese Navigation weiterhin nicht. 450 gezielte Tests, TypeScript, ESLint, Sprachprüfung und Produktionsbuild bestanden.

Der vollständige erneute Safari-Abmeldevorgang nach dieser zusätzlichen privaten Navigationskorrektur ist vor Veröffentlichung noch offen. Der vom Nutzer bereits tatsächlich durchgeführte Ablauf ist oben dokumentiert; er wird nicht nachträglich als fehlerfrei umgedeutet.
