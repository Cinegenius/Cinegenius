# CineGenius App: Wege, Medien und Privatsphäre

Verbindliche Produktvorgaben von Markus, 13. November 2026. Ergänzung zur
Filmwerkzeuge-Roadmap. Die Entwicklung beginnt jetzt, nicht erst am Folgetag.
Diese Vorgaben beschreiben den weiteren Ausbau; die erste startbare App-Vorschau
implementiert noch kein neues Medienarchiv und keine Tagesposts.

## Arbeitsbereich dieses App-Chats

Markus hat am 13. November 2026 festgelegt: Nach der ausdrücklich beauftragten
Veröffentlichung der aktuellen Hintergrund-, Punkte- und KI-Menüänderungen wird
in diesem Chat ausschließlich an der App gearbeitet. Weitere App-Änderungen
werden nur nach einer neuen ausdrücklichen Anweisung auf die öffentliche
Hauptseite übertragen. App-Vorschauen und App-spezifische Funktionen getrennt
weiterentwickeln; eine App-Freigabe ist keine Website-Veröffentlichungsfreigabe.
Diese Entscheidung gilt für den App-Auftrag, nicht pauschal für andere Website-Aufträge.

Am 14. November hat Markus die laufende Abstimmung ausdrücklich festgelegt:
WEB CODEX bearbeitet die Website und gibt jeden fertig geprüften Stand mit Commit,
Prüfungen und Veröffentlichungsstatus an APP Entwicklung weiter. Hier erfolgen
der App-/Xcode-Abgleich und die nativen Zusatzfunktionen. Unfertige Webänderungen
und nicht freigegebene Rechtstexte werden nicht als fertiger Stand übernommen.
App-Quellen und eigene Sprachschlüssel bleiben beim Abgleich erhalten.

## Arbeitsplatz: erste native Abteilung

Aktuelle Betreiberentscheidung vom 14. November: Der bisher als KI geplante
App-Bereich heißt **Arbeitsplatz**. Er wird nach Abteilungen gegliedert. Wir starten
mit **Locations → Grundrisse** und dem neuen nativen Raumscanner. Das bestätigte
Gerät für echte Aufnahmen ist ein **iPhone 15 Pro**. Weitere Abteilungen folgen
mit tatsächlich nutzbaren Funktionen, ohne zusätzliche leere Menüs.

Diese Entscheidung ersetzt die unten dokumentierte frühere Zurückstellung des
KI-Einstiegs für die App. Die fünf öffentlichen Links unten bleiben erhalten.
Die erste native Fassung speichert Pläne mit optionalem lokalem Projekt-/Location-
Namen geschützt auf dem Gerät. Sie behauptet keine Kontosynchronisierung oder
Verknüpfung mit Online-Projekten. Erfasste Quelldaten bleiben bei gespeicherten
Plänen erhalten; Weitergabe geschieht ausschließlich durch ausdrücklichen Export.
Beispiele sind auch nach Speicherung und Export eindeutig als Beispiele markiert.

## Bedienung

Instagram, Facebook, Kleinanzeigen/eBay und Airbnb dienen als Orientierung für
vertraute, kurze Wege. CineGenius behält sein gemeinsames Design, seine Marke,
Kataloge und bestehenden Veröffentlichungsregeln.

- Nachrichten direkt aus Kopfbereich, Profil und Angebot erreichen. Bestehende
  Kontakt-, Blockier-, Gruppen- und Leserechte bleiben serverseitig maßgeblich.
- Inserieren als geführter Ablauf: passende Angebotsart wählen, relevante Angaben
  und optional Medien ergänzen, Sichtbarkeit prüfen, ausdrücklich speichern oder
  veröffentlichen/einreichen. Entwürfe sind privat und wiederaufnehmbar.
- Eigene Fotos und Videos einmal privat speichern und danach für Angebote,
  Beiträge und Tagesposts auswählen. Originale und Veröffentlichung sind getrennte
  Entscheidungen. Keine erneute Namensabfrage, wenn die bestätigte Person vorliegt.
- Kurze Tagesposts: erstellen, Empfängerkreis prüfen, veröffentlichen. Markus hat
  bestätigt: **24 Stunden sichtbar, eigene Originale anschließend privat behalten**.
- Mobile Hauptnavigation bleibt eine gemeinsame Fünferleiste;
  keine zusätzliche konkurrierende Fußleiste. Neue Aktionen bekommen erst dann
  sichtbare Schaltflächen, wenn ihr Ziel tatsächlich nutzbar ist.
- Menüs bleiben einfach: keine doppelten Einträge innerhalb einer Oberfläche,
  kurze verständliche Namen und ein eindeutiger Ort pro Aktion. Häufige Aktionen
  sind direkt erreichbar, seltene Einstellungen im passenden Untermenü. Die
  Kompaktansicht muss alle Ziele erhalten, ohne Desktop- und Mobilmenüs gleichzeitig
  zu stapeln. Kontextaktionen am betreffenden Angebot bleiben sinnvoll erreichbar.
- Korrektur von Markus am 13. November: KI kommt erst später. Die untere Leiste
  bleibt bei **Crew, Marktplatz, News, Locations, Firmen**. KI steht vorerst nur
  deaktiviert im gemeinsamen Kopfmenü mit „Demnächst verfügbar“, ohne Werkzeugstart.
  Direkte Aufrufe von `/tools` zeigen ebenfalls nur die Ankündigung. Diese Vorgabe
  ersetzt den früheren Beschluss für KI in der Leistenmitte und wird zunächst nur
  im App-Entwicklungsstand umgesetzt; die Hauptseite braucht einen neuen Auftrag.
- Der Raumscanner soll ausdrücklich **nativ in der App** neu umgesetzt werden;
  den früher gebauten Scanner nicht übernehmen oder nur einbetten. Unterstützte
  Kamera-/Gerätesensoren verwenden, Grundrisse erzeugen und privat einem Projekt
  zuordnen. Geräteunterstützung, echte Messungen und Schätzungen transparent trennen.
  Der jetzige Hinweis „In Vorbereitung“ ist keine funktionsfähige Scan-Implementierung.
- Weiteres bestätigtes Werkzeug: Sonnenplanung für Locations. Standort, Datum,
  Uhrzeit und Ortszeitzone auswählen; Sonnenrichtung/-höhe, Auf-/Untergang und
  Tagesverlauf darstellen. Rechnerische Lichtplanung von Schatten durch Gebäude,
  Gelände und aktuelle Bewölkung unterscheiden. Keine pauschale Zusage für Wetter
  oder sichtbares Sonnenlicht. Private Location-Adressen bleiben berechtigungsgeschützt.

## Smart-Suche (14. November 2026)

**Status: Grundfunktion mit `ce37ab6`, Trefferkorrekturen, Name Smart und
Mitgliederzugang mit `3604ba4` veröffentlicht. Start mit Locations und der dezente
Hinweis beim Smart-Klick sind mit `60f17e7` ebenfalls veröffentlicht.**
WEB-Veröffentlichungsbeleg vom 14. November 2026:
`/srv/cinegenius/audits/20261114-home-search-member-hint/production-receipt.json`,
Vercel `dpl_Cpc888oapKCCghiwqV5i839WB52e` READY. Kein Nachweis eines neuen nativen Builds.
Markus hat den früheren Aufschub mit „ok dann setzen wir das um“ aufgehoben.
Die technische Prüfung ist im Bericht `test-reports/genie-unified-search-2026-11-14.md`
dokumentiert. Der echte KI-Sprachverständnistest steht noch aus: Der vorhandene
Live-Schlüssel bleibt unverändert und ist lokal nur als geschützter Platzhalter
verfügbar. Native Xcode-Arbeit bleibt bei APP Entwicklung.

- Bestätigter Haupteinstieg: **Startseite**, über die bestehende Suche und Genie.
  Das gemeinsame Ergebnisziel und die Suchlogik sollen später auch im Arbeitsplatz
  nutzbar sein; kein zweites, abweichendes Suchsystem bauen. Das Design bleibt erhalten.
- Der bestätigte kurze Name des Reiters ist **Smart**. Die Auswahl oberhalb der
  Startseiten-Suchleiste bleibt einzeilig, bei Platzmangel horizontal bedienbar.
- Beim Einstieg ist **Locations** ausgewählt. Smart sieht für Gäste zunächst wie
  jeder andere Reiter aus; erst Klick oder Tastaturaktivierung zeigt die kleine
  Sprechblase „Nur für Mitglieder“. Kein Hinweis bei Hover/Fokus, kein automatischer
  Seitenwechsel und kein Verlust eingegebener Suchfelder. Tippen außerhalb,
  erneuter Klick oder Escape schließt den Hinweis. Mitglieder wechseln normal zu
  Smart; der neutrale Suchhinweis lautet lokalisiert „Was suchst du?“.
- Smart ist **nur für angemeldete Mitglieder** zugänglich, einschließlich geteilter
  Ergebnislinks. Website und App prüfen die Sitzung serverseitig; Gäste bekommen
  weder KI-Verarbeitung noch Smart-Ergebnisse. Die Anmeldung erhält den gesamten
  Suchplan als Rückkehrziel. Bei Sitzungsende Ergebnisse ausblenden; die übrigen
  öffentlichen Verzeichnisse bleiben erreichbar.
- Betreiberentscheidung zur späteren Finanzierung: die Funktion so vorbereiten,
  dass daraus später ein kostenpflichtiges Angebot bzw. eine bezahlte Anwendung
  werden kann. Der genaue kostenpflichtige Umfang, kostenlose Funktionen, Preise,
  Abrechnung und Einführung sind noch nicht beschlossen. Keine Freigabe für
  Zahlungen oder eine aktuelle Bezahlschranke.
- Gemeinsame Suchlogik ist von Darstellung und Tarifzugriff getrennt.
  Künftige Zugangsrechte und etwaige Nutzungsgrenzen serverseitig und
  kontobezogen prüfen, einheitlich für Website und App; private Inhalte bleiben
  unabhängig von einem Tarif geschützt. Nutzungszählung darf keine dauerhafte
  Speicherung von Suchtexten oder Gesprächen voraussetzen. Zahlungsanbieter und
  native Kaufabwicklung erst mit dem tatsächlichen Bezahlmodell abstimmen.
- Freie Stichwörter und mehrere Wünsche in einer Anfrage sollen bereichsübergreifend
  Crew, Marktplatz, Locations, Firmen und die weiteren passenden öffentlichen
  Verzeichnisse durchsuchen. Gemeinsame Ergebnisse werden **nach Bereich getrennt**
  angezeigt; nicht nur den ersten Suchwunsch öffnen oder die übrigen verwerfen.
- Jeder Suchteil behält seine eigenen Orts-/Länderangaben. Beispiel:
  „Fahrer in München und Fahrer in Berlin“ sind zwei getrennte Suchteile.
  Ein gemeinsamer nachgestellter Ort kann für mehrere passende Suchteile gelten.
- Ein Suchwunsch kann mehrere Orte umfassen: „Beleuchter in Berlin und Hamburg“
  findet Beleuchter in Berlin **oder** Hamburg. Ein Treffer muss nicht beide Orte
  erfüllen. Auch vorangestellte Ortsangaben korrekt zuordnen: „Model in Berlin
  und in Hamburg Beleuchter“ findet Models in Berlin sowie Beleuchter in Hamburg;
  daraus nicht automatisch Models in Hamburg oder Beleuchter in Berlin machen.
  Beruf/Gegenstand und die dazugehörigen Orte bleiben in der Ergebnisdarstellung
  erkennbar, auch wenn beide Suchteile im gleichen Bereich liegen.
- Bereichs- und Ortswechsel kombinieren: „Model in Berlin und ein Auto in Afrika“
  bedeutet Crew/Models in Berlin plus Marktplatz/Fahrzeuge in Afrika. Kontinente
  als größere Suchgebiete berücksichtigen; Länder und Städte erlauben eine
  genauere Eingrenzung. Kontinente verwenden die Ländergruppen aus Unicode CLDR;
  Einträge ohne entsprechend zuordenbaren öffentlichen Ort werden nicht geraten.
- Zu prüfende Beispiele: „Oberbeleuchter und Produktionsfahrer in München“,
  „OB und Fahrer in München“, „jemand vom Kostüm in der Schweiz“ sowie
  „eine vom Kostüm und ein Boot in Berlin“. Kurzformen und Schreibvarianten
  berücksichtigen, ohne Berufe, Treffer oder Orte zu erfinden. Unklare Wünsche
  müssen verständlich geklärt werden; „alles funktioniert“ ist keine geprüfte Zusage.
- Gemeinsames Ergebnisziel ist die erweiterte `/search`-Seite.
  Einen späteren Arbeitsplatz-Einstieg mit APP Entwicklung abstimmen;
  bestehendes Design, aktuelle Sichtbarkeitsrechte und kurzlebige Suchdaten erhalten.
- WEB CODEX übernimmt Website und gemeinsame Suchschnittstelle;
  APP Entwicklung koordiniert den nativen Arbeitsplatz und Xcode. Der gemeinsame
  Vertrag und die Testgrenzen stehen in `genie-beta.md`. Dies veröffentlicht die
  Funktion nicht automatisch und bestätigt keine echte iPhone-/Android-Prüfung.

## Bildsprache und horizontale Karten

- Auf Crew, Marktplatz, News, Locations, Firmen und Projekte steht das vorhandene
  Hauptbild über die ganze Seite. Der Ausschnitt wandert in dieser Reihenfolge von
  ganz links nach ganz rechts. Abdunklung entspricht der Startseite; deren
  Bildausschnitt bleibt unverändert. Karten und Filter behalten gut lesbare Flächen.
- Die Pfeile unter den Startseiten-Karten werden durch mittige Positionspunkte
  ersetzt. Wischen, Tastatur und anklickbare Punkte bleiben nutzbar, mit mindestens
  44 × 44 px großen unsichtbaren Touchflächen.

## Sichtbarkeit und Kontrolle

- Das neue Medienarchiv und neue Entwürfe starten privat. Öffnen, Hochladen,
  Autospeichern oder „vollständig“ bedeuten niemals veröffentlichen.
- Für neue soziale Beiträge sind verständliche Empfängerkreise vorzusehen:
  nur ich, bestätigte Kontakte, öffentlich. Die Auswahl wird vor dem Senden gezeigt.
  Bestehende Angebots-/Firmenregeln werden dadurch nicht pauschal umgeschrieben.
- Eine private Kontoeinstellung braucht klar abgegrenzte Wirkung auf soziale
  Inhalte. Sie darf bestehende Firmen oder Angebote nicht stillschweigend verändern;
  deren aktuelle Sichtbarkeit und jeweilige Freigaberegel müssen sichtbar bleiben.
- Blockierungen, abgelehnte Kontakte und entzogene Zugriffe gelten auch für Bilder,
  Videos, Vorschaubilder und bereits bekannte direkte Medienadressen. Keine rein
  visuelle Sperre im Feed.
- Zurückziehen beendet den Zugriff auf die Veröffentlichung. Privates Archivieren,
  Veröffentlichungen löschen und Originale löschen sind unterscheidbare Aktionen.
  Bereits von Empfängern gespeicherte Kopien lassen sich nicht zurückrufen.
- Kein heimlicher Adressbuchimport, keine automatische Kontaktaufnahme und keine
  Veröffentlichung von Entwürfen oder KI-Ergebnissen.

## Technische Anforderungen für Tagesposts und Medien

- `published_at` und `expires_at` werden anhand der Serverzeit gesetzt. Öffentliche
  Abfragen und jeder Medienabruf müssen `expires_at > now()` und aktuelle Rechte
  prüfen. Der Ablauf darf nicht von einer geöffneten App oder einem täglichen
  Hintergrundagenten abhängen. Der abgeschaltete Website-Prüfagent bleibt aus.
- Private Originale behalten ihren kanonischen Ursprung im `media_assets`-Ledger.
  Eine erneute Verwendung darf den Ursprung oder dessen Rechte nicht verändern.
  Für Veröffentlichung ist eine ausdrücklich erlaubte, getrennte Darstellung
  erforderlich, deren Zugriff von der aktuellen Veröffentlichung abhängt.
- Neue Medien bleiben im geschützten Speicher. Keine permanenten öffentlichen
  Storage-URLs, keine geteilten vertraulichen CDN-Vorschauen. Rücknahme/Ablauf muss
  auch direkte Original-/Vorschaurouten sperren.
- Videos benötigen ein eigenes geprüftes Upload-/Abspielkonzept: erlaubte Formate,
  Dateisignatur, Dauer/Größe, private Vorschauen, berechtigte Bereichsabrufe,
  Verarbeitung, Abbruch/Wiederholen und Löschung. Der heutige Bild-Upload wird
  nicht durch bloßes Freischalten von `video/*` umgangen.
- Stabile Anfrageschlüssel verhindern Duplikate bei wiederholtem Upload/Veröffentlichen.
  Bestätigte Speicherung, laufender Upload und fehlgeschlagener Versuch sind klar
  unterscheidbar. Keine Wiederherstellung von File-Objekten oder Vorschau-URLs als
  vermeintlich gespeicherte Medien.
- Bestehende Infrastruktur und Genie verwenden; kein zusätzliches KI-Abonnement,
  kein neuer bezahlter Video-/Speicherdienst. Vor größeren Medienfunktionen die
  vorhandenen Speicher- und Übertragungsgrenzen prüfen.

## Ausbau und Abnahme

1. Startbare iOS-/Android-Vorschau des vorhandenen Produkts und tatsächliche
   Navigation/Anmeldeansicht prüfen. Authentifizierte und echte Geräteprüfungen
   getrennt ausweisen.
2. Vorhandene Nachrichten-, Angebots- und Fotoabläufe auf kurze mobile Wege prüfen;
   neue Aktionen auf bestehende berechtigte Ziele führen.
3. Privates Medienarchiv samt Video-Unterstützung und Berechtigungsmodell umsetzen.
4. Darauf Tagesposts mit 24-Stunden-Sichtbarkeit, privatem Archiv und klaren
   Empfängerkreisen aufbauen.

Abnahme umfasst 320 CSS px, alle neun Sprachen, 44×44-Touchflächen, Tastatur,
Safe Areas, echtes Zurück, Offline-/Fehlerfälle, Kontowechsel, Entzug von Rechten,
Blockierungen und Ablauf an der 24-Stunden-Grenze. Produktivschaltung folgt erst
auf einen eigenen Auftrag und die bestehenden Release-Prüfungen.

## Konkretisierung: eigene Locations und einfacher Grundriss-Editor (14. November)

Beim Öffnen startet die App am Anmeldeeinstieg; eine gültige Sitzung führt direkt
weiter. Im Arbeitsplatz wählt man zuerst eine eigene bereits angelegte Location,
dann einen Raum. Der Baukasten ergänzt Möbel, Strom, Wasser und Filmtechnik;
zwei Finger bewegen/zoomen die Ansicht. Ein Finger bewegt Objekte. Maße, Drehung,
Beschriftung und Notizen sind einfach bearbeitbar, Änderungen rückgängig machbar.
Die Grundrisse bleiben lokal, aber an Konto und Location gebunden. Originalscans
werden nicht überschrieben; 3D exportiert den Originalscan, PDF auch Ergänzungen.
Die ältere kontounabhängige Bibliothek bleibt geschützt erhalten, wird jedoch
nicht automatisch als Eigentum des aktuell angemeldeten Kontos übernommen.
Umsetzung, Grenze der bestehenden Inseratsschnittstelle und Prüfstatus stehen in
`docs/native-workplace-room-scanner.md`.

## App-Abgleich: Ghost und gemeinsame Privatsphäre (14. November)

Der geprüfte WEB-Stand `6953db5` wird im App-Entwicklungszweig übernommen.
Die entfernte App-Vorschau nutzt die gemeinsamen Kontoeinstellungen unter
`/dashboard?tab=settings` mit `PrivacySettings` und `/api/user-settings`;
es entsteht kein zweiter Schalter mit eigener Speicherung oder anderen Regeln.
Der vollständige Vertrag und die Releasefolge stehen in `docs/profile-privacy.md`.

Ghost verbirgt persönliche Profile, strukturierte Orts-/Aktivitätsdaten und alle
persönlichen öffentlichen Angebote auch vor bestätigten Freunden. Firmen bleiben
separat. Gespeicherte Zielgruppen und Angebots-Publikationsstände werden nicht
gelöscht. Die eigene Verwaltung und private native Grundrisse bleiben zugänglich;
der Arbeitsplatz verwendet weiterhin die authentifizierte Eigentümerabfrage.
Bestehende Chats sowie berechtigte historische Vorgänge bleiben erhalten.
Frühere öffentliche Bildlinks und gespeicherte Kopien können weiter erreichbar
sein; Ghost ist keine rückwirkende Löschung solcher Inhalte.

Die App-Prüfung akzeptiert nur vollständige Einstellungen mit gültigen Werten.
Eine Speicherantwort muss zusätzlich genau die gewählte Änderung bestätigen.
Fehlende Felder, ungültige Antworten oder eine alte Serverversion bestätigen
keine Speicherung. Die letzte bestätigte Auswahl bleibt bei einem Schreibfehler
erhalten; Fehler/Wiederholen verwenden die vorhandenen neun Sprachkataloge.
Antworten eines vorherigen Kontos werden verworfen.

WEB hat den Basisstand `dff44d3` am 14. November nach Markus’ ausdrücklicher
Freigabe veröffentlicht. Die Privatsphäre-Migration und
`20261114182622_direct_message_listing_compatibility.sql` sind laut geprüftem
Releasebeleg angewandt. Die reguläre entfernte App-URL erhält damit die gemeinsamen
Privatsphäre-Einstellungen und die zentrale Chat-Korrektur. Der Nachrichtenvertrag
bleibt gleich: Bei einer Wiederholung bleiben Originalentwurf und Sendeschlüssel
erhalten. Ein neuer Schlüssel darf eine unklare Antwort nicht als neue Nachricht
umgehen. APP führt keine zweite Migration oder Website-Veröffentlichung aus.

Die strengere Bestätigung von Speicherantworten und die früheren zusätzlichen
App-Sprachkorrekturen sind weiterhin nur im App-Zweig vorbereitet, nicht Teil
dieses Web-Livegangs. Tests mit simulierten Konten/API-Antworten belegen keine echte
iPhone-/iPad-Bedienung; neuere Mac-Quellen und gespeicherte Pläne bleiben beim
späteren Xcode-Abgleich erhalten.

## Kompakte Smart-Ergebnisse im App-Stand

Der geprüfte WEB-Commit `d15809994988c1f00d8b9050132960456fbdb64d`
verwendet auch im gemeinsamen App-Ergebnisfluss horizontale Karten mit 64-px-
Vorschau: eine Spalte am Handy, zwei ab 640 px und drei ab 1280 px. Crew- und
Marktplatzbilder bleiben im Originalseitenverhältnis vollständig sichtbar;
auch die normale Suche verwendet diese vollständigen Vorschaubilder. Gruppen,
Detailziele, Preis, Verfügbarkeit und geschützte Medienpfade bleiben erhalten.
Die native Webansicht nutzt diese gemeinsamen Komponenten; keine zweite native
Kartenimplementierung. Nach Markus' Freigabe ist dieser Stand mit Deployment
`dpl_FETzybyyhSGWtjam7K97R2tWLHg8` (READY) veröffentlicht; Produktionsbeleg und
`origin/main` sind abgeglichen. Die bestehende App-Vorschau lädt diese gemeinsame
Ansicht von `https://www.cinegenius.co/`. Eine neue native Installation oder eine
angemeldete Live-/iPhone-Prüfung ist dadurch nicht belegt.
Prüfbelege und Grenzen: `/srv/cinegenius/handoffs/20261114-app-smart-compact-previews/`.

Die inzwischen veröffentlichte Korrektur `327a78a3c703e6077dfdcbb435b065b51cb84865`
verkleinert im App-Quellstand die Smart-Vorschau auf 48 × 48 px mit intrinsischen
Bildmaßen und die Ergebniszeilen weiter. Vollständige Bilder, Detailziele und
Medienrechte bleiben erhalten. Bekannte Stichwortlisten wie „Beleuchter Kostüm“
oder „OB Fahrer“ werden im gemeinsamen Serverpfad vor einem Provider-Aufruf
erkannt; ein gemeinsamer ausdrücklich genannter Ort bleibt bei jedem Wunsch.
Die App erhält genau den gefilterten Smart-Link im bestehenden Plan-v1-Vertrag,
ohne eigenen nativen Parser oder zweite Suchlogik. Mitgliedschaft, Kontingente,
Datenschutz und komplexe freie Interpretation bleiben bestehen. Ein neuer
Sprachschlüssel `UnifiedSearch.ready` und die verkürzte Kosteninformation sind
in allen neun Katalogen enthalten. Markus hat diese Korrekturen und den kurzen
Kostentext gemeinsam freigegeben. Deployment `dpl_HWg1QpWxe9ZoggkdskXaok5ts5dd`
ist READY; Produktionsbeleg, Domainzuordnung und `origin/main` sind abgeglichen.
Der App-Quellstand enthält die geprüfte Änderung bereits. Eine angemeldete
Live-Mehrfachsuche oder native Geräteabnahme ist damit weiterhin nicht belegt.
Belege: `/srv/cinegenius/handoffs/20261114-app-smart-matching-rows/`.

## Smart-Ergebnisse zuerst und gemeinsame Karte (15. November 2026)

Der endgültige WEB-Stand `6e28680acc57f0edf5916bd02345771f6a7efe52`
ersetzt die vorbereitete Fassung `6ce9bb5`. Laut abschließendem WEB-Releasebeleg
ist er mit `dpl_2724JmLNPdQKtWZLVTWFHis3Bc9z` auf der gemeinsamen Webadresse
veröffentlicht. Der App-Abgleich übernimmt diesen Stand, ohne neuere Mac-Quellen
oder native Scanner-/Sprachdateien zu ersetzen.

Breite Produktionswünsche führen zuerst zu einer sinnvollen ersten Auswahl nach
Bereichen. Budget, Drehtag oder Produktionsumfang sind keine vorgeschalteten
Pflichtfragen. Ortsrückfragen bleiben möglich, wenn ein verwendbarer Ort fehlt;
Folgeantworten erhalten den ausdrücklich genannten Ort und Kontext. Wünsche wie
Hund, zwei Giraffen und Panzer bleiben getrennte Suchwünsche. Gewünschte Mengen
sind keine Bestands-, Verfügbarkeits- oder Buchungszusage. `plan-v1` bekommt keine
Mengenfelder; vollständige Produktionsplanung ist eine spätere Funktion.

Die gemeinsame Smart-Karte lädt unabhängig von der Zwölfer-Ergebnisliste über
denselben Endpunkt mit `view: "map"`. Sie folgt den vorhandenen Seitenzeigern,
entfernt doppelte Einträge anhand von Typ und ID und zeigt unvollständige sowie
nicht verortbare Ergebnisse an. Nur aktuell erlaubte ungefähre Ortsangaben
werden übertragen. Anmeldung, Ghost und Standort-/Kartenrechte gelten auch hier.
Bereichsfarben, Legende und Rückfragen verwenden die neun gemeinsamen Kataloge.

Notwendige Rückfragen bleiben nur im Arbeitsspeicher, getrennt nach Konto und
Suchanfrage, mit zehn Minuten Inaktivitätsgrenze. Sprachwechsel und vorübergehende
Fehler erhalten den Antwortentwurf; Konto- oder Suchwechsel verwerfen alte
Antworten. Die vorhandene native Genie-Sprachbedienung und ihre getrennte
Gesprächswiederherstellung bleiben erhalten. `/api/genie` liefert weiterhin
`reply`, `language` und validierte `links`; `topic` bleibt providerintern.

Plattform-Kostenantworten verwenden ausschließlich die freigegebene kurze
Übersetzung ohne Beträge, Prozente, Rechenbeispiele oder Preislink. Tatsächliche
Konditionen, Rechtstexte und die Suche nach Mietpreisen bleiben unverändert.

App-Prüfbelege: `/srv/cinegenius/handoffs/20261115-app-smart-planning-map/`.
Browserprüfungen mit simulierten Konten, API-Antworten und Betriebssystem-
Sprachschnittstellen sind keine native Geräteabnahme oder Prüfung freier
Live-KI-Antworten. Der Serverabgleich installiert keine neue App auf dem iPhone
und überschreibt keine laufenden Xcode-Änderungen auf dem Mac.

## Getrennte Wünsche und nächste Treffer (15. November 2026)

Geprüfte Quelle `ad3cb39f75c0183aa6fddad176fd5ece6217f405` ist im App-Code
übernommen und nach Markus’ Freigabe von WEB veröffentlicht. Der Releasebeleg
bestätigt `dpl_DmFNTnAL2WwZ2X7i9TNdpNG5Gou3` als READY auf beiden CineGenius-
Domains; `origin/main` stimmt mit der geprüften Quelle überein. Die entfernte
App-Vorschau lädt diese gemeinsame Weboberfläche. Dieser Abgleich installiert
keine neue native App und belegt keine angemeldete Live-/iPhone-Prüfung.

„Hamburg Polizei Kostüm“ ergibt unabhängige Wünsche mit Hamburg als gemeinsamem
Ort. „Berlin Location Polizei“ sucht alle Berliner Locations und unabhängig davon
Polizei über die Bereiche. Die vorhandene gemeinsame Interpretation erkennt beide
Initialanfragen ohne KI-Aufruf; Plan-v1 und Mitgliederschutz bleiben erhalten.
Explizite Verknüpfungen wie „Polizei-Location“ werden nicht in getrennte Wünsche
zerlegt, sondern bleiben bei der semantischen Interpretation.

Nur wenn je Wunsch/Bereich alle lokalen Stadtalternativen ohne Treffer geprüft
sind, werden passende öffentliche Einträge nach ungefährer Luftlinie zwischen
öffentlichen Stadtzentren angeboten. Länder-/Kontinentgrenzen, Ghost und
Standort-/Kartenrechte gelten vor Distanzberechnung und Ausgabe. Unbekannte oder
mehrdeutige Orte erhalten keine erfundene Entfernung. Zeitüberschreitungen und
Abfragefehler bleiben sichtbare Fehler, keine vermeintlich leeren Ergebnisse.

Ergebnisse können `nearby: {distanceKm, origin}` enthalten. Die Entfernung zur
Anzeige ist gerundet. Gruppen liefern `nearby` und gegebenenfalls `nearbyCursor`;
diesen präzisen Cursor unverändert als `cursor.nearby` mit `nextOffset` zurückgeben,
niemals aus der angezeigten Entfernung berechnen. Bei einem Wechsel zwischen
lokalen und nahen Alternativen alte Gruppentreffer ersetzen. Liste und Karte
behalten eigene Pagination mit 12 beziehungsweise 180 Ergebnissen. Die vollständige
geografische Kandidatenprüfung bleibt unter der bestehenden 20-Sekunden-Grenze
und hält nur eine Ergebnisseite plus Lookahead zum Sortieren im Speicher.

Prüfbelege und Xcode-Hinweise: `/srv/cinegenius/handoffs/20261115-app-smart-nearest/`.
Native Dateien, Übersetzungen und neuere Mac-/Dispo-/PDF-Arbeit bleiben erhalten.
Browser-, Vertrags- und simulierte Sprachprüfungen ersetzen keine Prüfung mit
einem echten angemeldeten iPhone oder freien Antworten des tatsächlichen Anbieters.

## Produktionsvorhaben und qualifiziertes Catering (15. November 2026)

Geprüfte Quelle `516465ae50a2545daf3f205f167d5c1f803c8fba` ist im App-Code
übernommen, bei Übergabe noch nicht veröffentlicht. Live bleibt `ad3cb39`.
Der neue Abgleich ist keine Veröffentlichungsfreigabe oder native Installation.

Ein vollständiges einfaches Produktionsvorhaben wie „Ich drehe in Berlin einen
Polizeifilm“ erzeugt eine erste Suche nach ausdrücklich gespeicherten
Abteilungsleitungen sowie getrennten thematischen Angeboten, Filmproduktion,
Catering und Locations. Die passende Primärrolle hat in der Ergebnisanzeige
Vorrang. Ein Genre ist kein Pflichtwort im Crew-Profil; Assistenztitel oder
Biografietexte begründen keine Leitungsrolle. Es handelt sich um erste Kandidaten,
nicht um eine bestätigte vollständige Besetzung oder Verfügbarkeit.

Catering ist eine Firmenanfrage. Ernährung und Catering-Art müssen auf derselben
öffentlichen Firma zutreffen, auch bei Kartenansicht, Pagination und nahen
Alternativen. „Vegan“ wird nicht zu „vegetarisch“ oder allgemeinem Catering
abgeschwächt. Öffentliche strukturierte Angaben und ausdrückliche Beschreibungen
werden geprüft; Negationen bleiben wirksam. Unbekannte zusätzliche Anforderungen
und komplexe Formulierungen bleiben beim bestehenden Interpreter. Anbieterangaben
sind keine Zertifizierungs- oder Allergiesicherheitszusage.

Plan-v1, maximal sechs Wünsche/vier Orte und sämtliche bestehenden Ergebnis- und
Cursorfelder bleiben unverändert. Den kanonischen Suchplan erhalten; ausschließlich
die Anzeige über `searchQueryTitle` lokalisieren. Fünf neue gemeinsame
`UnifiedSearch`-Schlüssel sind in allen neun Sprachen vorhanden. Native Clients
benötigen keinen eigenen Parser. Anmeldung, Privatsphäre und Medienrechte gelten
weiter; keine Migration und keine neue dauerhafte Suchhistorie.

App-Prüfbelege und spätere Xcode-Hinweise:
`/srv/cinegenius/handoffs/20261115-app-smart-production-catering/`.
Native Scanner-/Dispo-/PDF-Quellen und neuere Mac-Arbeit bleiben unberührt.

## Smart-Folgeanfragen, Mengen und Anforderungen (15. November 2026)

Geprüfte WEB-Quelle `67cc5854a697041033d70d35482f060cb90886ab` ist auf Grundlage
von `516465a` in den App-Stand übernommen. Bei Übergabe noch nicht veröffentlicht;
damals war `ad3cb39` die bestätigte Live-Quelle. Vollständiger Vertrag:
[`smart-search-v2.md`](smart-search-v2.md). Alte v1-Links bleiben verwendbar;
neue v2-Pläne erhalten Mengen, Vorschläge, feste Anforderungen und Ausschlüsse.

Text- und Sprachfortsetzungen übergeben den vollständigen validierten Suchplan
als `searchContext`. Gezielte Änderungen dürfen andere Wünsche nicht ändern.
Mengen bezeichnen den Bedarf, keine bestätigte Verfügbarkeit. Eingaben bleiben
bei Fehlern und beim Schließen eines Wunsch-Editors erhalten; abgelaufener Kontext
benötigt eine ausdrückliche Fortsetzung. Kontoende verwirft verspätete Antworten.

Abteilungsleitungen erscheinen in getrennten Gewerken mit eigener Ortsalternative.
Gruppen sind durch Bereich, Wunschindex und optionales `segment` bestimmt.
Für weitere Seiten werden `segment`, `rankCursor` als `rank` beziehungsweise
`nearbyCursor` als `nearby` unverändert weitergereicht. Liste und Karte erhalten
ihre erste v2-Antwort gemeinsam über `view: combined`; ihre nachfolgenden Seiten
bleiben unabhängig. Die alten v1- und Einzelansichtspfade bleiben verfügbar.

Alle neun bestehenden Kataloge enthalten die zusätzlichen Oberflächentexte.
Native Sprachvermittlung und Scanner-Dateien bleiben erhalten; das gemeinsame
App-Frontend verwendet den geprüften Vertrag ohne einen zweiten nativen Parser.
Keine Migration, Modell-/Schlüsseländerung, Veröffentlichung oder Geräteinstallation
durch diesen Abgleich. Neuere Mac-/Scanner-/Dispo-/PDF-Arbeit bleibt eigenständig
erhalten. Prüfungen und Grenzen:
`/srv/cinegenius/handoffs/20261115-app-smart-expanded/`.

Der abschließende WEB-Stand `637f57960a5265e3c29aa2768d25b19e66932b7d` ist
ebenfalls abgeglichen: Er enthält die bereits an App `104d940` geprüfte
Sprachwechsel-Korrektur und den ergänzten Prüfbericht. Dieser Nachlauf ändert
keinen App-Anwendungscode. Er ist weiterhin keine Veröffentlichung oder
Geräteinstallation; die Prüfgrenzen des genannten Belegs bleiben bestehen.

WEB hat den abschließenden Stand `637f57960a5265e3c29aa2768d25b19e66932b7d`
am 15. November 2026 nach Markus' ausdrücklicher Freigabe veröffentlicht.
Deployment `dpl_12nB8LSjRgCXYuE8LKWmsCUW5Bcx` ist READY, gehört zum verknüpften
CineGenius-Projekt und ist `www.cinegenius.co` zugeordnet; Quell-SHA und
`origin/main` stimmen überein. Die App-Vorschau mit entfernten Web-Inhalten
kann damit den veröffentlichten Smart-v2-Stand laden. Dies aktualisiert den
Veröffentlichungsstatus, ohne native Quellen oder Geräteinstallationen zu ändern.
Die Live-Gastprüfungen von WEB ersetzen keine angemeldete Live-Modellprüfung
oder einen physischen iPhone-/Android-Test. Belege:
`/srv/cinegenius/handoffs/20261115-smart-search-expanded-ready/receipt.json` und
`/srv/cinegenius/audits/20261115-smart-search-expanded/production-637f579/`.

## Vollständige Gewerkeauswahl für allgemeine Drehvorhaben (15. November 2026)

WEB-Quelle `ad7085d10eea299cc7f163132d5c766660e0e1ca` erweitert eine neue Suche
wie „ich drehe in münchen“ auf alle 25 gemeinsamen Gewerke sowie Locations,
Marktplatz, Firmen und Catering. Bei Übergabe noch nicht veröffentlicht;
damals war `637f579` der bestätigte Live-Stand. Der App-Abgleich selbst
veröffentlicht nichts; der anschließende WEB-Release ist unten dokumentiert.

Der kanonische v2-Wunsch `Production Crew` benötigt nur einen Wunschplatz und
liefert je Gewerk eine eigene `segment`-Gruppe. Primäre und zusätzliche deklarierte
Berufe einschließlich Assistenzen zählen. `Heads of Department` bleibt eine
separate, strenge Leitungsabfrage. Explizite kleine Interview-/Rollenwünsche
und bereits kodierte Drei-Rollen-Pläne werden nicht verbreitert. Für den neuen
Standard ist eine frische Suche erforderlich.

Die App erhält vollständige Pläne, Mengen und Anforderungen bei Text-/Sprach-
fortsetzungen und reicht die vorhandenen `segment`-, `rank`- und `nearby`-Werte
unverändert weiter. Das gilt auch für zusätzliche Gewerke wie Postproduktion
und Set-Logistik. Liste und Karte starten weiterhin mit einer gemeinsamen
Abfrage. Die neue Bezeichnung stammt in allen neun Sprachen aus dem gemeinsamen
Katalog; keine neue Navigation oder Gestaltung.

Profilseiten und Rechte werden nur innerhalb derselben kontogebundenen Anfrage
für die Gewerke wiederverwendet, mit höchstens vier Seiten im Zwischenspeicher.
Das begrenzt den Zwischenspeicher, nicht die Ergebnismenge. Aktuelle Sichtbarkeit,
Orts-/Kartenrechte und explizite Suchgrenzen gelten weiterhin vor der Auswahl.
Keine Migration, Modelländerung, zusätzliche Speicherung oder native Installation.
Native und neuere Mac-/Dispo-/PDF-Quellen bleiben erhalten. App-Prüfbelege:
`/srv/cinegenius/handoffs/20261115-app-production-selection/`.

WEB veröffentlichte diese Quelle am 15. November 2026 nach Markus' ausdrücklicher
Freigabe. Deployment `dpl_9gdXHm4qh4cKj9WQzqAet5Kdf1ct` ist READY; Projekt,
beide `.co`-Aliase, Quell-SHA `ad7085d` und `origin/main` sind abgeglichen.
Die App-Vorschau kann die veröffentlichten Web-Inhalte laden. Anwendungscode
und native Dateien benötigen für diese Statusaktualisierung keine Änderung.
Live-Gastprüfungen durch WEB bestätigen den Anmeldeschutz, ersetzen jedoch
keinen angemeldeten Live-Modellablauf oder physischen Gerätetest. Release-Beleg:
`/srv/cinegenius/handoffs/20261115-smart-production-selection-ready/receipt.json`.

## Dezente Startseiten-Trennlinien (15. November 2026)

WEB-Quelle `fb4ec8cee48901428989324faaac2609cf8eb177` ergänzt ausschließlich
dekorative Linien in den bestehenden Zwischenräumen der Startseite. Die
gemeinsame, auf `.home-page` begrenzte Darstellung erhält Abstände, Karten,
Reihenfolge und Bedienung. Die vorhandenen Homepage-Komponenten sind die
einzigen betroffenen Oberflächen; keine neuen Texte, Schnittstellen oder Daten.

Bei der Übernahme war der letzte bestätigte Live-Stand noch `ad7085d`;
der folgende WEB-Release ist unten dokumentiert. Alle neun Sprachkataloge und 123 nativen Dateien
bleiben unverändert, ebenso die neuere Mac-Arbeit. Keine Geräteinstallation.
Die gezielten Bestandstests ergeben vor und nach der Übernahme identisch
26 erfolgreiche Fälle und 13 bestehende Fehler wegen eines fehlenden
`profile-privacy-server`-Mocks in der Homepage-Testumgebung. Einzelne Fehler
werden nicht als bestandene Tests gewertet. Browserbelege, Prüfgrenzen und
Sicherungsstand: `/srv/cinegenius/handoffs/20261115-app-home-dividers/`.

WEB veröffentlichte `fb4ec8c` anschließend nach Markus' ausdrücklicher Freigabe.
Deployment `dpl_3GYhr8ZCA4iRZiwrXVEZePE9r8VZ` ist READY; Projekt, beide `.co`-Aliase,
Quellmetadaten und der Hauptzweig auf GitHub stimmen überein. Der vollständige
Remote-Produktionsbuild einschließlich Typen, Design und Website-Sprachen bestand.
Vier Live-Gastprüfungen von WEB bestätigen unveränderte Geometrie und Bedienung,
ohne Überlauf, Browser-Konsolenfehler oder gleichursprüngliche 5xx-Antworten.
Der bereits geprüfte App-Anwendungscode `9c5c687` passt unverändert dazu;
dieser Nachtrag aktualisiert nur den Veröffentlichungsstatus. Die lokalen
Prüfgrenzen bleiben dokumentiert. Keine neue native Installation oder physische
Geräteprüfung. Release-Beleg:
`/srv/cinegenius/handoffs/20261115-home-section-dividers-ready/receipt.json`.

## Keine doppelten Auth-Einstiege über dem Formular (15. November 2026)

WEB-Quelle `4b797875441fd9af8f12b3735c63ec8c9203ab50` entfernt im gemeinsamen
Header den eigenen Anmelden-Link auf `/sign-in` und den eigenen Registrieren-Link
auf `/sign-up`, jeweils einschließlich nachgelagerter Auth-Schritte. Desktop
und kompakter Header behalten das jeweils andere Ziel. Auf der Startseite und
öffentlichen Verzeichnissen bleiben beide Einstiege direkt verfügbar.
Formulare, Sitzungen, Berechtigungen, vorhandene Übersetzungen und native Quellen
bleiben unverändert. Der App-Abgleich veröffentlicht die Korrektur nicht;
letzter bestätigter Website-Live-Stand ist weiterhin `fb4ec8c`.

Die lokalen Prüfungen der Formulare und Navigation sind keine echte Anmeldung
oder physische Geräteprüfung: Die Produktionskonfiguration von Clerk akzeptiert
die localhost-Vorschau nicht, und es wurden keine Zugangsdaten eingegeben.
Prüfungen, Versionsabgleich und Grenzen:
`/srv/cinegenius/handoffs/20261115-app-auth-header-self-links/`.

## Vorbeugende Anfrage- und Cookie-Absicherung (15. November 2026)

WEB-Quelle `c1c6064cc0154bfc502b382e4ef9007614ce3acf` begrenzt die frühen
IP-/Routenzähler auf 10.000 je Instanz und bereinigt abgelaufene Einträge.
Aktive Kontingente werden nicht verdrängt; neue Identitäten erhalten bei voller
Kapazität 429 mit `Retry-After`. Dauerhafte Kontolimits bleiben maßgeblich.
Produktions-APIs setzen `cg_profile_ok` und `cg_locale` mit `Secure`; der
Browser-Sprachwechsel verwendet das Attribut auf HTTPS. Bestehende Pfade,
Laufzeiten, SameSite-/HttpOnly-Eigenschaften und `persistOnly` bleiben erhalten.

Die App-Vorschau verwendet regulär den CineGenius-HTTPS-Ursprung. Ihre native
Kontoprüfung übernimmt WebKit-Cookies ohne eigene Sitzungskopie. Die lesbare
Sprachpräferenz bleibt verfügbar. Ein fehlgeschlagener Kontozugriff bestätigt
keine leere Bibliothek: Der bestehende Fehlerweg bietet eine neue, manuelle
Prüfung an und startet keine automatische Wiederholungsschleife. Native Quellen,
Sprachkataloge und die vorherige Auth-Header-Korrektur bleiben erhalten.

Die Prüfungen verwenden synthetische Antworten und Browserfälle; sie ersetzen
keinen nativen HTTPS-/Cookie-Test, keine echte Anmeldung und keinen vollständigen
Sicherheitscheck. Keine Migration, Geräteinstallation oder Veröffentlichung.
Letzter bestätigter Website-Live-Stand bleibt `fb4ec8c`.
Eine Website-Veröffentlichung wird separat durch WEB koordiniert.
Belege: `/srv/cinegenius/handoffs/20261115-app-security-hardening/`.
