# Kleine Newsfotos auf der Startseite · App-Abgleich

Stand: 21. November 2026. Die Website-Funktion ist unter
`1aa844cc7321218f7313e3a29adc95bc7edccff0` veröffentlicht. WEB-Beleg:
`/srv/cinegenius/handoffs/20261121-home-news-photos/receipt.json`, Deployment
`dpl_2itDZo4PpfQnwhJUk5D7jMNdoqfY` mit Status READY. Das bestätigt keine Prüfung
des installierten iPhones.

## Übernommenes Verhalten

Die Newszeile zeigt auch auf schmalen Bildschirmen ein kleines Artikelfoto
(80 × 64 CSS px, unbeschnitten). Ein vorhandenes Titelbild hat Vorrang, sonst
wird das erste gültige Galeriebild verwendet. Ohne Bild bleibt die Zeile rein
textlich; es gibt weder einen leeren Bildplatz noch ein Herausgeberlogo als
Artikelbild. Herausgeber und bekannte Bildurheber erscheinen zurückhaltend.
Die Karte führt zum Originalartikel mit dessen vollständigen Nachweisen.

Für den vorbereiteten App-Quellstand wurden die Homepage-Darstellung und die
zusätzliche Auswahl des bestehenden Felds `image_gallery` übernommen. Der
gemeinsame Galerieparser entspricht der veröffentlichten Version. Weil diese
ältere App-Basis den Namensraum noch nicht hatte, wurde nur der benötigte,
bereits veröffentlichte Schlüssel `NewsGallery.creator` in allen 17 Katalogen
ergänzt. Andere vorhandene Sprach- und App-Ergänzungen bleiben erhalten.

`ListingImage` und `MediaImage` verwenden weiterhin die geschützte Bildausgabe
mit begrenzter Wiederholung. Keine Originaldatei, Bildzuordnung, Freigabe oder
Lizenz wird durch diese Anzeige verändert. Länder-/Themenwahl, Reihenfolge,
Organisationenkarten und horizontale Seiten mit drei Beiträgen bleiben erhalten.
Keine neue API, Migration, Redaktionsautomation oder Aktivierung.

## Integration und Abhängigkeiten

Produktcommit: `144059cb517301d0aee51a57f96a035b8d736f2f` auf
`codex/app-home-news-photos-20261121`.

Dieser Zweig basiert auf dem vorbereiteten App-Stand `63867e42`, **nicht auf dem
neuesten Website-Hauptstand**. Er ist kein vollständiges Release-Paket. Bei der
lokalen App-Zusammenführung müssen die bereits veröffentlichten Galerie- und
Medienregeln sowie die vollständigen Artikel-Nachweise aus `a58ee77d`/`1aa844cc`
erhalten bleiben. Ebenso neuere Länder-, Weiterleitungs-, Übersetzungs- und
Analyseänderungen nicht durch ältere Dateien ersetzen. Enthält der lokale
Serverstand `1aa844cc` bereits, ist das Homepage-Verhalten dort schon vorhanden;
es muss nicht doppelt eingespielt werden.

Das Produktdelta für die Homepage ist eng begrenzt. Zusätzliche Helfer und
Sprachschlüssel sind nur für die ältere App-Basis ergänzt und dürfen keine
neueren vollständigen Kataloge überschreiben. Native Navigation, Smart-Zähler,
Farben, Work und RoomPlan wurden nicht verändert. Der eingefrorene Stand
`4327fc6` und die separat gesicherte Crew-Rotation bleiben erhalten.

## Prüfung und offene Geräteabnahme

APP-Prüfbeleg mit endgültigem Commit, Einzelresultaten, Screenshots und
Quellmanifest:
`/srv/cinegenius/handoffs/20261121-app-home-news-photos/receipt.json`.

- 50 gezielte Tests bestanden: Homepage, Galerieauswahl, begrenzte Abfragen,
  Bildwiederholung und Optimizer-Schutz.
- 33 Chromium-/WebKit-Browserfälle bestanden: 320/390/768/1366px mit den
  vorhandenen App-Kennungen `cinematic`/`pure`, zusätzlich alle 17 Sprachen bei
  320px. Die Kennungen sind kein Nachbau der nativen Swift-Gestaltung.
- Vier weitere Browserfälle für vorübergehende und dauerhafte Bildfehler
  bestanden: genau eine Wiederholung, geschützte Thumbnail-Adresse, lokalisierter
  Fehlerhinweis und weiterhin bedienbarer Artikel-Link.
- Sprachprüfung: 17 Kataloge, 11212 Schlüssel, keine neuen ungeprüften Literale.
  Designprüfung und Lint der drei Produktdateien bestanden, keine Lint-Meldungen.
- Vollständiger Build einschließlich TypeScript bestanden (Exitcode 0).
  Diese Arbeitskopie besitzt keine Produktionskonfiguration; protokollierte
  fehlende Supabase-Konfiguration und nicht verfügbare Empfehlungen bei der
  statischen Seitenerstellung sind kein Test echter Daten oder Konten.
- Ein erster Browserlauf endete mit Exitcode 143 vor der abschließenden
  Ergebnisdatei; Ursache nicht festgestellt. Der vollständig protokollierte
  Folgelauf bestand alle 33 Fälle. Frühere Teilbelege bleiben separat erhalten.

Die isolierte Browserprüfung nutzt die tatsächlichen Homepage-, Bild- und
Blätterkomponenten mit künstlichen Beiträgen/Bildern, ersetztem Datentransport
und App-Darstellungskennungen. Geprüft werden Bildgröße, Galeriefallback,
fehlende Bilder, Urheberbezeichnung in allen 17 Sprachen, Antippen/Tastatur,
Blättern, Artikelziel und echte Browser-Zurück-Navigation. Der Artikel in dieser
isolierten Prüfung ist eine Testzielseite; seine vollständigen Live-Nachweise
gehören zum getrennten öffentlichen WEB-Prüfbeleg. Die Browserprüfung spielt
keine Swift-Oberfläche oder vollständige native Gestaltung nach.

Echte Anmeldung, iPhone/iPad, native sichere Bildschirmränder, dynamische
Schriftgröße und tatsächliche Fingergesten bleiben offen. Diese Geräteprüfung ist
mit der lokalen Mac-Aufgabe am installierten App-Stand abzustimmen; keine
konkurrierende Installation durch diese Server-Arbeit. **Kein neuer App-Livegang:** der Smart-/Work-Halt bleibt
bestehen. Die von WEB gemeldete Website-Freigabe für Währungen und Mitgestalten
ist ein separates Paket und keine Aufhebung dieses Halts.
