# Themenwahl für „Aus der Branche“

Umsetzung der am 16. November 2026 bestätigten Vorschau. Die bestehenden kompakten
Newszeilen, Quellenlogos/-namen und Organisationen bleiben erhalten. Neben der
Länderwahl steht die Themenwahl; Technik verwendet den vorhandenen stabilen Wert
`technology`. Es werden ausschließlich echte freigegebene Beiträge freigegebener
Organisationen gezeigt, keine Vorschau-Beispiele oder privaten Artikelentwürfe.

## Daten und Auswahl

- `homeNewsFacets` verwendet den bestehenden, innerhalb eines Requests geteilten
  Metadatenindex. Themen sind im gewählten Land aktuell vorhanden; Länder haben
  aktuelle Beiträge zum gewählten Thema. Abgelaufene Termine, verborgene und
  beendete Beiträge erzeugen keine Startseitenoptionen.
- `latestOrganizationEntries(country, topic)` filtert **vor** der Begrenzung auf
  drei Beiträge. Nach dem Indexlesen werden beide Freigaben beim Inhaltsabruf
  erneut geprüft; es gibt keinen requestübergreifenden Berechtigungscache.
- „Alle Beiträge ansehen“ übernimmt Land und Thema in `/news?country=…&topic=…`.
- Die gemeinsame Länderwahl auf Startseite und Newsseite zeigt `unassigned`
  als erste Option mit der kurzen Beschriftung „Ohne Land“ (lokalisiert über
  `NewsRegion.unassignedCountry`). Danach folgen Automatik, alle Länder und die
  alphabetisch sortierten Länder. Die Option erscheint nur mit passenden
  Beiträgen oder deaktiviert als erhaltene, inzwischen leere Auswahl. Der aktive
  Filter verwendet dieselbe kurze Beschriftung. Der Wert bleibt `unassigned`;
  er bedeutet keine bestätigte weltweite Verfügbarkeit oder neue Zielregion.
- Die explizite Themenwahl liegt wie die Länderwahl in einem kontogebundenen
  Einstellungs-Cookie (`cg_news_topic_<scope>`). Gäste haben einen eigenen Scope.
  Es werden keine Suchhistorie, Profilangaben oder Besucherdaten gespeichert.
  Nur kanonische Themenwerte sind zulässig; blockierte Cookies zeigen einen
  Fehler. Ein Kontowechsel übernimmt keine fremde Auswahl.
- Ein inzwischen leeres gewähltes Thema bleibt sichtbar, mit Rückweg zu allen
  Themen oder Ländern. Filterwechsel aktualisieren ohne Seitenreload oder
  künstlichen History-Eintrag. Laden, Fehler und Wiederholen bleiben erhalten.

## Website/App und Redaktion

Die native App kann dieselben stabilen Themen sowie die vorhandene News-Abfrage
verwenden. HTML-Cookies sind keine neue native Schnittstelle. Native Einstellungen
müssen ebenfalls kontogebunden bleiben; echte Geräteprüfungen separat durchführen.
Die neun vorhandenen Sprachkataloge enthalten die neue Auswahlbeschriftung.

Diese Änderung führt keine automatisch aus dem Beruf abgeleitete Sortierung ein.
Die Themenwahl bleibt ausdrücklich manuell; „Alle Themen“ ist der Ausgangspunkt.
Hersteller-Herkunft und internationale Zielgruppe sind unterschiedliche Angaben:
der bestehende Länderresolver bleibt unverändert. Ein ungeklärtes Zielland darf
vom Redaktionsagenten nicht als weltweite Eignung oder erfundenes Land gespeichert
werden. Ein eigenes internationales Zielgruppenfeld benötigt eine spätere
abgestimmte Erweiterung des Redaktionsmodells.

Agentenauftrag: [AG DOK – Technik-News](agents/technology-news.md). Eine
funktionsfähige Auswahl erzeugt keine Artikel und aktiviert keinen Zeitplan.
Technik wird erst auswählbar, wenn dafür ein aktueller freigegebener Beitrag im
gewählten Land vorliegt. Veröffentlichung von Website und Artikeln bleibt vom
tatsächlichen freigegebenen Stand abhängig.
