# App: Länderbestand und veröffentlichter Sprachstand

Stand: 20. November 2026. Mexiko hat bei der mit WEB CODEX abgestimmten Länderarbeit Priorität; Italien, Spanien, Frankreich, Schweiz, Österreich und Ungarn sowie bereits vorhandene Länder werden mit berücksichtigt. Dies ist ein Bestandscheck der vorhandenen gemeinsamen App-Quellen. Neue Länder-/Währungsfunktionen sind damit weder implementiert noch veröffentlicht.

## Veröffentlichte Basis und erhaltene App-Arbeit

WEB hat die drei Sprachkorrekturen `8e72fdb`, `2c3726e` und `a9afd8e` unter Hauptstand `a9afd8e4057b932d1e15cd116deb123c25064586` veröffentlicht. Beleg: `/srv/cinegenius/handoffs/20261120-spanish-form-localization/receipt.json`, Deployment `dpl_8xUt2LcsU4ua5MwMbMLp7YUbRfDB`. Die App hatte deren Inhalte bereits gezielt übernommen. Der anschließende Abgleich der Historie mit diesem Hauptstand änderte gegenüber `6fd33cc1a1d502a188249536f77e35a4c0b311a2` keine Produktdatei.

Crew-Mischung, vollständige Porträts, App-Farben und News/Organisationen bleiben in unserem vorbereiteten Zweig erhalten; sie sind nicht Teil dieser WEB-Veröffentlichung. Ebenso erhalten: vier zusätzliche App-Organisationsschlüssel, native Work-/RoomPlan-Verträge, Header und Shots / News / Smart / Projekte / Work. Keine Installation älterer Swift-Quellen, keine Migration, Aktivierung oder Veröffentlichung durch diesen Abgleich.

## Tatsächlicher Länder- und Sprachbestand

Die gemeinsame Länderauswahl enthält 250 Einträge. Alle Einträge wurden in allen 17 unterstützten Oberflächensprachen angezeigt und aus dem übersetzten Namen wieder zum gleichen Ländercode aufgelöst: 4250 erfolgreiche Kombinationen. In weiteren 4250 Kombinationen gewann die ausdrücklich gespeicherte Sprache gegen Browser- und Landesvorgabe. Dies prüft die tatsächlichen gemeinsamen Funktionen; es ersetzt keinen angemeldeten Anmelde-/Abmeldeablauf auf dem Gerät.

| Land | Erkannte regionale Browsersprache | Ohne gespeicherte oder unterstützte Browsersprache | Statischer Ortskatalog: Städte / Regionen |
| --- | --- | --- | --- |
| Mexiko | es-MX → es | derzeit de; fehlender MX-Auffangwert | 624 / 32 |
| Italien | it-IT → it | it | 598 / 20 |
| Spanien | es-ES → es | es | 544 / 19 |
| Frankreich | fr-FR → fr | fr | 657 / 13 |
| Schweiz | de-CH → de, fr-CH → fr, it-CH → it | de | 73 / 26 |
| Österreich | de-AT → de | de | 29 / 9 |
| Ungarn | hu-HU → hu | hu | 89 / 20 |

Die Zahlen beschreiben einen vorhandenen, begrenzten Ortskatalog, keine vollständigen Landesverzeichnisse und keine tatsächlich öffentlichen Crew-/Angebotstreffer. Sprache und Suchland bleiben unabhängig. Für die mehrsprachige Schweiz dürfen unterstützte Browserpräferenzen oder eine manuelle Auswahl nicht durch eine pauschale Landesvorgabe überschrieben werden. Eine eigenständige mexikanische Sprachfassung ist hier nicht vorhanden.

## Ortsauswahl: erfolgreiche Wege und reproduzierbarer Fehler

Die tatsächliche `/api/places`-Route wurde mit synthetischen Requests und einem ersetzten Antworttransport ausgeführt. Sie findet die sieben ausgewählten Beispielstädte Mexiko-Stadt, Rom, Madrid, Paris, Zürich, Wien und Budapest in allen 17 Sprachen: 119 erfolgreiche Suchfälle. Für Mexiko finden `CDMX`, `Ciudad de México`, `Mexico City`, `México` und `Mexico` die gleiche erwartete Stadt-ID `geonames:3530597`; breitere Eingaben dürfen zusätzliche Orte liefern. Die Route behält `private, no-store`.

Von 119 Prüfungen des ausgewählten Ortsnamens mit der tatsächlichen Schreibvalidierung bestehen 118. Ein Fall schlägt fehl: Wien erscheint unter `zh-Hans` als `维也纳`. Der API-Fallback `cityName()` kennt diese Schreibweise, der Aliasindex und `city.names` in `placeFieldsForId()` jedoch nicht. `placeWriteFields('维也纳, 奥地利', 'geonames:2761369')` ergibt deshalb `pending` ohne Stadt-/Regions-ID. Weitere 119 Prüfungen verwenden genau den von `PlaceField` gebildeten Pfad aus API-Anzeigename, Region und Ländercode. Auch hier bestehen 118: `维也纳, Vienna, AT` behält zwar die Region, verliert aber die Stadt-ID und wird `pending`. Die abweichende Anerkennung von Anzeige und Schreibvalidierung muss gemeinsam korrigiert werden; keine Aufweichung der Prüfung ausgewählter IDs.

Der erste Auditlauf stoppte an diesem Befund. Der Folgelauf zeichnet negative Fälle ausdrücklich auf, um die übrigen Länder ebenfalls zu prüfen; sein erfolgreicher Abschluss bedeutet nicht, dass diese Ortsprüfung bestanden ist. Die vorhandene internationale Katalogsuite prüft `city.names[locale] ?? city.name`; sie deckt damit nicht automatisch den zusätzlichen API-Anzeigefallback ab. WEB CODEX hat den reproduzierbaren Fehler zur gemeinsamen Ortskorrektur erhalten.

## Preise und nächste gemeinsame Schnittstellen

`listingPriceLabel()` und `listingStructuredOffers()` geben derzeit unabhängig von den geprüften Landes-/Sprachvarianten Euro aus. MXN, CHF und HUF sind in diesen Verträgen noch nicht auswählbar. Die in WEB beauftragte Währungsauswahl benötigt ein gemeinsames, serverseitig geprüftes Angebotsfeld sowie übereinstimmende Eingabe, Detail-/Kartenanzeige, Filter und strukturierte Daten. Bestehende Beträge erhalten; keine automatische Umrechnung und keine Preiswährung aus der Anzeigesprache ableiten. Hier wurde weder ein paralleles Währungsfeld noch eine zweite Länderlogik eingeführt.

## Angekündigter Länder-Vertrag aus WEB · 20. November

WEB CODEX meldet die Umsetzung auf `codex/country-first-discovery-20261120`.
Der Gesamtstand ist **noch ungeprüft, nicht übernommen und nicht veröffentlicht**.
Die folgenden Regeln dokumentieren die vorgesehene gemeinsame Schnittstelle,
keinen bereits bestandenen App-Ablauf:

- `/api/browse-preference` soll auch Gästen
  `{userId: null, place: {country, region: '', city: ''}}` liefern. Das grobe
  aktuelle Land kommt aus der Vercel-Herkunftsangabe, nicht aus der Sprache,
  GPS-Abfragen oder einer Speicherung der IP-Adresse.
- Bei Reisenden hat das aktuelle Land Vorrang vor einem abweichenden Profilort.
  Ein Profilort verfeinert dasselbe Land oder dient bei fehlender Netzregion als
  Rückfall. Dadurch wird weder der gespeicherte Profilort geändert noch eine
  Angebotswährung abgeleitet.
- Eine ausdrückliche Länder-, „Alle“- oder Sortierwahl beendet die automatische
  Priorisierung. Die Wahl bleibt im kontogebundenen echten Verlauf erhalten;
  Nachladen oder Zurück dürfen sie nicht still zurücksetzen.
- Verzeichnisse behalten alle passenden Treffer und ordnen die bevorzugte
  Region zuerst. Auf der Homepage erfolgt diese Priorisierung vor Limits;
  Crew-Vorrang für 24 Stunden, anschließende Rotation und Marktplatz-Kategorienmix
  bleiben innerhalb der Region erhalten. Private Crew-Orte werden vor der
  Sortierung ausgeblendet.
- News erhält ausdrückliche Länderwahl und redaktionelle Zuordnungen. Nur die
  automatische Auswahl folgt dem aktuellen Land.

Vor dem App-Port benötigt APP den geprüften Commit, konkrete Schnittstellen und
Prüfbelege. Danach gezielt Gäste, Reisen mit abweichendem Profilort, fehlende
Netzregion, bewusste Auswahl einschließlich „Alle“ und Sortierung, Kontowechsel,
Nachladen, Zurück und Sprachwechsel prüfen. Treffermengen, Privatsphäre und die
separat gesicherte Crew-Rotation müssen erhalten bleiben. Browserprüfungen und
echte Geräteprüfung bleiben getrennt. Der App-Release-Halt besteht unverändert;
diese Dokumentation startet weder einen Port noch einen Hintergrundagenten.

## Prüfbelege und Grenzen

Belege liegen unter `/srv/cinegenius/handoffs/20261120-app-regionalization-audit/`: `matrix.json`, reproduzierbares `audit.mjs`, ursprünglicher negativer Lauf, gezielte bestehende Regressionstests und abschließender `receipt.json`. Das Audit liest ausschließlich Quellen und den statischen Katalog. Testanfragen und Testdaten sind ausdrücklich künstlich; keine Produktionsdatensätze wurden geändert.

Die fünf bestehenden Testdateien für Sprachen, News-Regionen, native Länderwahl/-abfragen und internationale Ortsauswahl ergeben 67 Fälle: 66 bestanden, ein vorhandener Fixture-Fehler. `all nine comma-bearing country display labels require the complete matching country suffix` definiert neun künstliche BQ-Ländernamen, iteriert inzwischen aber über 17 Sprachen. Ab Französisch fehlt der Ländername; der Test erzeugt `Kralendijk, Bonaire, ` und erwartet dennoch eine gültige Auswahl. Test und Produktquellen sind bytegleich zu `6fd33cc`. Die 31793 kanonischen Ortspfade und ihre vorhandenen Katalogübersetzungen bestehen; daraus folgt weiterhin keine vollständige Abdeckung des zusätzlichen API-Anzeigefallbacks. Der Fixture-Fehler wurde nicht durch abgeschwächte Validierung verdeckt, sondern getrennt an WEB übergeben.

Die bisherigen Prüf- und Fehlergrenzen aus `/srv/cinegenius/handoffs/20261120-app-form-localization/receipt.json` gelten weiter: ältere Fahrzeug-Auswahltexte, deutsche Kapazitätszeile, bestehende Lint- und Karten-Testabweichungen. Der Historienabgleich ändert diese nicht. Für reine Dokumentation und bereits übernommene, identische Produktdateien wird kein weiterer Produktionsbuild oder Browserlauf als neue Funktionsprüfung ausgegeben.

Aktuelle eigenständige Swift-Sprachdateien und ein physisches iPhone sind hier nicht verifiziert. Offen sind echte Anmeldung, Formularauswahl/Speicherung und Rücknavigation auf dem Gerät, Sprachwechsel mit ungespeicherten Angaben, Softwaretastatur und Darstellung ab 320px in den betroffenen Abläufen. Zeitzonen, Telefonnummern und vollständige regionale Formular-/Rechtstexte sind durch diesen begrenzten Audit ebenfalls nicht abgedeckt. Keine pauschale Länder- oder App-Freigabe aus Katalogvollständigkeit ableiten.
