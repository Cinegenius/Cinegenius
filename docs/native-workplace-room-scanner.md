# Nativer Arbeitsplatz: Anmeldung, Locations und Grundrisse

App-Auftrag, 14. November 2026: **Arbeitsplatz → Locations → eigene angelegte
Location → Räume/Grundrisse**. Markus möchte einfache Raumplanung, zwei Finger
zum Verschieben, einen Bausteinkatalog und markierbare Strom-/Wasseranschlüsse
sowie Sicherungskästen. Nur eigene bereits angelegte Locations sind bearbeitbar.
Die App soll beim Start die Anmeldung zeigen und gültige Sitzungen wiederverwenden.
Die Website wird durch diesen Auftrag nicht veröffentlicht oder umgestaltet.

## Anmeldung und Kontogrenze

Die Debug-App startet über `server.appStartPath` auf `/sign-in`. Die vorhandene
Serverseite leitet eine gültige Sitzung direkt weiter, sonst erscheint das
vorhandene Anmeldeformular inklusive Wiederherstellung und echter MFA. WebKit
verwendet seinen dauerhaften Datenspeicher; Passwörter oder Sitzungstokens werden
nicht in App-Dateien, UserDefaults oder eine eigene JavaScript-Speicherung kopiert.
Abmeldung, Widerruf und Ablauf der Sitzung bleiben wirksam.

Die Vorschau-Vorbereitung erzeugt auch am lokalen `appStartPath` die lokalisierte
Offline-Datei. Capacitor prüft diese Datei vor jeder entfernten Navigation;
fehlt sie, beendet es den Prozess mit Exitcode 1. Der mobile Regressionstest
führt die echte Vorbereitung in einem temporären Projekt aus und prüft diesen
Startvertrag zusätzlich zur vorhandenen Konfigurationsprüfung.

Der bisherige Capacitor-Standard öffnet fremde Hauptframe-Ziele im Systembrowser.
Eine enge Ausnahme hält ausschließlich HTTPS `clerk.cinegenius.co`, Standardport,
Pfad `/v1/client/handshake`, ohne URL-Zugangsdaten, im selben WebView. Alle anderen
Entscheidungen und Navigationsereignisse gehen an den ursprünglichen Delegate.
Die Ausnahme erweitert nicht den Origin-Schutz des Arbeitsplatz-Handlers. Der
Handshake ist eine im Quellcode belegte mögliche Fehlerursache; der konkrete
Anmeldefehler auf Markus' iPhone ist damit noch nicht als behoben nachgewiesen.

Alle nativen Einstiege einschließlich Xcode-Startargument und Schnellaktion
prüfen nun das CineGenius-Konto. `workplace-account.js` wird nur nativ in einem
isolierten `WKContentWorld` ausgeführt. Es liest über gleichursprüngliche,
authentifizierte GETs `/api/responsible-person`, `/api/listings?mine=true` und
erneut die Kontoidentität. Nur `type=location` mit `user_id` der bestätigten
Identität wird projiziert. Firmenangebote anderer Ersteller werden auch bei
allgemeiner Bearbeitungsrolle nicht als eigene übernommen. Fremde Kontoangaben
in einer Webnachricht werden nicht angenommen. Raumdaten gelangen niemals ins
WebView. Fehler, Weiterleitungen, Kontowechsel und ungültige Antworten sperren
Zugriff; ein Fehler ist keine leere oder erfolgreich geladene Bibliothek.

Die bestehende Inserats-Schnittstelle liefert maximal 200 Datensätze. Bei dieser
Grenze zeigt die App ausdrücklich an, dass ältere Locations fehlen können. Ein
späterer vollständiger, paginierter Eigentümer-Endpunkt gehört in eine mit WEB
CODEX abgestimmte Backendänderung. Diese Fassung behauptet keine Vollständigkeit
für Konten oberhalb des bestehenden Limits.

## Bedienung

- Eigene Location auswählen, darin einen Raum scannen oder ein Rechteck anhand
  eigener Maße anlegen. Beispiele und manuelle Räume behalten eigene Kennzeichen.
- Im großen Editor bewegen genau zwei Finger den Plan; Pinch zoomt. Ein Finger
  wählt und verschiebt einen Baustein. Die Ansicht verändert keine Raummaße.
- Katalog: Möbel, Strom, Wasser, Filmtechnik. Enthalten sind unter anderem
  Steckdosen, Drehstromanschluss, Schalter, Sicherungskasten, Warm-/Kaltwasser,
  Abfluss, Waschbecken, Toilette, Kamera und Filmleuchte.
- Breite/Tiefe, X/Z-Position, Drehung, Beschriftung und Notiz lassen sich bearbeiten.
  Eine Objektliste ermöglicht die Auswahl ohne präzises Treffen kleiner Symbole.
  Duplizieren, Drehen, Entfernen und 50 Schritte Rückgängig/Wiederholen sind lokal.
- Originalwände und RoomPlan-Quelldaten werden durch den Baukasten nicht verändert.
  Manuelle Raumgeometrie ist zunächst ein Rechteck; beliebige Wandbearbeitung und
  das räumliche Zusammenfügen mehrerer Scans sind nicht implementiert.
- PDF enthält die Bausteine, Location-Bezeichnung und eine Liste mit Maßen/Notizen.
  Der 3D-Export ist ausdrücklich der **Originalscan**, ohne die 2D-Ergänzungen.

Standardgrößen sind anpassbare Planungshilfen. Anschlüsse sind Positionsmarker,
keine Schalt-, Leitungs- oder Sicherheitsberechnung. Reale Maße/Anschlüsse müssen
vor Ort geprüft werden. Es wird keine Fläche aus einem Begrenzungsrechteck erfunden.

## Private Dateien und Wiederherstellung

Pläne bleiben ausschließlich lokal, ohne Upload oder Cloudbackup. Neue Dateien
liegen in `CineGeniusAccountFloorPlans/<SHA256(accountID)>/<UUID>.json` und enthalten
explizit Eigentümer und Location-ID. Vor Öffnen, Aufnahme, Speichern, Löschen und
Export werden Konto/Location erneut geprüft. Geräteauthentifizierung und
FileProtection.complete bleiben zusätzliche Schutzschichten. Beim Hintergrund-
wechsel werden Listen verborgen und Pläne samt Editorzustand hinter der Sperre
gehalten. Während einer erneuten Anmeldung kann der laufende Entwurf kontogebunden
im Speicher bleiben; das ist keine Wiederherstellungsgarantie nach Prozessende.

Schema 2 enthält Bausteine und Revisionsnummer. Updates sind atomar und prüfen
den erwarteten bisherigen Datensatz. Wiederholung desselben Ergebnisses ist
idempotent, konkurrierende Änderungen schlagen fehl. Quelle, Eigentümer,
Location und Erstellungszeit dürfen durch einen Editor-Update nicht wechseln.

Schema 1 bleibt lesbar. Alte ungebundene Dateien in
`CineGeniusPrivateFloorPlans` bleiben unangetastet und werden keinem gerade
angemeldeten Konto automatisch zugewiesen. Die neue Kontobibliothek zeigt sie
nicht automatisch als eigene an. Innerhalb einer eigenen Location öffnet
„Bisherige Grundrisse übernehmen“ nach erneuter Konto- und Geräteprüfung die
Altbibliothek. Erst die ausdrückliche Bestätigung für den ausgewählten Plan und
die Location speichert eine separate kontogebundene Kopie. Das Original wird
weder umgeschrieben noch entfernt. Stabile Plan-ID, Erstellungszeit, Geometrie
und RoomPlan-Quelldaten bleiben erhalten; Wiederholungen erzeugen keine Duplikate
und überschreiben keine zwischenzeitlich bearbeitete Kopie. Die App niemals zur
Aktualisierung löschen.

## Design und Quellen

CineGenius-Dunkelgestaltung und Lime-Akzent, mindestens 44pt Bedienflächen,
sichere Bereiche, normale Navigation, scrollbare Formulare und zentrale neun
Sprachkataloge bleiben maßgeblich. Es entsteht keine zweite öffentliche Fußleiste.
Der Menüadapter bleibt auf die vorhandene KI-Zeile beschränkt, Genie bleibt erhalten.

Orientierung: [magicplan-Menüstruktur](https://help.magicplan.app/the-magicplan-menu-structure),
[magicplan-Objekte](https://help.magicplan.app/add-furniture-objects),
[RoomSketcher-Anschlussplanung](https://help.roomsketcher.com/hc/en-us/articles/12794506158493-How-Do-I-Create-an-Electrical-Plan-in-RoomSketcher).
Eigene Gestaltung und Vektorsymbole; keine kopierten Produktassets.

Technische Referenzen: [Apple-Pan-Gesten](https://developer.apple.com/documentation/uikit/handling-pan-gestures),
[Apple-RoomPlan](https://developer.apple.com/augmented-reality/roomplan/),
[Clerk-Cookies](https://clerk.com/docs/guides/how-clerk-works/cookies).

## Prüfstatus

Siehe `docs/test-reports/native-floorplan-editor-2026-11-14.md`.
Der Mac-Beleg vom 14. November 2026, 09:59 UTC, bestätigt nach den zurückgeführten
Korrekturen 27 Swift-Kernprüfungen, 11 mobile Tests, Simulator-Kompilierung und
signierten iPhone-Build. Das vorhandene App-Bundle wurde ohne Löschen aktualisiert;
der normale Kaltstart blieb nach 5 und 20 Sekunden aktiv. Eine vorhandene Sitzung
wurde wiederverwendet und die deutsche Locations-Ansicht geöffnet.

Eine frische Anmeldung ist damit nicht geprüft und von Markus weiterhin als
fehlerhaft gemeldet. Die vollständige Anmeldung beim Appstart und die zu kleine
Webansicht werden separat auf dem Mac bearbeitet. Echter Legacy-Import, eigene
Location-Auswahl, Multitouch, Kameraaufnahme, Export und alle Sprachlayouts bleiben
offen. Die gespeicherten Originalpläne wurden weder geöffnet noch hochgeladen.
Belege: `/srv/cinegenius/handoffs/20261114-floorplan-editor/mac-validation/`
(`mac-update-validation-v2.json`, `physical-normal-start-verification.json`).
