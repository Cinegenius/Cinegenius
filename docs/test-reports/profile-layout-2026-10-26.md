# Öffentliche Profilformatierung – 26.10.2026

Stand: lokal umgesetzt, nicht veröffentlicht. Keine Änderungen an Datenbank, API, Profilinhalten, Berechtigungen oder gespeicherten Covereinstellungen.

## Ursache und Korrektur

- Der generische Profilkopf streckte die dunkle Textfläche auf die gesamte Inhaltsbreite. Große Namensschrift und eine eigene Aktionsspalte verstärkten das Ungleichgewicht. Nach Nutzerfeedback wurde die dunkle Fläche vollständig entfernt. Der Text steht direkt im Cover und ist auf die verfügbare Breite beziehungsweise 48rem begrenzt; Textschatten und einzelne dunkle Tätigkeits-/Aktionsschaltflächen sichern die Lesbarkeit. Namen verwenden 30/36px statt 36/48px. Bearbeiten bleibt im normalen Layoutfluss.
- Informationen begannen direkt am Coverrand. Gemeinsame Außenkanten bleiben erhalten; unter dem Cover stehen nun 24/32px Abstand. Ab 768px bekommt das Foto eine 200/220px breite Spalte, die Informationsspalte kann schrumpfen. Auf kleinen Bildschirmen folgt eine einzelne Spalte.
- Informationsblöcke erhalten 24/32px Abstand, Kurzangaben eine geordnete Rasteranordnung und Kontaktlinks mindestens 44px Bedienhöhe. Lange Kontaktdaten, Zertifikate, externe Profilbezeichnungen und Firmennamen umbrechen. Firmenlogos bleiben object-contain.
- Weitere Tätigkeiten zeigen zunächst drei Einträge. Ein bestehender Fehler ließ die Einklappschaltfläche verschwinden, sobald alle Einträge sichtbar waren. Beide Richtungen funktionieren jetzt für Crew-, Schauspiel- und Modelprofile.
- Profile ohne Cover brauchen keine feste Hero-Mindesthöhe. Leere Firmenzugehörigkeit rendert keine versehentliche „0“ mehr.
- Die Bildposition und Helligkeit verwenden unverändert profileCoverStyle. Es gibt keine zusätzliche flächige Bildverdunkelung.

## Tatsächlich geprüft

- Browser mit den echten ProfileView-/ProfileRoles-Komponenten und globalen Website-Stilen; synthetische Testprofile, lokale SVG-Bilder, simulierte Clerk-/Router-/API-Umgebung. Keine echten Profile verändert.
- Drei Varianten (normal, langer Name mit 17 Tätigkeiten und langen ungetrennten Zertifikaten/Kontaktdaten, minimale Angaben ohne Bilder/Firma) bei 320, 390, 768, 1024 und 1366 CSS-Pixeln. Alle 15 Kombinationen ohne horizontalen Seitenüberlauf.
- Lange Tätigkeitslisten bei allen fünf Größen auf- und zugeklappt: alle Einträge erreichbar, Einklappen sichtbar, kein horizontaler Überlauf. Ein dabei zunächst gefundener 320px-Überlauf wurde an der maximalen Kopfbreite behoben und anschließend erneut geprüft.
- Schauspiel- und Modelvariante mit langer Liste bei 320px: kein Überlauf, Einklappen verfügbar. Besucheransicht bei 320px mit aufgeklappter Liste ebenfalls ohne Überlauf.
- Ohne Cover nach letzter Anpassung erneut 320/1366px geprüft (Kopfhöhe 182/145,5px).
- Cover im Browser: brightness(1), object-position 30% 65%, unverändert über die geprüften Größen.
- Visuelle Ansichten auf Laptop, Tablet und Handy gespeichert; Browserkonsole ohne Fehler.
- 17 gezielte automatisierte Tests zu Profilanzeige, Layoutvertrag und Cover erfolgreich. ESLint, TypeScript und git diff --check erfolgreich.

## Grenzen

Browsergrößen sind Simulationen, keine Tests auf echten iOS-/Android-Geräten. Die lokale Vorschau nutzt Testdaten und ersetzt keinen Produktions-/Anmeldetest. Speicherung und Sichtbarkeitslogik wurden nicht geändert. Schauspiel-/Modellayouts behalten ihren bestehenden Aufbau; nur ihre gemeinsam genutzten Tätigkeits-, Firmen- und externen Linkkomponenten wurden angepasst.

## Nachprüfung: direkt ins Cover integrierte Variante

- Dunkle Kopfbox samt Innenabständen und Hintergrundunschärfe entfernt. Im Browser ist der Kopfcontainer vollständig transparent.
- Lange Tätigkeitslisten erneut bei 320/390/768/1024/1366px auf- und zugeklappt: kein Seitenüberlauf. Cover unverändert brightness(1), object-position 30% 65%.
- Neue Laptop-, Tablet- und Handyscreenshots unter outputs/profile-integrated-*.png. Lokale Simulation mit Testdaten, weiterhin nicht veröffentlicht.
