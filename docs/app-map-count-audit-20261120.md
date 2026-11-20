# App-Abgleich der Karten- und Trefferzahlen

**Späterer Nachtrag am 20. November:** Die neu gemeldete Crew-Differenz ersetzt die unten historisch erhaltene Anbieter-Ausnahme. Die aktuelle sichtbare und zugängliche Gesamtzahl folgt jetzt auch bei Anbieterfiltern der gefilterten Auswahl; siehe [gemeinsamer Vertrag](map-result-counts.md#app-follow-up-for-the-reported-crew-mismatch). Der frühere Prüfstand und seine Belege bleiben als Verlauf erhalten.

Aktualisierung nach Markus' Auftrag „dann mach“: Die gemeinsame Korrektur `822c27c8446e73dad1e37c7c4b4f82c8f359a735` ist als `d7abae6` in den separaten App-Zählerzweig übernommen; native Ergänzungen sind umgesetzt. Die folgenden Bestandsbefunde bleiben als Vorhervergleich erhalten. Der zuvor eingefrorene UI-Stand `4327fc68f17dada987f5c2366f192a5bd26b254d` wurde nicht verändert.

Ausgangsstand vor der Umsetzung: lesende Prüfung am 20. November 2026 auf `eb1eefe9cbf8355cd69d423d7cc93dab156e87f5`, damals ohne Produktkorrektur oder Veröffentlichung. WEBs Zwischenbefund steht unter `/srv/cinegenius/handoffs/20261120-community-feedback/map-count-audit.md`: zum dortigen Prüfzeitpunkt 63 öffentliche Firmen, 34 mit Kartenpunkt, davon 33 im Europaausschnitt, sowie 29 ohne eindeutig zugeordneten öffentlichen Ortsmittelpunkt. Diese Livezahlen wurden von APP nicht erneut erhoben und können sich ändern.

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

Nach einer Änderung sind Filterwechsel, Nachladen, Verschieben/Zurücksetzen der Karte, Listenwechsel, echte Rücknavigation und Rechtewechsel an den vergleichbaren Oberflächen zu prüfen. Die bestehende Crew-Providerregel, Smart-Adminbeschränkung und aktuelle Medien-/Profilrechte erhalten. WEB CODEX hat die App-Unterschiede und den ursprünglichen Prüfbeleg erhalten. Zum Ausgangsaudit stand ein Korrekturcommit noch aus; die anschließende Umsetzung und verbleibende Prüfgrenzen stehen unten. Der Mitgestalten-Entwurf und regionale Arbeiten bleiben getrennt erhalten.

## Umgesetzte Korrektur und native Ergänzungen

- Der gemeinsame WEB-Fix erhält oben den vollständig gefilterten Verzeichnisbestand. Die Kartenliste folgt weiterhin dem Ausschnitt; die sichtbare `MapResultSummary` unterscheidet Punkte im Ausschnitt, außerhalb und ohne Position. „Alle N anzeigen“ setzt nur den Kartenausschnitt zurück und öffnet die Liste. Such-/Kategorie-/Ortsfilter bleiben erhalten; Marktplatz-Nachladen verwendet weiterhin die separate Listenlänge. Der bestätigte Crew-Providerzähler bleibt erhalten. Vertrag: `docs/map-result-counts.md`.
- In der App trägt die Zahl von Firmen, Crew, Marktplatz, Locations und Organisationen die kurze sichtbare Beschriftung „gesamt“. Bei Smart lautet sie „geladen“. Beide neuen Schlüssel unter `NativeBrowseCounts` stehen in allen 17 Katalogen. Andere Zähler bekommen ohne ausdrücklichen Aufruferparameter keine neue Bedeutung.
- Native Smart zählt die geladenen eindeutigen Identitäten nach den fachlichen Filtern, vor der Kartenbegrenzung. Karte und gemeinsame Zusammenfassung verwenden denselben geladenen Bestand. Die eigentliche Ergebnisliste behält den Ausschnitt und Einträge ohne Position. „Alle anzeigen“ entfernt ausschließlich Bounds und öffnet die Liste; es löst keinen neuen KI-Aufruf aus und verändert keine übrigen Filter. Das gewöhnliche WEB-Smart-Verhalten bleibt erhalten.
- Organisationen behalten die serverseitige Gesamtzahl und die vollständige geladene Seite. Beim Filterwechsel zeigen Toolbar und Karte einen offenen Ladezustand anstelle einer vermeintlich bestätigten Zahl. Der vorhandene Seitenhinweis erklärt geladene und kartierte Einträge. Kartenziehen entfernt keine Organisation ohne Punkt.
- Die Kartenhinweise verwenden in der exakt erkannten App-Darstellung die vorhandenen App-Text-/Akzentfarben mit den gemeinsamen Primär-/Akzentfarben als Rückfall. Damit bleiben die Hinweise und „Alle anzeigen“ auf dunklen wie hellen App-Flächen lesbar. Die normale Website behält ihre bisherige Textgestaltung. Kategorienfarben, Porträts, Crew-Mischung und eingefrorene native Themen wurden in dieser Folgearbeit nicht umgebaut.

Keine API-, Datenbank-, Kartenanbieter-, Berechtigungs- oder Medienänderung. Keine geratenen Koordinaten, keine neuen Standortabfragen. Die separate Länderpriorisierung und Mitgestalten bleiben eigenständige WEB-Arbeiten. Die getrennte App-Übersicht `docs/CINEGENIUS-APP-UEBERSICHT.md` wird mit dem geprüften Stand über WEB CODEX ergänzt; dieser Fachbeleg ersetzt sie nicht.

## Prüfungen der Korrektur

Belege: `/srv/cinegenius/handoffs/20261120-app-map-counts/receipt.json`, Tests und Browserartefakte im selben Verzeichnis. 76 gezielte Regressionen sind bestanden; darin neue Prüfungen der tatsächlichen nativen Toolbar, Smart-Kartenanzeige und Organisations-Ladezustände. Zwei anfängliche Fehlschläge gehörten zum Testaufbau: dessen Platzhalter `summary` kollidierte mit dem echten HTML-Element. Der Platzhalter wurde eindeutig benannt, die Erwartungen unverändert erneut geprüft.

Die Browserprüfung verwendet tatsächliche Smart-, Organisations-, Verzeichnis- und Zählerbausteine mit künstlichen Daten, Navigation und Kartenereignissen. Alle 36 Fälle in Chromium und WebKit bestehen bei 320/393/834px und den vorhandenen CSS-Kennungen `cinematic`/`pure`; bei 320px werden außerdem alle 17 Sprachen geprüft. „Alle anzeigen“, Sprachwechsel mit erhaltenem Suchtext/Ansicht, vollständige Organisationsliste und 44px-Aktionen sind enthalten. Der erste Browserstart benötigte eine fehlende Browser-Testvorgabe für `process.env`; kein Produktcode wurde dafür verändert. Die helle Testansicht setzt die App-Text-/Akzentvariablen ausdrücklich für die neuen Kartenhinweise; sie reproduziert nicht sämtliche Farbregeln des neueren nativen Pakets und ist keine vollständige Prüfung der hellen Kartenansicht. Das ist auch keine Prüfung der echten Kartenkacheln, Anmeldung, iPhone-Sensoren oder des aktuell lokal installierten nativen Pakets 2026112007.

TypeScript, Sprachprüfung (17 Kataloge, 11211 Schlüssel) und gemeinsame Designprüfung sind bestanden. Der Vergleich der betroffenen Dateien mit dem unveränderten Vorgänger findet keine neuen Lint-Meldungen; drei vorhandene Crew-Fehler und fünf vorhandene Hook-Warnungen bleiben getrennt dokumentiert. Der abschließende vollständige Build ist mit Exitcode 0 in 117,44 Sekunden bestanden; Laufstatus und genaue geprüfte Commit-ID stehen im Beleg. Zwei frühere Buildaufrufe endeten mit Signalstatus 143; beim zweiten waren Kompilierung, TypeScript und Seitenerstellung bereits abgeschlossen. Diese Aufrufe sind separat vom abschließenden Lauf ausgewiesen. In dieser isolierten Arbeitskopie fehlen Produktionszugänge; Hinweise auf nicht geladene Empfehlungen/Projektdaten werden deshalb nicht als erfolgreich geprüfte Datenabrufe gewertet.

Diese App-Ergänzungen wurden hier nicht veröffentlicht, nicht auf das iPhone installiert und nicht mit der eingefrorenen UI-Freigabe gleichgesetzt. WEB verantwortet die separat beauftragte Veröffentlichung des gemeinsamen Zählerfixes; deren Livebeleg bleibt vom App-Beleg getrennt.
