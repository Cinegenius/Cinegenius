# Gemeinsame Kontonutzung: App-Client

Diese App-Fassung implementiert den am 16. November 2026 übergebenen Vertrag für
`GET` und `POST /api/account/activity`. API, Migration, Aktivierung, Erstmitteilung,
E-Mails und Betreiberprüfung bleiben beim gemeinsamen Website-Backend. Dieser
Client veröffentlicht nichts, löscht nichts und enthält keine eigene Fristenlogik.
Die Serverintegration ist im gemeinsamen Entwurf enthalten; produktive Aktivierung und Geräteabnahme stehen noch aus. Übernommen aus App-Commit `3f501035544033005cd0778fe44f17bf72477d27`, ohne fremde native Änderungen.

## Ein gemeinsamer Einstieg

`AccountActivityTracker` sitzt einmal innerhalb der vorhandenen
`AuthSessionBoundary` im Layout. Erst eine geklärte Clerk-Sitzung mit Konto und
Session startet ihn. Der Sessionstart zählt; spätere echte Pointer-/Tastatureingaben,
sichtbare Rückkehr und Netzrückkehr lösen höchstens etwa stündlich eine bestätigte
Meldung aus. Es gibt keinen Intervalltimer, Hintergrunddienst, Beacon oder
Presence-Ping als Aktivitätsquelle. Der unveränderte `PresencePing` bleibt davon
getrennt.

iOS und Android senden bereits nach einer tatsächlichen Rückkehr aus dem
Hintergrund `cinegenius:app-resume`. Der Tracker hört auf dieses vorhandene
Ereignis. Die nativen Ursprung-/Hauptframe-Prüfungen und der leere Event-Payload
bleiben erhalten. Ein vor der Auth-Auflösung verpasstes Ereignis wird durch den
anschließenden bestätigten Sessionstart abgedeckt. Keine Kontodaten, Tokens oder
Raumpläne werden über die native Nachrichtenbrücke übertragen. Die isolierte
native Konto-/Location-Abfrage bleibt ausschließlich lesend.

## Vertrag und Fehler

`lib/account-activity-client.ts` prüft die empfangene Struktur vollständig:
`enabled`, nullable `state`, die sechs bekannten Stufen, UTC-Datumstrings,
`exempt` und optional `reactivated`. Es berechnet keine zwölfmonatigen oder
anderen Serverfristen. Unbekannte, unvollständige, widersprüchliche oder ungültige
Antworten führen zum Fehlerzustand. Ein noch inaktiver Status nach einem POST
ist keine Bestätigung einer wieder aktiven Sitzung.

Anfragen verwenden denselben Ursprung, die vorhandenen Sitzungscookies,
`no-store`, `redirect: error` und einen zwölfsekündigen Timeout. POST hat keinen
Body und keine Client-Konto-ID, Zeit oder Auth-Kopie. GET ist ausschließlich
Statusabruf. Offline, 401, 403, 429, 503, HTML und ungültiges JSON sind kein Erfolg.
Nach Fehlern erfolgt erst auf ein weiteres Vordergrund-/Bedienereignis ein
neuer Versuch, mit mindestens einer Minute Abstand und beachtetem Retry-After
(begrenzt auf einen Tag). Eine deaktivierte Funktion wird als deaktiviert
behandelt und bestätigt keine Nutzung. Die Drosselung verwendet nur eine lokale
monotone Uhr; der bestätigte Nutzungszeitpunkt stammt ausschließlich vom Server.

Beim Konto-/Sitzungswechsel werden Requests abgebrochen, Listener entfernt und
späte Antworten verworfen. Bestätigte Aktivität löst nur das payloadfreie
`cg:account-activity-updated` zum neuen Statusabruf aus. Eine vom Server bestätigte
Reaktivierung löst zusätzlich das vorhandene `cg:account-reactivated` und eine
Serverkomponenten-Aktualisierung aus. Private Daten werden dafür weder in
LocalStorage noch in einer globalen Event-Nutzlast abgelegt.

## Einstellungen

`AccountActivitySettings` steht einmal in den bestehenden Kontoeinstellungen
neben der Privatsphäre. Es zeigt deaktiviert, noch nicht erfasst, ausgenommen,
Laden, Fehler mit Wiederholen oder den bestätigten Status mit den gelieferten
Terminen. Die Termine sind ausdrücklich frühestmögliche Stufen und keine Zusage
einer automatischen endgültigen Löschung. Eine Kontowechsel-Reihenfolge A–B–A
erzeugt jeweils ein frisches Panel. Ein Sprachwechsel erhält dessen Zustand.
Alle neuen Texte liegen in `AccountActivity` der neun bestehenden Kataloge.

Bei der WEB-Übernahme die 22 Client-Schlüssel mit den dortigen zusätzlichen
`AccountActivity`-Mail-/Admin-/Policy-Schlüsseln zusammenführen. Niemals den
ganzen Namespace oder die gesamten App-Kataloge ersetzen. Tracker/Settings
ersetzen ihre vorläufigen WEB-Pendants; keine zweite Karte oder doppelte
Layout-Registrierung hinzufügen. Native App-Quellen und fremde Änderungen sind
nicht Bestandteil dieses Client-Diffs.

## Prüfung und verbleibende Grenzen

Die fokussierte Suite steht in `lib/account-activity-client.test.mjs` und den
bestehenden mobilen Resume-/Konto-/Starttests. Sie prüft Antwortvalidierung,
Fehler, Abbruch, Konto-/Sitzungswechsel, Drosselung, den Gastzustand sowie alle
Sprachen und Statusstufen. Der separate Browserbeleg benutzt echte React-
Komponenten und gemeinsame CSS-Regeln, aber simulierte Konten, Router und API.
Er ist kein Nachweis für eine echte angemeldete Sitzung oder native Ausführung.

Vor der gemeinsamen Freigabe: geprüften Backend-Commit/Migration integrieren,
reale 401-/Offline-/Rückkehrabläufe prüfen und iPhone/iPad/Android testen,
einschließlich Rückkehr mit geöffnetem nativem Scanner oder verdeckter Webansicht.
Lokale Grundrisse und laufende native Änderungen bleiben unverändert. Maßgeblicher
Prüfbeleg: `/srv/cinegenius/handoffs/20261116-app-account-activity-client/`.
