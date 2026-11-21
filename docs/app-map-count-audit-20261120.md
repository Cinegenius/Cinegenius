# App-Abgleich der Karten- und Trefferzahlen

Status: lesende Prüfung am 20. November 2026 auf `eb1eefe9cbf8355cd69d423d7cc93dab156e87f5`. Keine Produktkorrektur oder Veröffentlichung. WEBs Zwischenbefund steht unter `/srv/cinegenius/handoffs/20261120-community-feedback/map-count-audit.md`: zum dortigen Prüfzeitpunkt 63 öffentliche Firmen, 34 mit Kartenpunkt, davon 33 im Europaausschnitt, sowie 29 ohne eindeutig zugeordneten öffentlichen Ortsmittelpunkt. Diese Livezahlen wurden von APP nicht erneut erhoben und können sich ändern.

## Unterschiedliche Bedeutungen im bestehenden App-Code

| Oberfläche | Zahl oberhalb der Ergebnisse | Verhalten beim Kartenausschnitt |
| --- | --- | --- |
| Firmen | `map.rows.length` | Der gemeinsame Hook entfernt Punkte außerhalb des Ausschnitts und Zeilen ohne Koordinaten aus der Kartenliste. |
| Crew | Nach vollständiger Ladung `filtered.length`; bei Providerfiltern ausdrücklich die Gesamtpersonenzahl | Gemeinsamer Hook wie Firmen; die bestätigte Provider-Ausnahme erhalten. Während Nachladen/Fehlern keine erfundene fertige Zahl anzeigen. |
| Marktplatz | Im Kartenmodus `map.rows.length`, sonst vorhandener Server-/Filterzähler | Gemeinsamer Hook wie Firmen; geladene Zeilen und serverseitiges Gesamttotal nicht gleichsetzen. |
| Locations | `filtered.length` | Separate Bounds-Filterung in `LocationsLanding`; zusätzlich den bewusst gewählten Umkreis berücksichtigen. |
| Native Smart-Entdeckung | Eindeutige bereits geladene Treffer nach lokalen Filtern | `mapPoint: null` bleibt auch bei aktiven Bounds in der Liste. Punkte außerhalb des Ausschnitts fallen heraus. Nachladen kann die Zahl erhöhen. |
| Native Organisationen, vorbereitete Folgearbeit | Serverzählung `data.count` | Liste behält die ganze geladene Seite, einschließlich Einträgen ohne Kartenpunkt. Karten-/Seitenhinweise unterscheiden Punkte, geladene Einträge und Gesamttotal. |

Die kompakte öffentliche `DirectoryMap` erklärt fehlende Punkte bisher im Info-Menü. Die Kartenanzeige selbst zählt bekannte Punkte im Ausschnitt. Smart zeigt fehlende Positionen gesondert und zählt Identitäten anhand von Typ und ID; der Zähler ist kein vollständiger Datenbankbestand. Organisationen ignorieren Kartenausschnitte bewusst für ihre Seitenliste. Diese bereits vorhandenen Unterschiede dürfen bei einer gemeinsamen Korrektur nicht pauschal vereinheitlicht werden.

## Reproduzierbare Prüfung ohne Produktionsdaten

`/srv/cinegenius/handoffs/20261120-app-map-count-audit/check.mjs` führt den tatsächlichen `useDirectoryMap` mit künstlichem React-/Verlaufszustand sowie die tatsächlichen Smart-Filter-/Zählfunktionen aus. 63 ausdrücklich künstliche Zeilen bilden nur die Verteilung nach: 33 in Europa, eine in Mexiko, 29 ohne Punkt. Für Firmen/Crew/Marktplatz ergibt die Europagrenze jeweils 33; Listenmodus, neue Filter und Zurücksetzen ergeben wieder 63. Smart behält 62 Listenzeilen: 33 Punkte und 29 ohne Position. Doppelte Gruppen erhöhen den Smart-Zähler nicht. Nach Reset sind es 63. Alle diese Funktionsprüfungen bestehen; Ergebnisse in `results.json`.

Locations und Organisationen wurden in dieser Runde nur anhand ihrer Quellen verglichen. Keine neue Browserprüfung, kein angemeldeter Live-Ablauf, keine Geräteprüfung und keine Prüfung aller Privatsphärezustände. Der künstliche Bestand ist kein Beleg über reale Firmen oder ihre Berechtigungen.

## Übergabe für eine spätere gemeinsame Korrektur

Die Anzeige muss klar zwischen Gesamttreffern mit den gewählten fachlichen Filtern, geladenen Treffern, bekannten Kartenpunkten und Treffern im sichtbaren Ausschnitt unterscheiden. Dafür sind keine vier dauerhaft zusätzlichen Zähler vorgeschrieben; die Bedeutung der tatsächlich sichtbaren Zahl muss verständlich bleiben. Einträge ohne Kartenpunkt müssen auffindbar bleiben. Keine Koordinaten aus privaten Daten, geratenen Orten oder einem unbestätigten Land ergänzen.

Nach einer Änderung sind Filterwechsel, Nachladen, Verschieben/Zurücksetzen der Karte, Listenwechsel, echte Rücknavigation und Rechtewechsel an den vergleichbaren Oberflächen zu prüfen. Die bestehende Crew-Providerregel, Smart-Adminbeschränkung und aktuelle Medien-/Profilrechte erhalten. WEB CODEX hat die App-Unterschiede und den Prüfbeleg erhalten. Ein geprüfter Korrekturcommit steht aus; der Mitgestalten-Entwurf und regionale Arbeiten bleiben getrennt erhalten.
