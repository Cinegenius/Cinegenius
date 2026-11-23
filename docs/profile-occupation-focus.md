# Haupt-, Neben- und weitere Tätigkeit

Betreiberentscheidung vom 16. November 2026: Ein Profil kann eine Haupttätigkeit,
bis zu zwei Nebentätigkeiten und höchstens eine weitere Tätigkeit auswählen.
Die Auswahl bleibt später änderbar. Karten zeigen nur Haupt- und Nebentätigkeiten;
die weitere Tätigkeit steht auf dem vollständigen Profil und bleibt suchbar.

## Gemeinsamer Web-/App-Vertrag

- `positions`: alle gespeicherten Berufsbezeichnungen; niemals zur Darstellung kürzen.
- `crew.occupations`: alle ausgewählten stabilen `departmentId`/`roleId`-Referenzen.
- `crew.primaryOccupation`: die Haupttätigkeit, weiterhin der bestehende Vertrag.
- `crew.additionalOccupation`: neue optionale Referenz oder `null`. Muss zur Auswahl
  gehören und darf nicht gleichzeitig Haupttätigkeit sein.
- Nebentätigkeiten sind die übrigen ausgewählten Berufe. Die weitere Tätigkeit bleibt
  auch bei vier Berufen freiwillig (Betreiberkorrektur 23. November 2026). Keine
  Pflichtzuordnung und keine automatische Wahl des vierten; alle Berufe bleiben suchbar.
- `profileOccupationPreview` liefert maximal drei sichtbare Berufe, Haupttätigkeit
  zuerst. Such- und Gewerkefilter verwenden weiterhin die vollständige Auswahl.
- Crew-Antworten ergänzen `displayPositions`; Freunde ergänzen `display_positions`
  und `additional_occupation`. Vorhandene Positions-/Berufs-IDs bleiben vollständig.

`POST/PATCH /api/profile` prüfen die Auswahl serverseitig und liefern bei Fehlern
die übersetzte `fieldErrors.activity`. Kontobindung und Sichtbarkeitsprüfungen bleiben
unverändert. Keine Datenbankmigration und keine Massenänderung vorhandener Profile.

## Bestehende Profile und Unterbrechungen

Mehr als vier bisher gespeicherte Tätigkeiten bleiben erhalten. Unveränderte
Berufsangaben blockieren keine Änderungen an Foto, Text oder Zertifikaten. Erst
beim Ändern der Berufszuordnung muss die Auswahl bewusst reduziert werden.
Die drei sichtbaren Berufe sind keine Löschung des Altbestands.

Private Entwurfswiederherstellung übernimmt Haupt- und weitere Tätigkeit. Entfernt
jemand einen zugewiesenen Beruf, wird dessen veralteter Platzhalter geleert; die
übrigen Berufe bleiben erhalten. Teiländerungen älterer Clients bewahren ausgelassene
`crew`-Felder. Native Clients sollen diese Regeln vor ihrem nächsten Release übernehmen.

## Katalogprüfung

Der Vergleich veröffentlichter Creditlisten von 140 Filmen und seine Grenzen stehen
in [der Untersuchung](research/crew-catalogue-2026-11-16.md). Kandidaten sind noch keine
neuen Auswahlpunkte. Bestehende IDs und Übersetzungen wurden nicht umbenannt.

## Freiwillige Schreibweise — 17. November 2026

Die Anzahl und Zuordnung der Tätigkeiten bleibt unabhängig von ihrer Schreibweise.
Ohne ausdrückliche Auswahl gilt wieder die bisherige kompakte Standardanzeige,
einschließlich etablierter Sternchen-/Schrägstrichformen. Optional speichert
`crew.occupationForm` die vom Profilinhaber gewählte männliche, weibliche oder neutrale
Form. Das ersetzt die zwischenzeitliche Pflicht zur ausgeschriebenen Beidnennung.
Siehe [Web-/App-Vertrag](occupation-form-preference.md); Berufs-IDs, Suchbarkeit und
ältere gespeicherte Angaben bleiben erhalten.

## Korrektur der Abschlusshürde · 23. November 2026

Eine fehlende Zusatztätigkeit blockiert weder Einrichtung noch Profilbearbeitung.
Die Haupttätigkeit bleibt bei mehreren Berufen bewusst wählbar; fehlt sie beim
Abschluss, erklärt der Assistent die notwendige Auswahl in der gewählten Sprache
und fokussiert das tatsächlich vorhandene Auswahlfeld. Foto, Cover und
Vorstellungstext bleiben freiwillig. Bestehende private Entwürfe und alle
ausgewählten Berufe bleiben erhalten. Kein automatisches Veröffentlichen fremder
Profile und keine Änderung bestehender Konten.

43 gezielte Berufs-/Einrichtungs-/Speicherprüfungen bestanden, einschließlich
Schritt 5 → Übersicht, fehlender Stadt/Land, Suchprofil und Firmenstandort.
Lokaler Quellstand; Veröffentlichung und physische App-Abnahme separat offen.
