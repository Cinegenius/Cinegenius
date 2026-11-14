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

Diese Integration ist noch nicht veröffentlicht und führt die Migration
`20261114180242_profile_privacy_controls.sql` nicht aus. Vor einem abhängigen
Web-/App-Livegang sind die ausdrückliche Freigabe, bestätigte Migration und die
zugehörigen Serverprüfungen erforderlich. Die reguläre entfernte App-URL bleibt
bis dahin beim veröffentlichten Webstand. Tests mit simulierten Konten/API-Antworten
belegen keine echte iPhone-/iPad-Bedienung; neuere Mac-Quellen und gespeicherte
Pläne bleiben beim späteren Xcode-Abgleich erhalten.
