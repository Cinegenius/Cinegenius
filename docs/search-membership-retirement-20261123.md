# Suchendes Mitglied: nur bestehende Auswahl erhalten

Betreiberauftrag vom 23. November 2026: „lass das suchende mitglied raus nehmen“;
Präzisierung: „jeder der als suchender drin ist bleibt so aber das soll nicht mehr so gehen“.

## Umfang

- Neue Konten sehen fünf Einstiege: Crew, vor der Kamera, Locations, Marktplatz und Firma.
- Vor der ersten Auswahl wird kein Sucheinstieg mehr als Platzhalter gespeichert.
- Der gemeinsame private Speicherweg lehnt neue Sucheinstiege auch aus alten geöffneten Formularen ab. Die Ausnahme wird aus dem vorhandenen, authentifizierten Kontostand ermittelt.
- Bestehende Sucher-Konten, explizit gespeicherte Sucher-Entwürfe und alte Entwurfsformate bleiben lesbar; ihre Fortsetzung und ihr Abschluss bleiben möglich. Abgeschlossene Konten behalten den bisherigen Dashboardzugang ohne Pflicht-Crewprofil.
- Ein alter leerer Entwurf mit dem bloßen Platzhalter `intent=search` ist keine ausdrückliche Auswahl. Seine Eingaben bleiben erhalten, neue Clients führen zur Auswahl der fünf gültigen Einstiege.
- Keine Kontenmigration, keine Umbenennung bestehender Mitglieder und keine Änderungen an Profilen, Inseraten oder Firmen. Bestehende Sucher bleiben im Adminbereich erkennbar. Späteres freiwilliges Ergänzen von Crew-/Anbieterprofilen bleibt erhalten.

## Prüfstand

Veröffentlicht als `32ce5b9f258738630e3ff373aaba83d57f70b64e` auf Basis `f1b6c32c`. Produktion `dpl_EBjCGgcW7LsNFbYSZv5jYv3dPgSw` READY; www-Zuordnung und Liveprüfungen am 23.11.2026, 21:40 Uhr Berlin bestätigt.

99 gezielte Tests bestanden: reale Handler/Komponenten mit kontrollierten Kontodaten,
Speichern vor der Auswahl, fünf aktive Wege, Ablehnung neuer Sucher und gemischter
Umgehungsversuche, unveränderte Altmitglieder, alte Entwürfe, erneuter Abschluss,
Wiederaufnahme und Kontogrenzen. Die geänderten Handler wurden abschließend erneut geprüft.
Alle 17 Sprachen im tatsächlichen Komponentenbaum geprüft.
12 Browserfälle mit tatsächlichem Wizard und gemeinsamem CSS: Deutsch/Spanisch,
320/393/1440 px, neue und bestehende Sucher-Auswahl; kein horizontaler Überlauf,
Bedienflächen mindestens 44 px und keine JavaScript-Seitenfehler. Kontotransport
und nicht betroffene Untereditoren waren isoliert, keine echten Kundenschreibzugriffe.

TypeScript, Sprachprüfung (17 Kataloge, 11644 Schlüssel) und verpflichtende
Designprüfung bestanden. Gezieltes ESLint ohne Fehler; zwei vorhandene
Hook-Abhängigkeitswarnungen im Wizard bleiben unverändert.
Belege: `/srv/cinegenius/handoffs/20261123-retire-search-member/`.

## Veröffentlichung und App

Markus hat für diesen konkreten Auftrag ausdrücklich „Ja, jetzt live stellen“ bestätigt.
Der geschützte Releaseweg hat den sauberen Hauptstand gleich origin/main und die
Projektidentität geprüft. Produktionsbuild einschließlich TypeScript, Sprachen und
Designprüfung bestanden. 15 öffentliche HTTP-Prüfungen einschließlich anonymer
Schreibablehnung und zwei echte Browserprüfungen der Registrierung (de393/es1440)
bestanden. Keine Kundendatenänderung oder Migration. Die erste kurze Laufzeitprüfung
meldet keine Fehler/Fatal-Ereignisse; das ist kein Langzeitnachweis.

Gemeinsame Web-Einrichtung gilt auch für die eingebettete App; keine Swift-Änderung,
kein neuer Gerätebuild und keine physische Geräteabnahme in diesem Auftrag.
Der angemeldete neue Auswahlweg und bestehende Sucher sind in kontrollierten
Komponenten-/Handler-/Browserfällen geprüft; keine echte neue Kundenregistrierung
für den Livecheck. Freigabe und Livebelege: `/srv/cinegenius/handoffs/20261123-retire-search-member/release-receipt.json`.
