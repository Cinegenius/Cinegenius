# Regionale Inhalte zuerst · 20. November 2026

Status: geprüfter Website-Entwurf auf `codex/country-first-discovery-20261120`,
noch nicht veröffentlicht. Der APP-Release-Halt bleibt bestehen. Keine Migration,
keine Veröffentlichung vorhandener privater Inhalte und keine neuen Provider.

## Gemeinsamer Vertrag

1. Eine bewusste Länder-/Ortswahl, „Alle Länder“ und eine ausdrücklich gewählte
   Sortierung bleiben maßgeblich. Der vorhandene Standortpfeil kann die regionale
   Reihenfolge wieder aktivieren. Echte Zurück-Navigation und Sprachwechsel
   erhalten die Auswahl; Kontowechsel verwirft den bisherigen privaten Zustand.
2. Ohne solche Auswahl hat das gültige, vom Vercel-Aufruf übermittelte Land Vorrang.
   Das gilt auch für Gäste und Reisende: Aufruf in Mexiko bevorzugt Mexiko,
   selbst wenn das Profil Deutschland nennt. Derselbe Vertrag gilt für alle
   Länder des zentralen Katalogs.
3. Liegt der eigene Profilort im selben Land, verfeinern Stadt und Region die
   Reihenfolge. Ohne gültiges Aufrufland ist der Profilort der Rückfall.
   Ohne beides bleibt die globale Reihenfolge bestehen.
4. Sprache ist kein Standort. Kein GPS-Aufruf, keine Ableitung einer Stadt aus
   der Verbindung, kein neues Speichern von IP oder automatisch erkanntem Land.
   Der vorhandene Datenschutzhinweis beschreibt die neue Priorität; das deutsche
   Rechtsoriginal bleibt in allen Sprachversionen als solches gekennzeichnet.

`lib/browse-preference-server.ts` verwendet `headers()` und den kanonischen
Länderkatalog. `x-vercel-ip-country` wird nur in der Vercel-Laufzeit verwendet.
React `cache` ist ausschließlich an die Server-Render-Anfrage gebunden, nicht
an mehrere Besucher. `/api/browse-preference` liefert weiterhin private/no-store:

```json
{"userId":null,"place":{"country":"MX","region":"","city":""},"source":"request"}
```

`source` ist ergänzend `profile` oder `none`. Beim Fehler folgt 503 und keine
bestätigte Ortspräferenz. Der Client verwirft abgebrochene oder veraltete Antworten
und prüft `userId` sowie Sitzung vor Nutzung. Der Server leitet daraus keine
Zugriffsrechte ab. Native Clients dürfen kein früheres Kontoergebnis übernehmen.

## Betroffene Bereiche

| Bereich | Verhalten |
| --- | --- |
| Crew, Firmen, Locations, Marktplatz, Jobs, Projekte, Filmtiere | Gemeinsame Präferenz auch für Gäste; manuelle Ortswahl schaltet die automatische Reihenfolge aus. Vorhandene Filter, Bilder, Karten und Abmessungen bleiben bestehen. |
| Öffentliche Listings-API | `nearby=1` priorisiert vor exakter Zählung und Seitengrenze. Konkrete Orte und Preissortierung bleiben maßgeblich. `privacy_visible_listings` bleibt Grundlage. |
| Startseite | Lokale Crew, Angebote, Locations, Jobs und Firmen vor globalen Einträgen auswählen, nicht erst eine begrenzte globale Auswahl umsortieren. Übrige Länder füllen freie Plätze. |
| Homepage-Crew | Innerhalb der Ortsgruppen gelten weiterhin 24 Stunden Neu-Vorrang, danach die wechselnde Auswahl alle 15 Minuten. Private Profile und verborgene Ortsangaben dürfen die Rangfolge nicht beeinflussen. |
| Homepage-Marktplatz | Vorhandene Kategorie-/Angebotsmischung und Rotation innerhalb der Ortsgruppen erhalten. |
| Organisationen | Regionale Reihenfolge vor Seitenbegrenzung; explizites Land bleibt Filter. `?country=all` bedeutet bewusst global und wird beim Blättern erhalten. Ohne Parameter gilt automatisch regional. |
| Schwarzes Brett | Ohne Länderparameter regional zuerst. Ghost-gefilterte Beiträge verbrauchen keinen sichtbaren Platz; begrenzte 50er-Abfragen mit Zeitlimit füllen die Auswahl auf. Eigene bestehende Ghost-Ausnahme bleibt unverändert. |
| News / Aus der Branche | Vorhandene manuelle Länder-/Themenwahl bleibt bestehen. Nur die Automatik wechselt auf Aufrufland vor Profil-Land. Nachrichten behalten ihre tatsächlich gespeicherte Zielregion; keine Umdeutung des Herstellerlands. |

Für native Auswahlkomponenten ist insbesondere der Unterschied zwischen **kein
Länderparameter** und **explizit `country=all`** relevant. Organisationsseiten
verwenden dafür die echte URL; das Schwarze Brett behält `all` in seinem
kontogebundenen Ansichtsstand. Ein nachfolgender Abruf darf `all` nicht als fehlende
Auswahl entfernen.

## Grenzen

- News behalten ihre bestehende Länderfilterung; andere Länder und Beiträge ohne
  Länderzuordnung sind über die vorhandene Auswahl erreichbar. Es werden keine
  fremden Nachrichten als lokale Nachrichten ausgegeben.
- Die öffentliche Foto-Entdeckung bleibt global. Ihre bestehende Medienprojektion
  liefert keinen verlässlich freigegebenen Aufnahme-/Angebotsort. Kein Standort
  wird aus einem Foto, Namen oder der Zugehörigkeit zu einer Person geraten.
- Altbestände ohne kanonisches Land bleiben erreichbar, werden aber nicht als
  mexikanisch, deutsch usw. erfunden. Kein Backfill und keine Inhaltsänderung.
- Mehrwährungen, Ländervertreter-Feedback und die redaktionelle Zusammenführung
  bleiben eigene Aufgaben. Diese Änderung aktiviert sie nicht.
- Regionale Priorität verändert weder exakte Gesamtzahlen noch Sichtbarkeitsrechte.
  Private Profilorte werden vor Auswahl/Sortierung geschützt; ausgewählte Personen
  werden vor Ausgabe erneut auf aktuelle Sichtbarkeit geprüft.

## Prüfung

- 162 gezielte Tests bestanden: Regionsermittlung, SQL-Bereiche/NULL-Orte,
  exakte Seitenzahlen, Homepage-Auswahl vor Limits, Privacy, Nachrichtenregion,
  Organisationen, Schwarzes Brett und vorhandene Seitendarstellung.
- 32 Chromium-/WebKit-Prüfungen mit tatsächlichen Verzeichniskomponenten und
  künstlichen Daten: 320/393/834/1366 CSS px, Deutsch/Spanisch/Ungarisch,
  alle sieben Verzeichnisse, Alle-Länder-Auswahl, Zurück, Kontowechsel,
  verspätete Antworten und Fehler/Wiederholen.
- Keine echte Anmeldung aus Mexiko, kein Live-Daten- oder echtes iPhone-/iPad-
  Gerätetest. Browser-Nachweise sind keine native Freigabe.
- Geänderte Dateien erzeugen keine neuen Lint-Meldungen. Drei bereits vorhandene
  React-Regelfehler und fünf Warnungen bleiben dokumentiert; kein pauschal grüner
  Gesamt-Lint behauptet.
- Alle 17 Sprachkataloge (11.205 Schlüssel) und gemeinsame Designregeln bestanden.
  Zugängliche Pfeilbeschriftungen benennen das bevorzugte Land, ohne einen
  GPS-Standort oder einen vorhandenen Gast-Profilort zu behaupten.
- Vollständiger Build inklusive TypeScript bestanden (Exit 0). Die lokalen
  optionalen Datenpfade melden ohne Supabase-Zugang nicht verfügbare Inhalte;
  kein Test mit Produktionsdaten. Startseite, News und Organisationen bleiben
  dynamische Routen. Ein erster Build wurde beim Tracing mit 143 beendet;
  der wiederholte Abschluss ist separat protokolliert.
- Quellstände und Prüfbeleg:
  `/srv/cinegenius/handoffs/20261120-country-first/receipt.json`.
