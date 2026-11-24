# Work: einfache Nachrichtengruppen · 24. November 2026

## Auftrag und Stand

Markus verlangt in Work → Team → Nachrichten eine senkrechte Gruppenliste und
oben ein Plus zum Anlegen. Nur aktuelle Online-Team-Admins dürfen Gruppen
anlegen; berechtigte Mitglieder treten selbst bei. Direkte Betreibertexte im
lokalen APP-Auftrag vom24.11.: `01a20e2a-dc44-7583-8a04-a5100111ea02` und
`01a20e2b-5d30-7fd0-a068-aeb76426e16d`. Die ausdrücklich beauftragte Abstimmung
zwischen APP und WEB gilt weiter. Editor, Dokumentenordner und Teilen bleiben
getrennte Arbeitspakete.

Quellbasis ist `3a766008`; die bereits veröffentlichte Authkontextkorrektur
`2e5ce070` und die neuere Mail-Quellarbeit bleiben erhalten. Frische lesende
www-Prüfung vor dieser Änderung bestätigt weiterhin
`dpl_94Eh94YmSfPn9B7BSs4jvRgaX5rA` als READY. Die Gruppenfassung ist zunächst
ein lokaler Kandidat, kein veröffentlichter oder physisch abgenommener Stand.

## Bedienung und Vertrag

- Gruppen stehen in einer Liste. Der Plusknopf erscheint bei der aktuell vom
  Server bestätigten Adminrolle. Name genügt; eingeschränkte Sichtbarkeit bleibt
  unter den erweiterten Einstellungen verfügbar.
- Ein berechtigter Beitritt öffnet nach bestätigter Antwort die Unterhaltung.
  Bereits beigetretene Mitglieder öffnen sie direkt. Gruppenoptionen,
  Mitgliederverwaltung und Verlassen bleiben erreichbar, aber eingeklappt.
- Fehlende Beitrittsrechte werden angezeigt. Adminrolle allein gewährt keine
  Gesprächsteilnahme oder frühere Nachrichten. Die bisherigen individuellen
  Lese-/Beitritts-/Schreibrechte und Beitrittszeitgrenzen bleiben maßgeblich.
- Lokale, unverbundene Teams werden ausdrücklich mit einem vorhandenen
  Online-Team verbunden. Der Klick prüft die aktuelle aktive Mitgliedschaft
  nochmals serverseitig. Konto, Team, Container und Lease müssen bis zum
  anschließenden nativen `link` übereinstimmen. Lokale Namen und Rollen sind kein
  Online-Mitgliedschaftsnachweis. Einladungen werden nicht automatisch akzeptiert.
- Formulare verwenden weiterhin private Kontowiederherstellung. Ein normaler
  Datenrefresh remountet den Teameditor nicht mehr. Ein abgelehnter Schreibversuch
  hält die Eingabe offen; nur eine bestätigte Erstellung schließt das Formular.
  Bei unklarem Ausgang bleibt der Vorgangsschlüssel für die manuelle Wiederholung.
- Kein neuer Endpoint, keine neue Datenbankmigration und keine Swift-Änderung.
  `/api/work/teams`, `X-Team-Account`, `workspace_teams_v1`, Revisionen und
  native Container-v1-Nachrichten bleiben kompatibel. Die aktuell authentifizierte
  Serveridentität bestimmt den Akteur unabhängig von eingereichten Rollen.
- Alle17 kanonischen Kataloge ändern ausschließlich `WorkTeams`. Die gemeinsame
  Seite wird auch außerhalb des nativen Containers übersichtlich; öffentliche
  Verzeichnisse, Community-Nachrichteneingang und native Funktionen bleiben erhalten.

## Prüfung und Grenzen

24 lokale SQL-/HTTP-/Bridge-Fälle bestanden. Vier zusätzliche Fälle führen den
tatsächlichen HTTP-Handler mit der angewandten SQL-Migration
`20261122161544_workspace_team_channels.sql` in einer isolierten PGlite-Datenbank
aus: gefälschte Adminangaben, aktive/pending/fremde Mitgliedschaft, Widerruf nach
alter Anzeige, alte Wiederholung nach Entfernung und fremde Gruppen-IDs.
Alle Personen, Teams und Nachrichten dabei sind synthetische Testdaten.

29 angrenzende Wiederherstellungs-/Authfälle,17 Sprachkataloge mit11749 Schlüsseln,
20 verpflichtende Designfälle, gezieltes ESLint und vollständiges TypeScript bestanden.
33 kontrollierte Chromiumfälle importieren die tatsächliche WorkTeams-Komponente,
Icons und globale CSS: 320/393/1024px, alle17 Sprachen bei320px, verkürzte420px-Höhe,
Admin-Erstellung, Mitgliederbeitritt, tatsächliches Browser-Zurück, Konflikt mit
behaltener Eingabe, Wiederholung mit gleichem Schlüssel, Rollen-/Kontowechsel,
frische explizite Verknüpfung, feste Teamgrenze und native Wiederaufnahme mit
Rechteentzug sowie lange scrollbare Liste. Keine Browserfehler oder horizontale
Überläufe, sichtbare Bedienflächen mindestens44px. Lokale Browserbilder wurden
visuell kontrolliert; der Sperrhinweis steht lesbar unter dem Gruppennamen.

Die Browserfälle verwenden synthetische Clerk-, Router-, API- und Draftdienste;
Gesprächsinhalt und gemeinsamer Draftprovider sind Testadapter. Die getrennten
SQL-/HTTP- und Recovery-Fälle prüfen deren Vertragsgrenzen. Kein WebKit-Lauf:
Host-Systembibliotheken fehlen. Eine verkürzte Ansicht ist kein Nachweis der
realen iOS-Tastatur. Ein vollständiger Next-Produktionsbuild und Live-/Geräteprüfung
bleiben dem gemeinsamen Release vorbehalten. Alle Belege einschließlich
`browser-check.mjs`, `browser-results.json` und Testprotokollen liegen unter
`/srv/cinegenius/handoffs/20261124-work-team-groups`.

Browseremulation ist kein echter Login oder iPhone-/iPad-Nachweis. Gmail,
TestFlight, Datenmigrationen und reale Nachrichten-/Einladungsversände werden
durch diese Änderung weder aktiviert noch ausgeführt. Der nächste gemeinsame
Release benötigt den normalen geprüften Hauptstand und den geschützten Releaseweg.
