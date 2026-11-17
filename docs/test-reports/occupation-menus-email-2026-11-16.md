# Berufsangaben, Auswahlmenüs und E-Mails – Prüfbericht

Stand: 16. November 2026. Vorbereitet, **nicht veröffentlicht**. Keine Datenbank-
migration, keine Änderung vorhandener Mitgliederinhalte oder Versandkonfiguration.

## Umfang

- 1 Haupttätigkeit, bis zu 2 Nebentätigkeiten und höchstens 1 weitere Tätigkeit.
  Die zusätzliche Tätigkeit bleibt suchbar und in den Profildetails sichtbar;
  Karten zeigen nur Haupt- und Nebentätigkeiten. Alte längere Auswahlen bleiben
  bei sonstigen Profiländerungen erhalten. Vertrag: `docs/profile-occupation-focus.md`.
- Gemeinsame Lime-Auswahl für die Sortierung aller acht Verzeichnisse sowie
  Länder/Themen im News-Bereich der Startseite. Bestehende Filter und Seitenlayouts
  bleiben erhalten. `BrowseSelect` verwendet das bestehende `FloatingPanel`.
- Gemeinsamer E-Mail-Rahmen für Website-Nachrichten; separat vorbereitete
  Anbieter-Vorlagen. Details und vier nicht bearbeitbare Abrechnungsvorlagen:
  `docs/email-branding.md`.
- Recherche zu veröffentlichten Creditlisten von 140 Filmen, mit ausdrücklich
  dokumentierten Quellengrenzen. Keine automatische Änderung von Berufs-IDs.

## Ausgeführte Prüfungen

Die folgenden Läufe überschneiden sich; ihre Fallzahlen sind nicht als Anzahl
unterschiedlicher Tests zu addieren:

| Lauf | Ergebnis | Schwerpunkt |
| --- | --- | --- |
| `combined-final-tests.log` | 224/224 | E-Mails und Sprachen, Sicherheitsinhalte, Berufsangaben, Freunde, Smart-Sichtbarkeit |
| `final-draft-tests.log` | 30/30 | Einrichtung, Entwurfswiederherstellung, Berufszuordnung, Anbieter-Vorlagen |
| `final-api-focus-tests.log` | 24/24 | POST/PATCH-Grenzen, Altbestände, tatsächliche Editor-/API-Verknüpfung |
| `final-equivalent-tests.log` | 32/32 | Vergleichbare Profilansichten, private Verknüpfungen, Startseite |

Gezielter Lint für neue Auswahl-/E-Mail-Komponenten, Vorlagenwerkzeuge und neue
Tests sowie `check:design` und `git diff --check` bestanden. Sprachprüfung:
neun Kataloge, 8052 Schlüssel, keine neuen nicht lokalisierten Quelltexte.

Vier Browserprüfungen der tatsächlichen Auswahlkomponenten bei 320, 390, 768 und
1440px bestätigen Tastaturwahl, deaktivierte Optionen, Escape/Tab/Fokusrückgabe,
Haupt-/weitere Tätigkeit und fehlenden Überlauf. Die Umgebung simuliert den
Formularzustand; sie legt keine echten Profile an.

108 lokalisierte Website-Mailvarianten und 21 bearbeitbare Anbieter-Vorlagen wurden
in insgesamt 137 Browserdarstellungen geprüft, ab 320px ohne horizontalen Überlauf.
Alle 21 Anbieter-Vorschauen wurden zusätzlich vom Vorschau-Endpunkt akzeptiert.
Die Darstellungstests blockieren ausgehende Netzwerkanfragen. Es wurden keine
Mitglieder angeschrieben und keine Vorlagen beim Anbieter gespeichert.

Der vollständige Produktionsbau einschließlich TypeScript und Sprachprüfung ist
erfolgreich abgeschlossen (`build-final-clean.log`). Die öffentliche Anwendung
wurde anschließend aus diesem Bau lokal geprüft: acht Verzeichnisse bei jeweils
320/375/390/430/768/1024/1366px sowie die Startseiten-Auswahl in allen neun Sprachen
bei 320px. Zusammen 65 Ansichten ohne horizontalen Überlauf oder JavaScript-
Laufzeitfehler. Alle Menüs bleiben innerhalb des sichtbaren Fensters. Screenshots
liegen unter `directory-previews/`, Ergebnisse in `browser-pages.json`.

Ein vorheriger Bau traf auf veraltete generierte Typen der bereits entfernten
Prüfroute; nach deren Bereinigung bestand der vollständige Bau. Das Produktions-
manifest enthält keine Prüfroute. Die letzten Sprachprüfungen wurden durch vollen
Datenträger unterbrochen und nach Entfernung ausschließlich eigener regenerierbarer
Entwicklung-/Webpack-Caches fortgesetzt. Quelltexte und Prüfbelege blieben erhalten.

## Grenzen und Übergabe

- Chromium-Browserprüfungen sind keine Tests in realem Safari/iOS/Android oder
  Gmail, Outlook und Apple Mail. Der Produktions-Anmeldedienst erlaubt keine echte
  Anmeldung auf dem privaten localhost-Prüfhost; geschützte Schreibabläufe sind
  über kontogebundene API-Tests mit simulierten Daten geprüft.
- Die bestehenden Sprachen der Anbieter-Systemmails wurden erhalten. Neun
  Website-Sprachen bedeuten nicht neun Übersetzungen aller Anbieter-Vorlagen.
- Nur eine gemeinsame Veröffentlichung mit ausdrücklicher Betreiberfreigabe ist
  vorgesehen. Anbieter-Vorlagen erfordern zusätzlich den dokumentierten Abgleich
  mit dem gesicherten Original und eine separate Anwendung der vorbereiteten Patches.
- Die native App benötigt die additive Berufszuordnung und dieselben Anzeige-
  regeln. Dieses Paket enthält keine native Installation oder Inaktivitätsfunktion.

Ausführliche Prüfdateien, Vorschaubilder und private Anbieter-Originale liegen unter
`/srv/cinegenius/research/20261116-crew-credit-audit/`. Private Vorlagenexporte oder
Zugangsdaten gehören nicht ins Repository.
