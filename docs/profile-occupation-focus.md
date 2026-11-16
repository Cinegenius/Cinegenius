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
- Nebentätigkeiten sind die übrigen ausgewählten Berufe. Bei vier Berufen muss die
  weitere Tätigkeit ausdrücklich benannt werden; keine automatische Wahl des vierten.
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
