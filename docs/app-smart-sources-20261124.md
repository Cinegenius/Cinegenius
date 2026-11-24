# Native Smart: frei kombinierbare Bereiche · 24. November 2026

## Auftrag und Stand

Isolierter Quellkandidat auf `94a9a0853a9ac01144eb04507f134feec7ceb40e`, nach der ausdrücklichen Nutzerwahl Original A und „Smart raus … einzeln … und auch zusammen“. Die frühere reine Vorschauplanung ist für diesen engen Bereich abgelöst. Keine Veröffentlichung, kein neuer nativer Build und keine physische Geräteabnahme durch diesen Kandidaten. Kostenkandidat9dc bleibt getrennt.

Maßgebliche, von APP Root übergebene A-v3-Referenz:
`/srv/cinegenius/handoffs/20261124-smart-approved-a-v3/a-v3-bereiche-kombinieren.png`
SHA256 `d4120d38a4ab0083f72e4ddebe8c34d6044db47400c8474f41933834d31b0297`.
Previewfreeze daneben: SHA256 `1723f694f68303900b454e7e0d0139c5d231b946cd873bb9b29b7354811a2eab`.
Die Beispielzahlen12/20 und Personennamen sind keine Produktdaten.

## Verhalten

- Fünf direkt erreichbare Schalter in der Reihenfolge Crew, Markt, Locations, Firmen, Jobs über der vorhandenen Filterleiste. Mehrfachwahl mit `aria-pressed`, mindestens44×44px, Tastaturbedienung. Auf schmalen Flächen mit großen/längeren Übersetzungen dürfen die Schalter umbrechen.
- Aktive Schalter haben eine ruhige grüne Fläche mit Lime-Schrift/Rand; inaktive Beschriftungen bleiben dezent, im hellen Modus ausreichend dunkel. Die Filterleiste ist deckendes Navy. Bestehende Karten, Für-dich/Alle-Auswahl, App-Hülle und gespeicherte Hintergrundpalette bleiben erhalten; Cherry wird nicht ungefragt über eine andere Nutzerwahl geschrieben.
- Kein oberer Smart-Schalter und kein altes Stern-/Sechs-Bereiche-Menü. Der untere Smart-Tab und der eigene Projekte-Tab bleiben unverändert.
- Alle32 Kombinationen einschließlich keiner Auswahl sind zulässig. Kein exklusiver erster Klick, keine automatische Reaktivierung beim letzten Ausschalten. Ohne Auswahl:0, kurzer lokalisierter Hinweis, keine Karten/Resultate, kein endloser Ladehinweis; Filteränderungen starten keinen Ersatzabruf des Explorers. Reaktivieren lädt bei geändertem Filterumfang die passenden Ergebnisse.
- Ort, Land, Detailfilter, Liste/Raster/Karte, Übersetzen/Original, Wiederholen und Karteninfo bleiben bedienbar. Der automatische Übersetzungssatz bleibt wie in94a9 ausschließlich in Smart ausgeblendet.

## Alter Zustand und Rechte

`hiddenAreas` wird für die native Darstellung auf die fünf sichtbaren Quellen normalisiert. Versteckte Projekte/News oder doppelte Einträge werden weder als sechster Schalter ausgewertet noch gezählt. Ein alter Nur-Projekte-Zustand wird zu keiner ausgewählten Quelle, nicht zu einer Ersatz-Auswahl. Lesen verändert das private History-Objekt nicht; ein bewusster Bedienvorgang speichert die normalisierte Fünferauswahl auf dem vorhandenen History-Eintrag.

Alte `browse.projectTypes` bleiben privat gespeichert, auch bei einem nativen Quellen-/Ortswechsel und Reset. Eine gemeinsame wirksame Projektion entfernt sie aus den nativen Landing-/Explorer-/Paging-Anfragen und dem Filterstatus. Alte ausschließlich auf Projekte bezogene versteckte Wünsche beeinflussen den sichtbaren Filterstatus nicht. Keine Löschung anderer privater Einstellungen. Konto-/Sitzungswechsel, echte Zurück-Navigation, aktuelle serverseitige Sichtbarkeit und Berechtigungen bleiben maßgeblich.

Der bestehende Discovery-/Suchvertrag wird nicht geändert: ein initialer erlaubter Serverbestand kann weiterhin Projektgruppen enthalten. Die native Darstellung, Karte, Anzahl und Nachladeauswahl verwenden ausschließlich die fünf Bereiche. Die frische authentifizierte Landing-Prüfung bleibt auch bei gespeicherter leerer Auswahl erhalten. Dieser UI-Kandidat behauptet keine vollständige Transport- oder KI-Kostenreduktion; keine Provider-, Datenbank-, Gmail-, Geheimnis- oder Flagänderung.

Die gewöhnliche Website behält ihre bisherigen Bereiche einschließlich Projekte und ihre Filter/Ansichten. Nur native Smart nutzt die neue Auswahl und die wirksame Projektion.

## Prüfung und Grenzen

Belege unter `/srv/cinegenius/handoffs/20261124-app-smart-sources/`; der abschließende Kandidatenbeleg bindet den unveränderlichen Commit und die Dateihashes.

63 gezielte Prüfungen (62 in der Gesamtrunde, abschließend19 Fälle einschließlich eines zusätzlichen Altzustand-Falls) bestanden: alle32 Auswahlkombinationen, Restore, Projektdetails, Karte/Viewport, Cursor-/Abbruchrennen, Kontogrenzen,17 Sprachkataloge im Landing und angrenzende Filterverträge. Die zusätzlichen Prüfungen laufen gegen tatsächliche Komponenten/Handler, nicht nur Quelltextmuster. Die ältere Landing-Testhülle bekam fehlende reale Modulbindungen; ihre18 Fälle laufen wieder.22 verpflichtende Designprüfungen und die vollständige Sprachprüfung mit17 Katalogen/11761 Schlüsseln bestanden. ESLint der betroffenen Quellen bestanden.28 Browserfälle einschließlich eines tatsächlichen Vorher-/Nachher-Vergleichs der öffentlichen Explorer-HTML und Geometrie bei320/1024px bestanden. Nach dem abschließenden Typwächter für alte allgemeine Bereichswünsche wurden12 Browserfälle auf der endgültigen Quelle erneut geprüft; keine Browserfehler, Warnungen oder externen Anfragen. Vollständiges TypeScript mit4GiB Heap auf der endgültigen Quelle ebenfalls bestanden.

Kontrollierter Browser: echte Explorer-/Filter-/Quellschalter-/Kartenkomponenten, Übersetzungsbedienung, kontogebundener History-Hook, Inhaltsgeometrie und CSS. Ergebnisse, Anmeldung, Karte, Bilder und Ortsdienst sind synthetisch; Kopf-/Fußzeile sind Geometriehilfen.17 Sprachen ab320px,393/820px sowie16/24px Grundschrift, leer/gemischt/einzeln, echte History-Rückkehr, Kontowechsel, normale Website und heller Modus werden getrennt geprüft. Die Referenz ist eine Gestaltungsvorschau; Screenshots dieses Prüfstands sind keine vollständige native App oder echte Produktionsdaten. Keine neue Produktionsanmeldung, kein echter Kartenanbieter-/Providerzugriff und kein iPhone-/Dynamic-Type-Nachweis. Vollständiger Next-Produktionsbuild gehört zum späteren bewachten Release.
