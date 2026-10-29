# Crewkarten: Profilfoto und Ausschnitt

Stand: 29.10.2026. Implementierung und lokale Prüfung; die Produktionsveröffentlichung wird separat im Release geprüft.

## Ursache und Korrektur

- Das Raster setzte Fotos mit `object-contain` und zusätzlichem Innenabstand in einen sehr schmalen Hochformatrahmen. Dadurch entstanden künstliche schwarze Balken. Außerdem bevorzugte es ein Portfoliofoto vor dem eigentlichen Profilfoto und berücksichtigte den gespeicherten Fokus nicht.
- Raster und Liste verwenden jetzt `ProfileCardPhoto`: tatsächliches Profilfoto zuerst, proportionaler Zuschnitt, reservierte Bildfläche, gespeicherter Ausschnitt und Initialen bei fehlender/nicht lieferbarer Datei. Der vorhandene Portfolio-Ersatz bleibt für ältere Profile ohne Avatar erhalten; der Avatar-Ausschnitt wird nicht auf ein anderes Portfoliofoto übertragen.
- Nach Nutzerkorrektur auch auf kleinen Handys zwei Karten nebeneinander, weiterhin drei auf großen Bildschirmen. Quadratische Rasterfotos mit 48px unter 375px, 56px auf größeren Handys, 88px auf Tablets und 96px auf großen Bildschirmen. Vollständige Namen können umbrechen. Die übrige Gestaltung und Crewfilter bleiben bestehen.
- Bestehende Profilfotos lassen sich über „Ausschnitt anpassen“ ohne erneuten Upload verschieben und bis 300% vergrößern. Das hilft bei schwarzen Rändern innerhalb der Originaldatei. Originaldateien werden nicht verändert.
- Der Ausschnitt wird als optionales `focal_point.card` im vorhandenen Profilsystem gespeichert. Alte Fokusdaten bleiben als Ersatz erhalten; Coverposition und Helligkeit bleiben unabhängig. Keine Datenbankmigration und keine Fotopflicht.
- „Übernehmen“ ändert zunächst den privaten Formularentwurf. Der Dialog erklärt, dass erst das erfolgreiche Speichern des Profils die Änderung veröffentlicht. Bestehende private Formularwiederherstellung und Navigation bleiben erhalten. Das gespeicherte Ereignis aktualisiert Crewkarten auch bei einer reinen Ausschnittänderung.

## Geänderte Dateien

- `app/creators/CreatorsContent.tsx`: Raster, Fotoauswahl, Fokusaktualisierung und Namensumbruch.
- `components/ProfileCardPhoto.tsx` (neu), `lib/profile-photo.ts` (neu): Bilddarstellung, rückwärtskompatible Ausschnittwerte und Drag-Berechnung.
- `components/FocalPointPicker.tsx`, `app/profile/page.tsx`: bestehendes Foto erneut öffnen, Vorschau, Verschieben, Tastaturregler, Vergrößerung, Entwurfsübernahme und Speicherrückmeldung.
- `lib/profile-cover.ts`, `lib/profile-types.ts`, `lib/profile-update-events.ts`: zusätzliche optionale Ausschnittdaten und Validierung.
- `messages/{de,en,es,it,cs,hu}.json`: alle neuen Dialogtexte und zugänglichen Beschriftungen.
- `lib/profile-photo.test.mjs` (neu), `lib/profile-cover.test.mjs`, `lib/registration-entrypoints.test.mjs`: gezielte Regressionstests.

## Tatsächlich bestandene Prüfungen

### Automatisiert

33 Tests bestanden:

```sh
node --experimental-strip-types --import ./scripts/register-test-aliases.mjs --test \
  lib/profile-photo.test.mjs lib/profile-cover.test.mjs \
  lib/profile-avatar-persistence.test.mjs lib/profile-layout-contract.test.mjs \
  lib/navigation-context.test.mjs lib/registration-entrypoints.test.mjs
```

- Ausschnittgrenzen, alte Daten, Standardwerte, Drag-Berechnung bei Hoch-/Querformat, Vergrößerung und noch nicht geladenem Bild.
- Auswahl des tatsächlichen Avatars, unveränderter Portfolio-Ersatz, Platzhalter und proportionaler Zuschnitt.
- Geschützte Medien bleiben auf dem vorhandenen berechtigungsgeprüften Medienweg; kein gemeinsamer Bildoptimierungs-Cache für private API-Bilder.
- Private Entwurfsserialisierung erhält Ausschnitt und Coverwerte.
- Die tatsächlichen Profil-API-Routen wurden mit isoliertem Testdatenspeicher auf PATCH → anschließendes Lesen geprüft: Ausschnitt bleibt erhalten, originale Avataradresse sowie Coverposition und Helligkeit bleiben gleich. Fremde `user_id`-Angaben im Payload ändern nicht die kontogebundene Speicherzuordnung.
- Ereignisse nach dem Speichern und tabübergreifende Ausschnittaktualisierung einschließlich ungültiger Daten.
- Produktionsbuild einschließlich Typprüfung und vorhandener i18n-Prüfung bestanden: 1817 Schlüssel pro Sprache, keine neuen fehlenden/leeren Übersetzungen oder fehlerhaften Platzhalter.
- ESLint für die neuen/gezielt überarbeiteten Foto-Hilfen und Komponenten bestanden. Die großen bestehenden Seiten enthalten unveränderte ältere Hook-/Render-Lintbefunde; der Vergleich zum Ausgangsstand ergab keine neuen Fehler. Kein Anspruch auf einen fehlerfreien Gesamtprojekt-Lint.

### Im Browser

Lokale Next.js-Prüfseite mit den tatsächlichen Crew-/Foto-/Ausschnittkomponenten und ausschließlich selbst erstellten fiktiven Profilen und SVG-Bildern. Keine fremden Profile geändert.

- Quadratische, hochformatige und querformatige Bilder, sehr langer Name, fehlendes Foto sowie Datei mit eingebetteten schwarzen Rändern geprüft.
- Raster bei 320, 390, 480, 768, 1024 und 1440 CSS-Pixeln ohne horizontalen Seiten- oder Namensüberlauf. Fotos füllen die vorgesehenen Quadrate; keine zusätzlichen Innenabstände.
- Listenansicht bei 1440px: 36×36px-Fotos, `object-fit: cover`, Platzhalter und kein horizontaler Seitenüberlauf.
- Vorhandenes Bild im Ausschnittdialog geöffnet, auf 200% vergrößert und per Zeigergeste verschoben. Übernahme verändert die Crewkarte bei unveränderter Originaladresse. Fokus kehrt zum Auslöser zurück; Escape schließt den Dialog.
- Dialog bei 390×844px in allen sechs Sprachen geprüft: vollständig erreichbare Aktionen, keine überstehenden Schaltflächen. Verschieben, Regler und Zurücksetzen bieten keine zusätzliche Uploadpflicht.
- Gezielt drei Sekunden verzögertes Testbild: reservierter Rahmen vor und nach dem Laden unverändert 96×96px.
- Letzte Smartphonekarte kann über die feste Testnavigation gescrollt werden.

Bildbelege liegen im Visualisierungsordner der Aufgabe: `crew-cards-phone-details-after.png`, `crew-cards-laptop-after.png`, `crew-photo-crop-before.png` und `crew-photo-crop-adjusted.png`; Messwerte in `crew-photo-browser-checks.json`.

## Grenzen

- Browsergrößen sind Simulationen. Keine tatsächlichen iPhone-/Android-Geräte geprüft.
- Kein Profil einer echten Person verändert und kein produktiver Ab-/Anmeldezyklus durchgeführt. Dauerhafte Speicherung wurde an den echten API-Routen mit isolierter Datenbankanbindung geprüft, nicht an einem Produktionskonto.
- In einer Datei eingebettete Ränder verschwinden nicht automatisch. Nutzer können den Ausschnitt anpassen; extreme Ränder bzw. zu geringe Ausgangsauflösung begrenzen das Ergebnis.
- Während des abschließenden Screenshot-Aufräumens wurde die Browserverbindung unterbrochen. Die oben genannten visuellen und DOM-Prüfungen waren bereits durchgeführt und die wichtigsten Raster-/Dialogansichten gespeichert; kein zusätzlicher Listen-Screenshot wird als Nachweis behauptet.

## Nachkorrektur: zwei Karten nebeneinander

Auf ausdrücklichen Nutzerwunsch wurde anschließend ausschließlich das Raster in `app/creators/CreatorsContent.tsx` angepasst: zwei Spalten auch unter 480px, kleinere quadratische Fotos und etwas kompakterer Karteninnenabstand. Der Bildzuschnitt und die neue Ausschnittbearbeitung bleiben erhalten.

Erneut geprüft mit derselben lokalen Next.js-Prüfseite, tatsächlicher Crewkomponente und CSS aus dem neuen Produktionsbuild: 320, 375, 390, 430 und 768px zeigen zwei Karten nebeneinander; 1440px zeigt drei Spalten. Kein horizontaler Seiten- oder Namensüberlauf, auch mit langem Testnamen. Die sechs Foto-Regressionsprüfungen und der neue Produktionsbuild sind bestanden. Dies sind simulierte Bildschirmgrößen, keine echten Gerätetests. Die zuvor beschriebenen 80px-Handyfotos und einspaltigen Bildbelege dokumentieren den ursprünglichen Prüfstand vor dieser Nutzerkorrektur.
