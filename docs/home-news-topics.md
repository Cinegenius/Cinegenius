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
  zwölf Beiträge (je drei pro Rail-Seite). Nach dem Indexlesen werden beide Freigaben beim Inhaltsabruf
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
Die 17 vorhandenen Sprachkataloge enthalten die Auswahlbeschriftungen.

Seit dem Auftrag vom 17. November 2026 wird ohne eigene Themenwahl für technische
Berufsprofile `technology` vorausgewählt, sowohl auf der Startseite als auch beim
direkten Öffnen von `/news`. Siehe die Regeln unten.
Hersteller-Herkunft und internationale Zielgruppe sind unterschiedliche Angaben:
der bestehende Länderresolver bleibt unverändert. Ein ungeklärtes Zielland darf
vom Redaktionsagenten nicht als weltweite Eignung oder erfundenes Land gespeichert
werden. Ein eigenes internationales Zielgruppenfeld benötigt eine spätere
abgestimmte Erweiterung des Redaktionsmodells.

Agentenauftrag: [AG DOK – Technik-News](agents/technology-news.md). Eine
funktionsfähige Auswahl erzeugt keine Artikel und aktiviert keinen Zeitplan.
Technik wird als neue Auswahl nur angeboten, wenn dafür ein aktueller freigegebener
Beitrag vorliegt. Eine inzwischen leere oder automatisch vorausgewählte Kategorie
bleibt beschriftet sichtbar, mit einem Rückweg zu allen Themen. Veröffentlichung von Website und Artikeln bleibt vom
tatsächlichen freigegebenen Stand abhängig.

## Berufliche Vorauswahl (17. November 2026)

- Reihenfolge: gültiger expliziter `topic`-URL-Wert, eigene gespeicherte Themenwahl,
  die aktuellen ausgewählten Berufe, zuletzt `all`. `topic=all` ist ausdrücklich
  „Alle Themen“, kein fehlender Parameter. Seitenwechsel und „Alle Beiträge
  ansehen“ behalten auch diesen Wert bei.
- `profileNewsTopic` nutzt den gemeinsamen Berufskatalog und
  `selectedCrewOccupations`. Technikbereiche: Kamera (`kamera`), Licht (`licht`),
  Grip (`grip`), Ton (`ton`), Postproduktion (`post`), SFX (`sfx`), Broadcast
  (`broadcast`), Virtual Production (`virtual`) und Fotografie (`foto`). Eine
  gewählte Haupt-, Neben- oder weitere Tätigkeit kann die Vorauswahl auslösen.
  Bekannte eindeutige Altbezeichnungen werden über denselben Katalog aufgelöst.
  Freitext, Biografie, Profiltyp und unbestätigte/mehrdeutige Berufszuordnungen
  werden nicht als technische Tätigkeit geraten.
- Der Server liest nur `positions,role,crew` des aktuell authentifizierten Kontos,
  und nur wenn weder URL noch eigene Themenwahl vorliegen. Berufsdaten werden
  nicht an öffentliche Komponenten weitergegeben oder in Cookies geschrieben.
  Gäste und andere Konten übernehmen diese Vorauswahl nicht. Kein konten- oder
  requestübergreifender Cache; eine Berufsänderung wirkt beim nächsten Aufruf.
- Öffnen oder Suchen speichert die abgeleitete Auswahl nicht dauerhaft.
  Ausdrückliche Themenwahl, Entfernen des Themenfilters und Zurücksetzen in der
  Newsseite speichern denselben kontogebundenen Themen-Cookie wie die Startseite.
  Andere Filterwechsel allein machen die Berufsvorauswahl nicht dauerhaft.
  Bei blockierten Cookies bleiben Eingabe und Wiederholen erhalten.
- Länderwahl und Freigaben bleiben unverändert. Ohne passende freigegebene
  Beiträge im ausgewählten Land bleibt der vorhandene Leerzustand mit der
  Möglichkeit zum Filterwechsel sichtbar; es werden keine Beiträge erfunden
  oder ungeklärte Länder automatisch zugeordnet.
- Native Umsetzung: dieselbe Rangfolge, dieselben stabilen Berufs-/Themenwerte,
  eigene kontogebundene manuelle Wahl und aktuelles eigenes Profil. Die Web-Cookies
  sind keine neue Synchronisations-API. Native Geräteprüfung bleibt getrennt.
  Redaktion und Zeitpläne gehören weiterhin zu Agent NEWS; diese Änderung
  erstellt/veröffentlicht keine Meldungen und aktiviert keinen Prüfagenten.


## Homepage paging (17 November 2026)

The homepage requests at most twelve currently approved entries using the same
country/topic and current-event filters. Three compact existing news rows form
one horizontal page in `HomeCardRail`; visible position dots and sideward swipes
reach later pages. The surrounding page retains native vertical scrolling. There
is no inner vertical news scroller, automatic rotation, invented content or
infinite loop. The all-news link retains the selected country and topic.
