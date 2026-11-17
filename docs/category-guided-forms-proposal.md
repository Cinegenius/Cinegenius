# Kategoriegeführte Formulare – geprüfter Vorschlag

Stand: 17. November 2026. Vorschlag, noch keine Formularumstellung und kein Livegang.

## Befund

- `MarketplaceCategoryPicker` wird bereits in Anmeldung, Inserat und Bearbeitung
  wiederverwendet. Die tatsächlichen technischen Eingaben werden dagegen vor allem
  im vollständigen Inserat über `MarketplaceOfferFields` angeboten.
- `marketplaceSpecFields` unterscheidet häufig nur den Hauptbereich. Bei Kostüm
  haben etwa Kleidung, Hüte, Nähmaschinen und Pflegeprodukte noch überwiegend
  dieselben allgemeinen Felder; nur einzelne Unterkategorien sind spezialisiert.
- Viele Angaben sind freie Texte in eingeklappten optionalen Abschnitten. Klare
  Produktarten und bekannte Merkmale lassen sich so nicht zuverlässig filtern.
- Die gemeinsame Veröffentlichungsprüfung verlangt bereits Titel, Ort, Kategorie
  und einen erreichbaren Anbieter. Fotos sind ausdrücklich optional.
- Smart liest ausgewählte öffentliche Daten und Kategorien. Neue Formularfelder
  allein verbessern die Suche nicht; ihre erlaubten öffentlichen Werte müssen auch
  in derselben Such- und Filterlogik verwendet werden.

## Gemeinsamer Ablauf

1. Bereich und genaue Kategorie wählen.
2. Nur dazu passende wesentliche Angaben anzeigen.
3. Optionale Details und Bilder ergänzen.
4. Vorschau prüfen und ausdrücklich speichern/veröffentlichen bzw. einreichen.

Für bestehende Profile die direkte Bearbeitung beibehalten; keinen neuen
Pflicht-Assistenten vor jede Änderung setzen. Die Erstregistrierung bleibt kurz,
die nachgelagerte Profileinrichtung bleibt fortsetzbar. Aktuelles Design erhalten.

## Informationen nach Bereich

| Bereich | Wesentliche Einordnung | Weitere passende Angaben |
| --- | --- | --- |
| Marktplatz: Technik | Kategorie, Objektart, Bezeichnung, öffentlicher Ort/Land, Miete/Verkauf/Dienstleistung | Hersteller/Modell falls vorhanden, Anzahl, Zustand; je Kategorie z. B. Lichtart, Leistung, Anschluss oder Objektivbajonett |
| Marktplatz: Kostüm/Requisite | Kategorie, Objektart wie Hut/Kleidung/Möbel, Bezeichnung, Ort/Land | Größe, Material, Farbe, Epoche, Maße, Bestand soweit bekannt |
| Locations | Location-Art, Bezeichnung, Ort/Land, erreichbarer Anbieter | Innen/außen/beides, nutzbare Fläche, Höhe, Strom, Zugang, Ausstattung, Nutzungsbedingungen |
| Crew | Name, bestätigte Haupttätigkeit und öffentliche Ortsangabe gemäß Sichtbarkeit | Bestehende zwei Nebentätigkeiten plus eine weitere Tätigkeit, Fähigkeiten, Erfahrung, Mobilität |
| Firmen | Name, Kategorien/Leistungen, Ort/Land, verantwortliche Person | Konkrete Leistungen; z. B. bestätigte Ernährungsformen bei Catering, Einsatzgebiet, Ausstattung |

Pflichtangaben nur dort, wo sie zur verlässlichen Einordnung oder zum gültigen
Veröffentlichen nötig sind. Hersteller/Modell nicht für Eigenbauten, Fotos nicht
generell, technische Werte nicht erzwingen, wenn sie unbekannt sind. Ein fehlender
Wert ist weder `nein` noch eine bestätigte Eignung. Preis auf Anfrage bleibt möglich.
Private Telefonnummern und genaue Adressen werden nicht zu öffentlichen
Pflichtfeldern. Sichtbarkeit und Ghost-Regeln bleiben vorgeschaltet.

## Daten und bestehende Inhalte

- Einen gemeinsamen Feld- und Kategorienkatalog für Website, App, Formulare,
  Filter und Suche verwenden; stabile IDs, übersetzte Anzeigen in allen 17 Sprachen.
- Geeignete Auswahlfelder statt uneinheitlicher Freitextwerte; Zahlen mit Einheiten,
  unbekannte Angaben ausdrücklich möglich. Keine Fakten aus Fotos oder Namen raten.
- Bestehende Zuordnungen weiter lesen. Neue Angaben erst durch die verantwortliche
  Person bestätigen lassen; keine stillen Überschreibungen, Massenänderungen oder
  Entfernung alter Angebote.
- Kategorienwechsel bewahrt bereits eingegebene Details im privaten Entwurf.
  Nur bestätigte, zur aktuellen Kategorie passende öffentliche Fakten verwenden.
- Veröffentlichung, Adminprüfung und Firmen-Sichtbarkeit bleiben typabhängig wie
  bisher; weder Autosave noch eine vollständig ausgefüllte Form veröffentlicht.
- Vor einer Umsetzung die Kategorie-Feld-Matrix und die Pflichten für neue,
  bestehende und unvollständige Entwürfe konkret festlegen und mit APP Entwicklung
  koordinieren. Danach Erstellung, Bearbeitung, Filter und Smart gemeinsam prüfen.
