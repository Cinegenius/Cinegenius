# Profilcover: Helligkeit und Ausschnitt

Stand: 26.10.2026. Lokal umgesetzt und gezielt geprüft; noch nicht veröffentlicht.

## Ursachen und Änderungen

- Die öffentliche Profilabfrage lud `focal_point` nicht. Gespeicherte Helligkeits- und Fokuseinstellungen fehlten damit auf öffentlichen Profilseiten.
- Zusätzlich zur bisherigen Bildtransparenz lag ein schwarzer Verlauf über dem gesamten Cover. Selbst ein Wert von 100 % konnte dadurch kein Originalbild zeigen.
- Die Coverdarstellung nutzt jetzt ausschließlich `filter: brightness(...)` auf dem Bild. Bei 100 % gilt `brightness(1)` und Bilddeckkraft 1. Der flächige schwarze Verlauf ist entfernt. Nur Namen und Aktionen haben eine örtlich begrenzte kontrastierende Fläche, damit sie auch auf hellen Fotos lesbar bleiben.
- Der bisherige Helligkeitswert `focal_point.opacity` bleibt kompatibel gespeichert. Eine eigene Position liegt in `focal_point.cover: {x,y}`. Die vorhandenen `x/y` für Porträt und Crewkarte bleiben unabhängig erhalten. Keine neue Datenbanktabelle oder Migration.
- Cover lassen sich in der Vorschau mit Pointer-Ereignissen verschieben; Maus und Finger verwenden denselben Weg. Die Berechnung berücksichtigt Bildformat, Frame und tatsächlichen Überstand. Regler für beide Achsen bieten eine Alternative zur Ziehbewegung sowie Tastaturbedienung. Desktop-/Smartphone-Vorschau und Zentrierung sind vorhanden.
- Über „Profil speichern“ werden Position und Helligkeit gemeinsam im bestehenden Profilsystem gesichert. Private Editorentwürfe enthalten die Einstellungen weiterhin. Die öffentliche Profilabfrage lädt das Feld; die vorhandene Profil-Cacheentwertung wird beim Speichern weiter ausgelöst.
- Cover-Uploads öffnen nicht mehr den Porträt-Fokusdialog. Ein später geänderter Porträtfokus entfernt die Coverposition nicht mehr. Ungültige Koordinaten oder Helligkeitswerte werden serverseitig vor dem Speichern abgewiesen.

## Tatsächlich bestandene Prüfungen

**19 gezielte Tests bestanden:** sieben neue Covertests sowie zwölf bestehende Tests für Profilspeicherung und Editorablauf.

- Originalhelligkeit bei 100 %, veränderbare Helligkeit, sichere Legacy-Standardwerte.
- Horizontale/vertikale Ziehberechnung, Randbegrenzung, unveränderter Ausschnitt ohne Bildüberstand und vor dem Laden.
- Gültige und ungültige Einstellungen; getrennte Porträt-/Coverkoordinaten.
- Ausführung des tatsächlichen Profil-PATCH-Handlers und der öffentlichen Profilladefunktion mit simuliertem Supabase-Transport: Speichern, erneutes Laden derselben JSON-Werte, korrekte öffentliche Bildstile, Eigentümerfilter trotz manipulierter Nutzerangabe und Cacheentwertung.
- Verweigerte Anfragen ohne Sitzung und ungültige Änderungen ohne Datenbankmutation.
- ESLint der betroffenen Dateien, TypeScript-Prüfung und `git diff --check` bestanden.

**Lokale Browserprüfung mit synthetischem Testprofil:** tatsächlicher Covereditor und tatsächliche öffentliche Profilkomponente bei Desktopgröße (1280 px) und simulierter Handygröße (390 × 844 CSS-px). Ziehen in beiden Vorschaugrößen, Helligkeitsregler per Tastatur, lokales Speichern, Neuladen und öffentliche Vorschau geprüft. Gespeicherte Position und Helligkeit blieben erhalten; Porträtkoordinaten unverändert. Bei 100 %: `brightness(1)` und Deckkraft 1. Keine horizontalen Seitenüberläufe; neue Schaltflächen 44 px hoch. Name, Tätigkeiten, Bearbeiten-Aktion und Profilbild bleiben sichtbar. Keine Konsolenfehler.

Die lokale Browser-Speicherung war eine Testsimulation; die Produktionsdatenbank wurde nicht verändert. Keine echten iOS-/Android-Gerätetests und kein vollständiger Live-Speicherablauf durchgeführt. Die Vorschau zeigt Referenzausschnitte; tatsächliche Profilhöhe und Browserbreite können den sichtbaren Bereich ändern.

Screenshots im Aufgabenordner: `outputs/cover-editor-desktop.png`, `outputs/cover-editor-mobile.png`, `outputs/cover-profile-desktop.png`, `outputs/cover-profile-mobile.png`.
