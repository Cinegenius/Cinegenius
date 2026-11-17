# App-Abgleich: Objektbegriffe und Vollbild — 17. November 2026

Übernommen wird der geprüfte Web-Commit
`fbaef73d85a1992675c7841ab580d04bf9455ace` auf App-Basis
`5fe36a31b48772bfe67270e36153e6129343cce5`. Der Web-Rücklauf ist laut seinem
Übergabebeleg noch nicht veröffentlicht. Dieser App-Abgleich veröffentlicht
weder Website noch Datenbankänderungen und installiert keine neue iPhone-App.

Die gewöhnliche Marktplatzsuche und Smart teilen jetzt die allgemeinen Begriffe
für Leuchten sowie Kostüme einschließlich Zubehör in allen 17 Sprachen.
Angebote mit bloßen Modellnamen bleiben damit auffindbar. Spezifische Modelle,
Ortsgrenzen und die bisherigen Zugriffsprüfungen bleiben erhalten. Die beiden
mitgelieferten Dokumente beschreiben auch Formularvorschläge; diese sind keine
umgesetzten neuen Formulare oder Veröffentlichungsvoraussetzungen.

## Erhaltene App-Arbeit und Vollbildstatus

143 Dateien wurden mit dem vorherigen Stand verglichen: native Quellen,
Sprachkataloge, Smart-Ansicht und gemeinsame URL-Verwaltung sind unverändert.
Das schließt den nativen Scanner, die Kontogrenzen, zufällige Entdeckung und
die bisherigen Korrekturen gegen springende Trefferzahlen/Karten ein.

Der native Web-Bereich füllt mit vorhandenem gebündeltem Viewport-Adapter das
ganze Fenster. Die Hintergründe reichen bis an die Ränder; Kopfbereich und
Bedienelemente berücksichtigen die Sicherheitsabstände. Fehlt der Adapter in
einem unvollständigen Bundle, bleibt der sichere ältere Rahmen erhalten.
Die letzte dokumentierte physische iPhone-Installation stammt vom 14. November.
Eine neue Installation und die tatsächliche Vollbilddarstellung auf dem iPhone
sind mit diesem Abgleich nicht bestätigt. Browsermodelle ersetzen das nicht.

## Prüfung

- 137 gezielte Such-/Marktplatzregressionen und 37 mobile Vertragsprüfungen
  erfolgreich; die Gruppen sind keine vollständige Gerätesuite.
- Vollständiger Build einschließlich TypeScript und 17 Sprachkatalogen mit
  11.230 Schlüsseln erfolgreich. Gemeinsames Design, gezielter ESLint-Lauf und
  Diff-Prüfung erfolgreich.
- Der erste Build stoppte am bereits bekannten Next-Sicherheitshinweis; die
  normale Wiederholung endete mit Exit 0. Das offene Abhängigkeitsproblem wurde
  nicht behoben. Es wurde kein Framework-Upgrade oder Livegang durchgeführt.
- Browserprüfung in allen 17 Sprachen bei 393px: allgemeine Leuchten- und
  Kostümsuche, korrekte Trefferzahlen, Smart-Liste/Karte und Ortsabgrenzung.
  Zusätzlich Deutsch bei 320/834/1440px ohne horizontalen Überlauf; echte
  Zurück-Navigation erhält die Suche, 503/Wiederholen erhält den Suchtext,
  eine verspätete alte Antwort überschreibt die neuere Suche nicht.
- Die Testumgebung wurde um serverseitige Sprachkataloge und sauberes Beenden
  laufender CSS-Testanfragen ergänzt. Ein zunächst zu allgemeiner Testselektor
  traf die Next-Routenansage statt der Fehlermeldung und wurde auf deren
  Wiederholen-Schaltfläche eingegrenzt. Die endgültigen Fälle sind erfolgreich;
  daraus entstand keine zusätzliche Änderung am Produktcode.

Die lokale Browser-Testumgebung verwendet tatsächliche zusammengeführte
Marktplatz-/Smart-Komponenten und Suchhelfer, aber synthetische Angebote und
Antworten sowie modellierte Sicherheitsabstände. Keine angemeldete Live-Smart-
Anfrage, keine KI-Kosten, keine Produktionsschreibzugriffe. Gerätegesten,
iOS-WebKit, Softwaretastatur und Vordergrundwechsel bleiben auf dem iPhone zu
prüfen. Die separate Datenbankergänzung zur zufälligen Entdeckung ist weiterhin
nicht aktiviert; diese Suchkorrektur selbst benötigt keine Migration.

Ausführliche Ergebnisse und endgültiger App-Commit:
`/srv/cinegenius/handoffs/20261117-app-smart-object-search/`.
