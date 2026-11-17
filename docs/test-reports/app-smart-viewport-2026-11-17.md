# App-Abgleich: Smart, Vollbild und Ladeverhalten — 17. November 2026

Web-Rücklauf `7418127130b6ba65793c57ec334771796c05c55e`, App-Basis
`a928057e22333745d27986b1b5e3c9228b80dc2f`. Die ausgewählte kompakte Smart-Ansicht
und die berechtigungsabhängige Lime-Suche sind übernommen. Scanner, Kontogrenzen,
alle 17 Scanner-Kataloge und die App-Zufalls-/Trefferkorrekturen bleiben erhalten.
Die zusätzliche native Quelländerung betrifft nur den Viewport-CSS-Adapter;
mobile/README.md beschreibt dessen bereits bestehendes Vollbildverhalten genauer.

## Gefundene und behobene Fehler

- Das verzögerte Kartenmodul verschob die darunterliegenden Treffer um 52px:
  Der Ladezustand reservierte die spätere Informationszeile nicht. Mit derselben
  Reservierung wie in der geladenen Karte misst der Nachtest 0px Verschiebung.
- Die App-Abstandskorrektur für den Nachrichteneingang enthielt bei breiten
  Ansichten eine veraltete feste Headerhöhe. Bei 1194px und modelliertem 24px
  oberen Sicherheitsabstand lagen Headerende und Eingang vorher bei 88/141px,
  nach Entfernen der Ausnahme bei 88/88px. Das Eingangsrechteck ist ein Layoutmodell,
  kein authentifizierter Chat-Test.

## Tatsächlich geprüft

- Vollständiger Produktionsbuild, TypeScript, 17 Sprachkataloge, gemeinsames Design
  und gezielter ESLint-Lauf erfolgreich. Der erste Build stoppte am bestehenden
  Next-Sicherheitshinweis; die Wiederholung endete erfolgreich. Das ist keine
  Behebung des Hinweises und keine vollständige Sicherheitsprüfung.
- 72 gezielte Regressionen, 37 mobile Vertragsprüfungen; nach den beiden
  Anpassungen nochmals 17 Smart-Client- und vier Start-/Viewport-Prüfungen.
  Die Gruppen überschneiden sich teilweise.
- 21 zusätzliche Browserfälle im zusammengeführten App-Stand: alle 17 Sprachen
  bei 390px sowie Deutsch bei 320/834/1024/1440px. Filter, Auswahl, Karten-/Listenwechsel,
  44px-Flächen, Überlauf, Wiederholen und Rechteentzug geprüft.
- Verzögerte Bilder, vorübergehender Fehler mit erfolgreichem zweiten Versuch und
  dauerhafter Fehler mit begrenzter Wiederholung verändern die getesteten
  Ergebniszeilen nicht. Emuliertes Wischen über ein Foto nach Filterschließung
  scrollt die Seite um 174px, ohne versehentlich ein Detail zu öffnen.
- Verkleinerte Browserhöhe erhält die Eingabe. Echte Header-/BottomNav-/Smart-
  Komponenten und App-CSS wurden mit modellierten Sicherheitsabständen geprüft.
  Keine unerwarteten JavaScript-Ausnahmen; 503/403 wurden absichtlich erzeugt.
  Ein zusätzlicher 404 stammt ausschließlich vom Logo-Vorabruf der in der externen
  Testumgebung nicht angelegten Homepage, nicht von einer fehlenden Produktroute.

## Grenzen und Aktivierung

Die externe Produktions-Testumgebung verwendet synthetische Daten und eine
abgemeldete Testidentität. Sie ist nicht Teil der Anwendung oder Veröffentlichung.
Chromium-Touch und modellierte Randabstände ersetzen weder iOS-WebKit noch echte
Finger, Softwaretastatur, Rotation, Vordergrundrückkehr oder angemeldete Geräteflows.
Xcode-Werkzeuge sind auf diesem Server nicht verfügbar (`spawn xcrun ENOENT`).
Keine neue iPhone-Installation und keine physische Geräteabnahme in diesem Schritt.

WEB hat 7418127 nach gesonderter Freigabe veröffentlicht. Die hier zusätzlich
behobene Ladeverschiebung wurde nicht auf der Website veröffentlicht. Der native
Viewport-Adapter benötigt ein neu erzeugtes und installiertes App-Bundle.
Die separate Zufallsentdeckung benötigt weiterhin ihre noch nicht aktivierte
Datenbankmigration; dieser Abgleich spielt keine Migration ein.

Endgültiger App-Commit, Belege und Aktivierungszustände:
`/srv/cinegenius/handoffs/20261117-app-smart-layout/`.
