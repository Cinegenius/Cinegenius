# Gemeinsames Ortsmodell

Stand: 9. November 2026. Datenbankmigration und Bestandszuordnung wurden produktiv angewendet und geprüft; die Anwendung wurde veröffentlicht. Die öffentliche Ortsabfrage ist mit einem separat geprüften Routenfix veröffentlicht und live geprüft. Die tägliche Journalbereinigung ist vorbereitet und bleibt nach ausdrücklicher Betreiberentscheidung vorerst deaktiviert.

## Datenmodell und Quellen

`lib/places/catalog.json` enthält einen festgehaltenen GeoNames-Datenstand. Die Quellen, Lizenz und Prüfsummen stehen in `lib/places/source.json`. Aktuell: 250 Länder/Gebiete, 3.865 Regionen, 12.896 weitere Verwaltungsbezirke zur Unterscheidung von Vorschlägen und 31.793 bewohnte Orte. Der Ausgangsbestand enthält größere Orte und Hauptorte; er ist kein vollständiges Gemeinderegister. Historische/verlassene Siedlungen und Stadtteile (`PPLH`, `PPLQ`, `PPLW`, `PPLX`) werden nicht als neue Stadtvorschläge angeboten. Vorhandene Angaben werden deshalb weder gelöscht noch automatisch umgedeutet. Kleinere und unbekannte Orte können manuell eingegeben werden und bleiben bis zur eindeutigen Prüfung offen.

Quelle: [GeoNames-Export](https://download.geonames.org/export/dump/), einschließlich sprachgekennzeichneter Alternativnamen. Lizenz: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Namen und Auswahl sind für CineGenius gefiltert und um dokumentierte Varianten ergänzt. `scripts/build-place-catalog.py` erzeugt den Stand deterministisch aus lokalen Quelldateien. Datenänderungen werden bewusst geprüft und veröffentlicht; während der Eingabe gibt es keine externen Geocoding- oder Übersetzungsaufrufe.

Gemeinsame Felder in Profilen, Firmen, Inseraten, Projekten, Organisationen, Organisationseinträgen und Community-Beiträgen:

| Feld | Bedeutung |
|---|---|
| `place_country_code` | Länderkennung; Anzeige über `Intl.DisplayNames` in der gewählten Sprache |
| `place_region_id` | stabile GeoNames-Identität mit Länderpräfix, z. B. `DE:geonames:2951839` für Bayern |
| `place_city_id` | stabile GeoNames-Identität einer Stadt/Gemeinde, z. B. `geonames:2886242` für Köln |
| `place_city_name`, `place_region_name` | getrennte Namen; Filter verwenden IDs |
| `place_status` | `pending`, `verified` oder `empty`; keine Veröffentlichungsfreigabe |
| `place_original` | ursprüngliche, ungeprüfte Angabe bzw. vom Mitglied bestätigter Auswahlpfad |

Ein bestätigtes Land allein ist zulässig, etwa bei einer Produktionslandangabe. Daraus entsteht kein Stadteintrag. Pflichtfelder für den persönlichen bzw. Angebotsstandort verlangen eine Stadt. Vorhandene Postleitzahlen, Adressen, Gebietsangaben und verknüpfte Dreh-Locations bleiben unabhängig erhalten.

Die gemeinsamen Felder sind serverseitig bestimmt. Von Clients übermittelte Kanonisierungsergebnisse werden nicht übernommen. Bei neuen Firmen/Inseraten wird die ältere `city`-Spalte nur mit dem Stadtsegment gefüllt. Private Editoren bauen den vollständigen Auswahlpfad aus den getrennten Feldern wieder zusammen. Profil-`location` und bestehende Freitextfelder dienen während der Umstellung weiter als kompatible Darstellung; sie sind keine Filteridentitäten.

## Zuordnungsregeln

Ohne ausdrückliche Auswahl einer Orts-ID werden ausschließlich dokumentierte, geprüfte Schreibvarianten für Köln und Frankfurt am Main zugeordnet. Ein einziger Treffer im unvollständigen Katalog beweist keine Eindeutigkeit: kleinere Namensvetter können fehlen. Andere Texte bleiben bis zur Auswahl oder Prüfung offen, auch bei bekanntem Land und Region. Bei einer ausdrücklichen Auswahl prüft der Server ID, Land, Region und Namensalias gemeinsam. Es wird weder aus Bekanntheit, Sprache noch Postleitzahl ein Land geraten. Gleichnamige Orte bleiben getrennt. Die sechs unterstützten Sprachen haben eigene Oberflächentexte und, soweit in der Quelle vorhanden, eigene Ortsnamen. Fehlt ein lokalisierter Ortsname, wird der vorhandene Standardname verwendet; Mitgliedstexte werden nicht automatisch übersetzt.

| Eingabe | Ergebnis |
|---|---|
| `DE`, `Deutschland`, `Germany` und unterstützte Übersetzungen | identisches Land `DE`; in Deutsch „Deutschland“ |
| `Köln, DE`, `Cologne, Germany`, `Koeln, Deutschland` | identische Stadt `geonames:2886242` |
| `Frankfurt a.M., DE`, `Frankfurt am Main, DE`, `Frankfurt/Main, DE` | identische Stadt `geonames:2925533` |
| `Frankfurt, DE` | offen; keine automatische Entscheidung zwischen Namensgleichen |
| `Bayern, DE` | Region Bayern, keine Stadt-ID; Stadt muss geprüft/ergänzt werden |
| Ortsname ohne Land | erhalten und offen; kein geratenes Land |
| Unbekannte Gemeinde oder widersprüchliche Region | erhalten und offen; kein neuer Filtereintrag |
| alte parallele Profilfelder `location_city`, `location_region`, `location_country` | beim Bestandslauf vorsorglich zur Prüfung; keine stillschweigende Wahl einer Datenquelle |

Die Tabelle beschreibt geprüfte Regeln und Testfälle. Zum Beispiel bleiben „Essen, DE“ und „Mühlhausen, DE“ ohne ausdrückliche Ortsauswahl offen. Namensgleiche Vorschläge wie Ashford in Kent und Surrey behalten ihre getrennten IDs; der Bezirk erscheint als zusätzliche Orientierung. Im Mitgliedsformular wird die ausgewählte ID getrennt vom sichtbaren Text in privaten Entwürfen mitgeführt und beim Ändern von Land, Region oder Stadt gelöscht. Sie ist kein Nachweis, wie oft diese Werte in der Produktionsdatenbank vorkommen.

## Eingabe, Suche und Prüfung

`PlaceField` wird in Einrichtung, Profilbearbeitung, Firmenformular, Angebotsformularen, Dashboardbearbeitung, Projektanlage, Community und Organisationseingaben wiederverwendet. Länderwahl erfolgt vor optionaler Region und Stadt. Vorschläge zeigen die Region; manuelle Eingabe bleibt bei fehlenden Vorschlägen oder Netzfehlern möglich. Der sichtbare Hinweis erklärt die spätere Prüfung. Äquivalente Eingaben werden auf dem Server erneut geprüft.

Crew, Firmen, Jobs, Locations und Marktplatz einschließlich Fahrzeuge und Tierportfolios nutzen `PlaceFilters` und dieselben IDs. Länder, Regionen und Städte werden getrennt nach aktiver Sprache sortiert. Öffentlich aggregierte Marktplatz-/Location-Optionen enthalten ausschließlich veröffentlichte Datensätze. Marketplace-Abfragen wenden Orts-IDs vor der Seiteneinteilung an. Die Locationübersicht gruppiert nach Stadt-ID, nicht nach dem gespeicherten Namen. Unklare Angaben bleiben über die ungefilterte Suche erreichbar.

`/admin/places` zeigt offene Angaben und bei Profilen gegebenenfalls vorhandene parallele alte Felder. Die Auswahl eines vorhandenen Orts ist ausdrücklich erforderlich. Ein gewählter Vorschlag kann mit seiner ID auch Namensgleichheiten auflösen. Der Server prüft die ID, den Namen und das Land. Die Zuordnung ändert nur die gemeinsamen Ortsfelder, erhält Originaltexte und prüft vor dem Schreiben, ob der Datensatz inzwischen verändert wurde. Veröffentlichungs- und Eigentumsregeln bleiben wirksam.

Das Audit und die Adminansicht prüfen die optionalen Profilspalten `location_city`, `location_region`, `location_country` zuerst mit Projektionen ohne Ergebniszeilen. Fehlende optionale Spalten werden ausgelassen und als nicht vorhanden dokumentiert. Andere Schema- oder Zugriffsfehler werden weiter gemeldet; sie führen nicht zu einem ungeprüften Schreibversuch. Das produktiv belegte Profilmodell mit ausschließlich `location` wird damit unterstützt.

Bei Projekten bleiben `country` und `shoot_locations` sowie die drei Quellen `metadata.location`, `metadata.project_details.country` und `metadata.project_details.shoot_locations` getrennt. Ein vorhandener primärer Standort stammt aus `metadata.location`. Ohne diesen Standort wird höchstens ein allein vorhandenes oder übereinstimmendes Produktionsland als reines Land zugeordnet; ein Produktionsland erzeugt keine Stadt. Drehorte werden separat dokumentiert und weder als Produktionsland eingesetzt noch mit einem abweichenden Produktionsland gleichgesetzt. Widersprüchliche Produktionsländer, unterschiedliche gleichzeitig vorhandene Drehortkopien und unerwartete JSON-Typen bleiben prüfbedürftig. Das Audit meldet diese Quellkonflikte zusätzlich nach Fehlerklasse. Die Adminansicht zeigt alle fünf unveränderten Quellen mit getrennten Beschriftungen.

`organizations.region` enthält belegbar auch Wirkungsgebiete wie „Deutschland · bundesweit“ und „Schweiz“. Dieser Wert wird deshalb separat erhalten und angezeigt. Er wird beim Audit weder als Verwaltungsregion noch als Länderbeweis an `city` angehängt. Eine reine Änderung dieses Wirkungsgebiets lässt die bestehende bestätigte Stadt unverändert.

## Einführung und Rücknahme

1. Datenbanksicherung und aktuellen Bestand mit berechtigtem Betreiberzugang sicherstellen.
2. Zuerst Audit ohne `--apply` durchführen; es unterstützt auch das ältere Schema ohne neue Ortsspalten. Schemafehler in anderen Ausgangsspalten werden ausdrücklich gemeldet.
3. Additive Migration `20261109170000_canonical_places.sql` zuerst in einer Testumgebung ausführen und prüfen. Sie löscht oder vereinigt keine Profile/Inserate.
4. Audit nach der Migration erneut ohne `--apply` durchführen. Das Skript liest nur Ortsspalten und relevante Projektmetadaten. Berichtdateien enthalten Ortsangaben und müssen privat bleiben.
5. Zuordnung und offene Fälle prüfen. Dann denselben Lauf mit `--apply` ausführen. Nur noch nicht zugeordnete Datensätze werden bearbeitet; unklare Angaben erhalten den Prüfstatus. Änderungen an Originaltext, Profil, Inserat oder Veröffentlichung sind nicht Teil der Bestandsmigration.
6. Anzahl aller Ausgangsdatensätze und Zuordnungen vergleichen. Konflikte separat bearbeiten, nicht blind wiederholen. Einen zweiten Lauf zur Wiederholbarkeit prüfen.
7. Oberfläche und geschützte Speicherabläufe einschließlich aller sechs Sprachen auf Smartphone und Desktop prüfen. Erst danach gemeinsam mit der Datenbankumstellung veröffentlichen.

Beispiel nach Bereitstellung einer freigegebenen, lokalen Datenbankkonfiguration (keine Schlüssel in Befehle oder Berichte einfügen):

```sh
node --experimental-strip-types --import ./scripts/register-test-aliases.mjs \
  --env-file=<lokale-Konfiguration> scripts/audit-places.mjs --output=<privater-Bericht.json>
```

Mit `--apply` schreibt das Skript über eine ausschließlich für den Servicezugang freigegebene Funktion. Erwarteter Originaltext und vorherige kanonische Felder werden unter einer Zeilensperre verglichen. Nur ausdrücklich gestartete Zuordnungs- und Rücknahmeläufe werden mit Originaltext, vorherigem Zustand und Lauf-ID in `place_change_journal` protokolliert. Normale Mitgliedseingaben und Profiländerungen erzeugen darin keinen laufenden Ortsverlauf. Ältere Schreibwege, die den Rohtext ohne neue Ortsfelder ändern, verlieren ihre alten bestätigten IDs und werden erneut prüfbedürftig.

Bei Profilen umfasst der erwartete Zustand zusätzlich die unverändert gelesenen alten Felder `location_city`, `location_region` und `location_country`; nicht vorhandene Felder werden als `null` verglichen. Bei Projekten enthält `project_sources` alle fünf genannten Quellen, bei Organisationen `organization_sources` das zusätzliche Wirkungsgebiet. Das gilt auch für die Adminprüfung und die Rücknahme. So wird eine zwischenzeitliche Mitgliedskorrektur erkannt, selbst wenn Rohtext und offener kanonischer Zustand gleich bleiben. Ältere Anfragen für diese Bereiche ohne den benötigten Quellzustand werden als Konflikt zurückgewiesen und müssen die Prüfung neu laden; der RPC-Vertrag für andere Tabellen bleibt erhalten. Nebenfelder und Projektmetadaten werden durch die Zuordnung nicht verändert.

Die bestehenden Moderations-, Organisationsrevisions- und Medienbindungstrigger werden bei der Migration koordiniert erweitert. Die Ausnahme setzt einen ausdrücklich gestarteten, dienstberechtigten Zuordnungs- oder Rücknahmelauf für genau diese Tabelle und Zeile voraus. Zusätzlich muss ein vollständiger Vergleich von vorherigem und neuem Datensatz belegen, dass ausschließlich die sieben abgeleiteten `place_*`-Felder unterschiedlich sind. Veröffentlichung, Inhaltsrevision, Prüfnachweise, `updated_at`, Organisationsmoderation und Medienherkunft bleiben dann unverändert. Insbesondere werden zuvor ungebundene Altbilder durch die Ortszuordnung nicht nachträglich an einen öffentlichen Elternsatz gebunden.

Normale Inhalts-, Orts- und Medienänderungen sowie neue Datensätze durchlaufen die bisherigen Regeln vollständig; auch ein vorhandener Zuordnungskontext erlaubt keine Ausnahme für zusätzliche Änderungen. Bekannte Funktionskörper werden anhand ihrer Prüfsummen mit den vorhandenen Repository-Migrationen abgeglichen. Die Erweiterung erhält Sicherheitsattribute und bestehende Ausführungsrechte der Funktionen und ist erneut ausführbar. Eine unbekannte Triggerdefinition lässt die gesamte Datenbankmigration zurückrollen und muss zunächst geprüft werden. Ein Integrationstest lädt die tatsächlichen Organisations-, Angebots- und Medienbindungstrigger und prüft für alle sieben Quelltabellen, dass Backfill und Rücknahme keine zusätzlichen Moderationseinträge, Zeitstempeländerungen oder Änderungen an `media_assets` erzeugen.

Rücknahme: `rollback_place_run(<Lauf-ID>)` mit Betreiberzugang aufrufen. Zurückgesetzt werden nur Zuordnungen, deren Originaltext und kanonischer Zustand noch dem protokollierten Ergebnis entsprechen. Neuere Bearbeitungen werden als Konflikt gemeldet und bleiben erhalten. Die Rücknahme liefert ihre eigene gemeinsame Lauf-ID zurück. Additive Ortsspalten bleiben bestehen; es werden keine Profile oder Inserate aus dem Journal wiederhergestellt.

Für das private Zuordnungsjournal ist technisch eine Bereinigung von Einträgen **älter als 30 Tage** vorbereitet. Diese Frist ist ein vorgeschlagenes betriebliches Rücknahmefenster, keine behauptete gesetzliche Aufbewahrungsfrist. **Der Betreiber hat die Aktivierung der täglichen automatischen Bereinigung vorerst ausdrücklich abgelehnt; der Tagesjob ist nicht aktiviert. Die 30-Tage-Frist ist damit keine freigegebene automatische Aufbewahrungsregel.** Die geprüfte Vorbereitung liegt unter `supabase/maintenance/canonical-place-retention.sql`. Sie würde ausschließlich den benannten Job `cinegenius-place-journal-retention` täglich um 03:17 UTC/GMT anlegen oder aktualisieren, ohne einen sofortigen Bereinigungslauf, Änderungen an anderen Jobs oder eine Löschung von Cron-Historie auszulösen. Vor der Ausführung ist die ausstehende Betreiberbestätigung erforderlich.

Das lokale Auditskript ruft nach einem fehlerfreien `--apply`-Lauf bereits `purge_place_change_journal()` auf. Deshalb darf dieses schreibende Skript erst nach Bestätigung der Frist verwendet werden. Die produktive Bestandszuordnung wurde über einen separat geprüften transaktionalen Lauf **ohne Journalbereinigung** ausgeführt. Probeläufe bleiben lesend. Nach einer später freigegebenen Bereinigung wären die betroffenen älteren Zuordnungsläufe über das Journal nicht mehr rücknehmbar. Private lokale Auditberichte sind nach abgeschlossener Prüfung zu löschen und dürfen nicht dauerhaft als zusätzliche Ortsdatenbank dienen.

Wird eine Elternzeile gelöscht, entfernt derselbe Datenbankvorgang sofort alle zugehörigen Journaleinträge, unabhängig vom Rücknahmefenster. Das gilt auch für die vom bestehenden Kontolöschweg entfernten Profile und Inserate. Schlägt die Elternlöschung fehl oder wird sie zurückgerollt, bleibt auch das Journal unverändert. Journalzugriff, Rücknahme und Bereinigung sind für öffentliche und angemeldete Clientrollen gesperrt. Datenminimierung und Speicherbegrenzung sind dabei die maßgeblichen Anforderungen aus [Art. 5 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj/deu); konkrete Aufbewahrungszwecke und die Umsetzung von Löschbegehren müssen im Betrieb berücksichtigt werden.

## Produktiver Zuordnungslauf

Lauf-ID: `f589c0f9-eb80-427b-b43b-188f1edca846`. Für 297 Datensätze wurden getrennte Ortsfelder ergänzt; 297 private Journaleinträge sichern den vorherigen Zustand. Eine erneute produktive Ausführung war unverändernd: weiter 297 Journaleinträge, keine zusätzlichen Zuordnungen.

| Bereich | Datensätze | Bestätigt | Manuell zu prüfen | Ohne Ortsangabe |
|---|---:|---:|---:|---:|
| Profile | 161 | 8 | 153 | 0 |
| Firmen | 51 | 0 | 51 | 0 |
| Inserate | 40 | 0 | 40 | 0 |
| Projekte | 34 | 1 | 11 | 22 |
| Organisationen | 4 | 0 | 3 | 1 |
| Organisationseinträge | 7 | 0 | 1 | 6 |
| Community-Beiträge | 0 | 0 | 0 | 0 |
| Gesamt | 297 | 9 | 259 | 29 |

Die acht bestätigten Profile betreffen überprüfte Köln-/Frankfurt-Varianten mit bekanntem Land. Die eine bestätigte Projektangabe ist das reine Land Rumänien; daraus wurde keine Stadt erzeugt. 259 Angaben bleiben mit ihren Originalen zur manuellen Prüfung erhalten. 29 Datensätze besitzen keine befüllte primäre Ortsangabe; fehlende und JSON-`null`-Quellen blieben unterscheidbar erhalten.

Der Bestandslauf vergleicht vor Abschluss sämtliche Nicht-Ortsfelder der vollständigen Quellzeilen sowie Favoriten, Medienherkunft und beide Moderationshistorien. Eine Abweichung bricht den gesamten Lauf ab. Produktiv blieben 38 Inserate veröffentlicht und alle 23 Favoriten erhalten. Die exakte SQL-Fassung wurde zusätzlich unabhängig mit den tatsächlichen vorhandenen Triggern geprüft: Wiederholung, vollständige Rücknahme aller 297 Zuordnungen, erneute Anwendung und vollständiger Abbruch bei einer künstlichen Nebenwirkung bestanden lokal. Eine Produktionsrücknahme wurde nicht durchgeführt.

## Noch erforderliche Abnahme

Nach der Betreiberanmeldung wurde das produktive Schema am 9. November 2026 ausschließlich lesend geprüft. Die aggregierten Bestandszahlen umfassen 161 Profile, 51 Firmen, 40 Inserate, 34 Projekte, 4 Organisationen, 7 Organisationseinträge, keine Community-Beiträge und 23 Favoriten. Profile besitzen produktiv nur `location`. Bei allen 34 Projekten sind die obersten Felder `country` und `shoot_locations` leer; vorhandene Projektangaben stehen insbesondere in `metadata.location`. Die zusätzlichen Projektfelder in `metadata.project_details` sind derzeit nicht befüllt. Projekttexte enthalten unter anderem Ortsnamen ohne Land und zusammengesetzte Angaben wie „Hochschwarzwald & Köln“ oder „München/ Bologna/ Peru“ und werden nicht durch Raten auf eine einzelne Stadt reduziert. Die additive Migration wurde anschließend mit Betreiberfreigabe produktiv angewendet; der getrennt geprüfte Zuordnungslauf ist ebenfalls abgeschlossen. Es wurde kein kompletter Export von Produktionsgeheimnissen oder personenbeziehbaren Datensätzen vorgenommen.

Die gemeinsame Ortsauswahl wurde über die native Safari-Oberfläche mit kontrollierten Testdaten auf Desktop sowie bei 390 und 320 CSS-Pixeln geprüft. Vorschläge, manuelle Eingabe, Filter, fortbestehende Auswahl-ID und der Wechsel zwischen allen sechs Sprachen sind in dieser Komponententestansicht geprüft. Das ist keine vollständige Abnahme der angemeldeten Produktionsabläufe in Onboarding, Dashboard und Admin. Die öffentlichen Live-Filter wurden lesend geprüft; ein Bericht im aktuellen Arbeitsauftrag enthält die gefundenen Varianten. Offen bleiben die manuelle Zuordnung der 259 unklaren Angaben sowie die vollständige Abnahme angemeldeter Speicherabläufe. Die automatische Journalbereinigung bleibt entsprechend der Betreiberentscheidung deaktiviert; eine spätere Aktivierung benötigt eine neue ausdrückliche Freigabe. Die ergänzende öffentliche Freigabe ausschließlich der lesenden Orts-GET-Endpunkte ist separat veröffentlicht und live geprüft; Mutationen und der Adminbereich bleiben geschützt. Alle 25 abschließenden öffentlichen Live-API-Prüfungen bestanden. Eine vollständige rechtliche Freigabe wird daraus nicht abgeleitet.

## Ergänzung nach den Handy-Screenshots

Ein frisch geöffneter produktiver Crew-Tab zeigt nach Rückmeldung des Betreibers bereits „Land → Region → Stadt oder Gemeinde“. Ein zuvor geöffneter Tab kann noch die ältere Oberfläche ausführen; das ist kein Beleg für erneut gespeicherte falsche Ortsarten.

Die gemeinsame Ortseingabe zeigt Vorschläge ab zwei Buchstaben, unterstützt Pfeiltasten, Enter und Escape und bestätigt eine ausdrücklich ausgewählte Stadt sichtbar. Eine erkannte Region im Stadtfeld bietet die Übernahme ins Regionsfeld an. Berlin und Hamburg bleiben zugleich gültige Städte. Manuelle internationale Eingaben bleiben möglich und erzeugen ohne bestätigte Zuordnung keinen neuen Stadtfilterwert. Neue Profile und Änderungen werden serverseitig erneut geprüft. Die ausgewählte ID bleibt beim Sprachwechsel erhalten; Namen und Beschriftungen werden lokalisiert. Designgrundlagen, Navigation und globale Stile bleiben unverändert.

Haarfarbe, Augenfarbe, Körperbau und Reisebereitschaft verwenden in Crewfiltern und Profilanzeige die bestehenden stabilen IDs mit übersetzten Anzeigenamen in allen sechs Sprachen. So erscheint der gespeicherte Augenfarbwert `brown` auf Deutsch als „Braun“. Unbekannte Altwerte werden erhalten. Der Profileditor bewahrt zusätzliche Verfügbarkeitsangaben bei anderen Änderungen und gleicht eine ausdrücklich geänderte Reisebereitschaft mit dem Filterwert ab.

57 gezielte Verhaltens- und Speichertests bestanden, darunter echte Profil-POST/PATCH-Handler mit kontrollierten Daten, Regionsschutz, Namensgleichheit, manuelle Eingabe, Tastaturbedienung, Auswahlbestätigung, Sprachwechsel und unveränderte Filter-IDs. TypeScript-, Übersetzungs- und Designprüfung bestanden. In nativer Safari-Bedienung wurden Köln über „Cologne“, die Korrektur von Bayern und die ausdrückliche Auswahl von München bei 320/390 CSS-Pixeln geprüft; Englisch zeigte anschließend „Munich, Bavaria, Germany“ mit unveränderter Stadt-ID. Es wurden dafür keine Produktivprofile angelegt oder bearbeitet. Die oben dokumentierten Grenzen der angemeldeten Geräteabnahme und die 259 offenen Bestandsfälle bleiben bestehen. Diese Ergänzung benötigt keine weitere Datenmigration und aktiviert keine Journalbereinigung.
