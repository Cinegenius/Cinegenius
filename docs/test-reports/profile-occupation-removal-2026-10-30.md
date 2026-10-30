# Gespeicherte Tätigkeiten zuverlässig entfernen

## Ursache

Der Entfernen-Knopf in `TypeChipPicker` suchte nach einer exakten Übereinstimmung zwischen gespeichertem Titel und aktuellem Katalogtext. Bei `Tiertrainer`, `Tiertrainer*in` und `Tiertrainer/in für Film, Fernsehen und Werbung` fand er keinen passenden aktuellen Titel und führte keine Änderung aus. Der neue Katalogeintrag lautet `Filmtiertrainer/in`; bekannte alte Varianten werden bei der Auswertung bereits dieser stabilen Rolle zugeordnet.

Beim Abwählen des aktuellen Katalogbuttons bestand ein zweiter Weg zum selben Fehler: Die Rollenkennung wurde entfernt, der abweichende alte Titel blieb aber in `positions`. Beim Speichern wurde die Tätigkeit daraus wiederhergestellt.

## Korrektur

- `lib/profile-occupation-editor.ts` entfernt bekannte Tätigkeiten anhand der vorhandenen stabilen Rollenauflösung einschließlich expliziter Altzuordnungen. Das X kann auch unbekannte gespeicherte Bezeichnungen entfernen, ohne zuvor ein Gewerk erraten zu müssen.
- `app/profile/page.tsx` verwendet diesen gemeinsamen Bearbeitungsschritt für das X und die Katalog-Abwahl. Textliste und ausgewählte Kennungen werden zusammen aktualisiert. Andere Tätigkeiten und Anbieterbereiche bleiben erhalten.
- Bei identischen Titeln in mehreren ausdrücklich ausgewählten Gewerken bleibt eine noch gewählte Zuordnung erhalten. Es wird keine weitere Kategorie anhand von Teilwörtern hinzugefügt.
- Wird die Haupttätigkeit entfernt, bleibt keine ungültige alte Referenz in der Auswahl. Die vorhandene Haupttätigkeitsauswahl und serverseitige Prüfung gelten weiter. Eine verbleibende gültige Haupttätigkeit wird nicht geändert.
- Keine Datenbankmigration, keine Änderung der Such-/Filterregeln und keine automatische Umschreibung bestehender Profile. Keine Änderung administrativer Rollen oder Eigentümerschaft. Keine neuen UI-Texte oder zusätzlichen Eingabeschritte.

## Tatsächlich geprüft

38 Tests bestanden:

`node --experimental-strip-types --import ./scripts/register-test-aliases.mjs --test lib/profile-occupation-editor.test.mjs lib/crew-occupations.test.mjs lib/primary-occupation.test.mjs lib/animal-taxonomy.test.mjs`

Die neun neuen Regressionstests prüfen insbesondere:

- X auf barem, bekanntem altem, englischem und unbekanntem gespeicherten Titel.
- Abwahl des aktuellen Filmtierberufs bei alter `set-logistik`-Referenz.
- Erhalt anderer Berufe und mehrfach ausdrücklich ausgewählter gemeinsamer Titel.
- Hinzufügen und Entfernen jedes auswählbaren Katalogberufs.
- Entfernte Haupttätigkeit und unveränderte gültige Haupttätigkeit.
- Tatsächliche Handler des Profileditors: X und Katalogbutton, nicht nur eine nachgebildete Buttonlogik.
- Die tatsächliche Profil-API mit isolierten Testdaten: PATCH, GET nach Speichern, unveränderte Zertifikate/Beschreibung/Bildadresse, keine Tierzuordnung nach erneutem Auswerten, Profilcache-Invalidierung und verweigerter Zugriff ohne Anmeldung. Keine echte Datenbank verwendet.

Browserprüfung mit synthetischem Profil und dem aus der tatsächlichen Seite entnommenen Picker: X bei 390 CSS-Pixeln und Katalog-Abwahl bei 1.366 CSS-Pixeln. Anschließend nur Gaffer ausgewählt, Tiertrainer aus Textliste und Kennungen entfernt; vorhandener Anbieterbereich erhalten. Kein horizontaler Überlauf. Dies sind Browser-Simulationen, keine physischen Gerätetests und keine Änderung des echten Nutzerprofils.

`npm run check:i18n`, `npx tsc --noEmit --incremental false` und ESLint für die neuen Dateien bestanden. Die bestehende Übersetzungsstruktur und deren Rückstand bleiben unverändert. Der Produktionsbuild folgt im vorgeschriebenen Releaseablauf; dieser Bericht nimmt dessen Ergebnis nicht vorweg.

## Bedienung nach Veröffentlichung

Die Profilbearbeitung einmal neu laden. Im vorhandenen Tätigkeits-Schritt auf das X bei Tiertrainer klicken oder den entsprechenden Beruf abwählen und anschließend das Profil speichern. Das echte Nutzerprofil wird durch die Veröffentlichung der Korrektur nicht automatisch verändert.
