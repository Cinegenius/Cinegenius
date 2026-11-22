# Persönlicher dauerhafter KI-Testzugang

Stand: 22. November 2026. Lokal implementiert und mit synthetischen Quellen geprüft; noch kein neuer Live-/Geräte- oder kostenpflichtiger Providernachweis.

Markus hat den bisherigen serverseitigen Providerzugang zur Wiederverwendung und den persönlichen Test ohne monatlichen App-Kostenbetrag, Testablaufzeit oder Zehn-Analysen-Gesamtzähler freigegeben. Bestehende Provider-Projekt-, Leistungs- und Sicherheitsgrenzen werden nicht erhöht. Dies ist keine allgemeine KI-Freischaltung und keine Online-Teamfunktion.

## Verbindung und Konto

Die private Debug-App verwendet für Dispo und Genie-Work die bestehende Anmeldung auf derselben CineGenius-Origin. `workplace-genie-request.js` wird ausschließlich von Native in einer isolierten `WKContentWorld` aufgerufen. Keine Seiten-Listener, kein Export von Cookies/Sitzungstoken, keine Providerzugangsdaten im App-Paket und kein Mac-/LAN-Tunnel gehören zu diesem neuen Pfad. Die alte kurzlebige Relay-Konfiguration wird nicht geladen und ist kein Rückfallpfad; beim neuen Build nicht injizieren.

`POST /api/native/v1/genie/[kind]` lässt nur `personal-dispo` und `work-task` mit ihrem bestehenden geschlossenen Vertrag zu. Die ältere `analyze`-Adresse antwortet bewusst `unavailable`: Die aktuelle geprüfte private Serverquelle bietet diesen Drehbuchpfad nicht an. Ein anderes Modell oder einen alten Prototyp still einzusetzen wäre keine Wiederverwendung der freigegebenen Analyse.

Der Server verlangt eine verifizierte Clerk-Sitzung und exakt die bereits für den persönlichen Genie-Zugang konfigurierte Konto-ID. Ein Clientheader bestätigt ausschließlich die Übereinstimmung, er erteilt keine Berechtigung. Name, Adminstatus, Projekt-ID und Native-Kennzeichen ersetzen die Sitzung nicht. Die aktuelle Sitzung wird vor Verarbeitung, unmittelbar vor Generierung und vor Rückgabe gegen Clerk geprüft. Ergebnisse bei Widerruf werden verworfen. Die App prüft zusätzlich Eigentümer, First-Party-URL, Zugriffsgeneration und Konto vor/nach dem Request; Hintergrund, Navigation, Abbruch oder entzogene lokale Berechtigung beenden die laufende Brückenarbeit.

## Betrieb ohne geheime Werte im Repository

Erforderlich im bestehenden App-Serverprojekt:

- `OPENAI_API_KEY`: bestehenden serverseitigen Zugang unverändert wiederverwenden; weder neu anlegen noch zwischen Umgebungen oder aufs Gerät kopieren.
- `GENIE_UNLIMITED_USER_ID`: bestehende private Einzelkonto-ID. Derselbe Abgleich steuert bereits den persönlichen allgemeinen Genie-Zugang; keine Erweiterung auf Admins oder andere Konten.
- `GENIE_NATIVE_TEST_ENABLED=true`: ausdrücklicher Schalter für genau diesen privaten Endpunkt. Fehlend/anders bedeutet gesperrt.
- Der bestehende globale `GENIE_ENABLED=false`-Ausschalter, Clerk und der vorhandene dauerhafte Quotenservice bleiben wirksam. Keine Migration ist nötig.

Keine Ablaufzeit und kein Gesamtzähler bedeuten keine unbegrenzte Parallelität. Die App lässt eine Analyse gleichzeitig zu. Der Server lässt je Instanz einen Request pro persönlichem Konto zu und reserviert dauerhaft höchstens zwei Generierungen pro Minute. Zusätzlich gelten die unveränderten gemeinsamen Genie-Minutenlimits; deren Zähler teilen sich allgemeiner Genie und dieser Pfad. Fehlgeschlagene/abgebrochene Generierungen werden nicht erstattet. Der Instanzschutz ist kein verteilter Lock; die Minutenkontrolle ist keine Geldobergrenze. Der Request bleibt zeitlich und größenmäßig begrenzt, damit defekte Verbindungen nicht endlos weiterlaufen.

Der neue Routenrahmen verwendet `maxDuration=600`, der interne Request-Abbruch liegt bei 540 Sekunden. Metadaten des bestehenden verknüpften Vercel-Projekts und Teams wurden ohne Ausgabe von Zugangsdaten oder Umgebungswerten geprüft: Pro, Fluid aktiviert, Node 24.x, Standardlaufzeit 300 Sekunden. Die explizite Routenlaufzeit liegt innerhalb der bereits verfügbaren Pro-Grenze von 800 Sekunden; Plattform-/Projektgrenzen wurden nicht angehoben. Quellen: [Vercel-Laufzeitgrenzen](https://vercel.com/docs/functions/configuring-functions/duration) und authentifizierte reine Metadatenabfragen vom 22. November 2026.

Vercel-Anfrageabbruch ist ausschließlich für `app/api/native/v1/genie/**/route.ts` in `vercel.json` aktiviert. Der vorhandene Request-Abbruch wird bis zum Provider weitergereicht. Die instanzlokale Belegung wird synchron beim Abbruch und zusätzlich beim Abschluss freigegeben; die eigene eindeutige Belegung verhindert, dass ein verspäteter Abschluss einen Nachfolgerequest freigibt. Providerarbeit wird dafür nicht durch `after` oder `waitUntil` verlängert. Die lokalen Tests prüfen diese Reihenfolge mit absichtlich verspätetem Engine-Abschluss. [Vercels Abbruchkonfiguration](https://vercel.com/docs/functions/functions-api-reference#cancel-requests) muss nach dem gemeinsamen Remote-Build zusätzlich an der tatsächlich erzeugten Funktionskonfiguration als `supportsCancellation: true` nachgewiesen werden; lokale Konfiguration und Mocktests ersetzen diesen Nachweis nicht.

Für diesen Nachweis nur Metadaten ausgeben: Die authentifizierte Vercel-Abfrage `GET /v11/deployments/{id}/builds` kann die tatsächlich erzeugten Funktionspfade, `lambda.runtime` und `lambda.timeout` bestätigen, garantiert aber kein `supportsCancellation`-Feld. `functions` in Deployment-Eingabedaten ist kein erzeugter Nachweis. Ist die Ausgabe des Remote-Builders zugänglich, nach Abschluss des Next-Adapters nur die zur neuen Genie-Route gehörenden `.vercel/output/functions/**/.vc-config.json` lesen, gegebenenfalls Funktionsalias folgen und ausschließlich relativen Pfad, `runtime`, `maxDuration` und `supportsCancellation` ausgeben; erwartet sind 600 und `true`. Nie die vollständige Konfiguration ausgeben. Fehlt der Zugriff auf diese erzeugte Ausgabe, bleibt der tatsächliche Flag-Nachweis offen.

## Unveränderte Analyse und Daten

Die 31 tatsächlich importierten Core-/Providerabhängigkeiten stammen bytegleich aus der aktiven privaten Serverquelle `20261121T105921Z-work`; die alten Bearer-/TTL-/Gesamtzähler-Worker wurden nicht übernommen. Das lokale Nachweisverzeichnis enthält das Herkunfts-/Hashmanifest ohne Schlüsselwerte.

Dispo behält den kompakten Vertrag mit Quellen-Spans, den vorhandenen strengen Validierungen und der ausdrücklich gewünschten minimalen Zeiten-/Orte-Auswertung. Modell `gpt-6.1-sol`, Reasoning `medium` und der bestehende `ultrafast`-Dispopfad bleiben unverändert. Genie-Work behält seinen eigenen bestehenden Provider und Vertrag. Allgemeiner Genie behält seine vorhandene separate Modellauswahl. Beide verwenden denselben persönlichen Kontovergleich und dieselben allgemeinen Minutenwachen.

Nur ausdrücklich zur Analyse übergebene Quellen und berechtigte Work-Fakten werden verarbeitet. Dokument-ID, Originalhash, Revision, Projektauswahl und Gewerkeumfang bleiben geprüft. Keine zusätzlichen Archive, Crew-Datenbankabfragen, Teammitgliedschaften, Datei-Synchronisierung, Veröffentlichung oder Nachrichtenaktionen werden dadurch freigegeben. Die Serverantworten sind privat und `no-store`; keine Text-/Quellen-/Providerfehler-Protokollierung wurde ergänzt. `store:false` bleibt erhalten und ist keine Zusage vollständiger Löschung beim Provider.

## Nachweis und nächster sicherer Schritt

Lokale Tests prüfen Fremdkonten, Fälschungen, Herkunft, Schalter, aktuelle/widerrufene Sitzungen, Grenzen, Parallelität, Abbruch und unveränderte gemeinsame Quoten. Die echten Core-/Compactmodule werden mit vollständig synthetischen Quellen durchlaufen, einschließlich belegtem Erfolg und Ablehnung erfundener Quellen. Ressourcen-, Swift-Parse- und isolierte SDK-Typprüfungen decken die neue native Brücke ab; ein Gesamtbuild und die tatsächliche Sitzung auf dem iPhone bleiben separate Nachweise.

Vor einer kostenpflichtigen Prüfung wird das eingefrorene Paket an Root übergeben. Vorgeschlagener Smoke: genau eine kleine synthetische Dispo über den echten angemeldeten App-Pfad, eine Generierung ohne automatische Wiederholung; nur Status, Laufzeit und strukturelle Validierung protokollieren. Keine echten Produktionsunterlagen und kein Schlüssel-/Cookieexport. Erst nach dieser Freigabe und Veröffentlichung den echten Mobilfunkbetrieb ohne Mac prüfen. Kein solcher Provider-Smoke wurde im Implementierungsschritt ausgeführt.
