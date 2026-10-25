# „Frische Einblicke“: Profil- und Firmenquellen

Stand: 25.10.2026. Gezielt geprüft; Datenbankmigration für die angeforderte Veröffentlichung angewendet. Der tatsächliche Deploymentstatus wird gesondert kontrolliert. Diese Einschränkung ersetzt den früheren Auftrag, Bilder aller öffentlichen Plattformbereiche aufzunehmen.

## Ursache und Korrektur

Die bisherige Datenbankansicht verband Profile und Firmen mit Angeboten, Projekten und weiteren Inhalten. Eine reine Filterung der fertigen Karten hätte zudem bereits anhand des Storageobjekts als Profilfoto eingeordnete Angebotsbilder nicht zuverlässig ausgeschlossen.

- Explizite Quellenliste in Datenbankansicht und Serverabfrage: ausschließlich `profile` und `company`. Darin Avatar, Cover, direktes Portfolio/Arbeitsproben sowie Firmenlogo, Firmen-Cover und Firmengalerie. Keine Likeschwelle und keine zusätzliche Freigabe oder `featured`-Kennzeichnung.
- Ausgeschlossene Zuordnungen werden anhand derselben Storage-Datei erkannt, einschließlich kodierter Pfade und abweichender URL-Abfrageparameter. Dateien, die auch eigenständigen Projekten/Projektentwürfen, Locations, Marktplatzartikeln, Firmen-Equipment oder Aushängen zugeordnet sind, werden vorsorglich ausgeschlossen. Ihre zusätzliche Anzeige in persönlichen oder Firmenprofilen führt nicht zur Aufnahme. Explizite fremde Herkunftsangaben an Profileinträgen werden ebenfalls abgewiesen.
- Die Entscheidung bewertet Zuordnungen, nicht Bildmotive: Eine direkt hochgeladene Arbeitsprobe mit einem Filmdreh als Motiv bleibt erlaubt. Ein separat erneut hochgeladenes Bild mit eigener Storage-Datei ist eine eigene Zuordnung; es erfolgt keine visuelle Bilderkennung.
- Private Profile, unveröffentlichte Firmen, private Einzelbilder, private Buckets, fehlende Dateien und temporäre Adressen bleiben ausgeschlossen. Die Ansicht wird bei jeder neuen Abfrage aus aktuellen Zuordnungen berechnet; es gibt keine kopierte Bildsammlung.
- Slideshow, Layout, Logo-Einpassung, Fotoansicht und getrennte Links zu Person/Firma bleiben erhalten. Die Serverabfrage filtert vor Sortierung/Seitenauswahl: maximal 24 Slideshowbilder, 48 Bilder pro Galerieseite. Beschreibung der Galerie auf die erlaubten Quellen angepasst.
- Migration enthält keine Löschung oder Änderung von Nutzerbildern, Projekten, Locations, Artikeln oder Likes.

## Tatsächlich bestandene Prüfungen

**18 gezielte Tests, 0 Fehler**, davon zehn Bild-/Quellenprüfungen einschließlich Abfrageaufwand und zwei Serverabfrageprüfungen; die sechs bestehenden Teamregressionen im gemeinsamen Testmodul bleiben ebenfalls grün.

- Tatsächliche Migrationen mit PostgreSQL-Engine PGlite und ausschließlich synthetischen Daten ausgeführt.
- Erlaubte Profil-/Firmenbildarten, alte und neue Galeriefelder, korrekte Profil-/Firmenziele und Logo-`contain` geprüft.
- Ausschluss sämtlicher Angebotstypen, Projektposter/-galerien/-entwürfe, Firmen-Equipment und Aushänge; auch bei privaten Elterninhalten und zusätzlichen persönlichen/Firmen-Profilzuordnungen.
- Direkte Set-Arbeitsprobe ohne Likes und mit `featured:false` erscheint; fremde Projektzuordnung und private Bildkennzeichnung erscheinen nicht.
- Austausch, Entfernen, Dateiverlust, Profil-/Firmensichtbarkeit, spätere Uploads, Dateiduplikate, kodierte Dateinamen und Erhalt vorhandener Likes geprüft.
- Tatsächliche Serverfunktion mit simuliertem Supabase-Transport ausgeführt: Quellenfilter vor Begrenzung, 24/48 Bilder, fortlaufende Seiten, chronologische Sortierung, unveränderte Anbieterstreuung. Direkter Fotoaufruf verwendet dieselbe Quellenbeschränkung.
- ESLint und TypeScript-Prüfung bestanden. Keine Originaldaten für Tests verändert.

## Veröffentlichung

Die Migration ist auf der produktiven Datenbank angewendet; PostgREST-Schemaaktualisierung angefordert. Der reale Abgleich liefert ausschließlich 86 Profilbilder und 7 Firmenbilder (93 insgesamt); direkter anonymer Zugriff auf die Ansicht bleibt gesperrt. Der Live-Browsertest folgt nach Veröffentlichung der abhängigen Website-Version. Die bisherigen Darstellungsprüfungen der unveränderten Slideshow werden hier nicht als neue Gerätetests ausgegeben.

## Fehler bei der Live-Prüfung und Wiederherstellung

Die erste Quellenmigration verursachte in Produktion einen Datenbank-Timeout. Die Pfaddekodierung wurde im Storagevergleich wiederholt statt einmal pro Bild ausgewertet; die tatsächliche Abfrage brauchte rund 22,5 Sekunden. Startseite und Galerie waren dadurch vorübergehend nicht verfügbar. Eine höhere Zeitgrenze oder geänderte Sicherheitseinstellung wurde nicht verwendet.

Die nachfolgende Migration `20261025151000_bound_discovery_query.sql` berechnet und materialisiert erlaubte Einträge samt dekodierter Dateipfade vor dem Storagevergleich. Gemessen in Produktion: 38,331 ms für die 24-Bilder-Auswahl und 32,266 ms für die Gesamtzahl. Beide Seiten wurden danach als öffentlicher Besucher erfolgreich geöffnet; die Galerie zeigte 93 Einblicke. Ein zusätzlicher Regressionstest zählt bei 2.000 unbeteiligten Storageobjekten genau zwei Dekodierungen für zwei Kandidaten. Originaldateien, Quellenbeschränkung und Zugriffsrechte bleiben unverändert.
