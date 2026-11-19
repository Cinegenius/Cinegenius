# Veröffentlichte App-Oberfläche: Quellenabgleich am 19. November 2026

## Aktueller Stand: gemeinsame App-Bedienleiste

Der neuere Mac-Handoff ist als `origin/main`
`9d86b9c4c794e6c8b74225b8c93ad9b70ddf3a01` bestätigt, nach
`b3c3dbe2b24c664a6b20c9bdc003b48c5e27044f` und aufbauend auf `6d503f6`.
Vercel bestätigt Production Ready für `dpl_6qipazX8iJfHt8UdmXWVzfkW9cDZ`
unter `https://cinegenius-oi9fariq6-cinegenius-7216s-projects.vercel.app` und
`https://www.cinegenius.co`. Dies ist die aktuelle Basis für weitere Produktarbeit.
Die nachfolgenden Angaben zu `6d503f6` bleiben als vorheriger Empfang erhalten.

`NativeBrowseToolbar` vereinheitlicht Smart, Projekte und News ausschließlich in
der App: Zahl, tatsächliche Schnellfilter, More und Kacheln/Liste/Karte mit
44-px-Bedienflächen. Suchblasen, Pure-Kontrast und WebKit-Fokusführung sind
angepasst. News verwendet ausschließlich freigegebene Beiträge und ihren eigenen
bekannten öffentlichen Stadtpunkt; Online-/unklare Orte bleiben ungepinnt und
sichtbar in der Liste. Projekte deaktiviert die Karte mit lokalisiertem Grund,
solange konkrete Projektorte fehlen. Verbindliche Details stehen in
`docs/native-browse-toolbar.md` im veröffentlichten Hauptcommit.

Hier erneut geprüft: Remote-Commit, Vorgängerfolge, Vercel-Status und vier anonyme
GETs auf `/`, `/news`, `/projects` sowie `/search?smart=1`. Alle vier antworten
mit 200, der neuen Deployment-ID und ohne native HTML-Markierungen; der Ursprung
bleibt `www.cinegenius.co`. Der Release ändert gegenüber `6d503f6` 34 Pfade.
13 ausgewählte Dateien bzw. Verzeichnisbäume sind identisch, darunter
Darstellungsmarker, App-Navigation, Smart-Zugriffsprüfung, Suchserver/-typen,
Datenschutzhelfer, Datenbankzugriff, Release-Script, `mobile` und `supabase`.
Die Beitragsauswahl und der öffentliche Ortsauflöser bleiben ebenfalls identisch.
Dies ist kein angemeldeter oder interaktiver Browser-/Gerätetest.

Von der Mac-Aufgabe gemeldet, hier nicht erneut gezählt: 56 relevante Tests,
17 Kataloge, Designcheck, ESLint und vollständiger Build mit TypeScript bestanden;
36 Browser-Verhaltensfälle mit 1.656 Assertions sowie abschließende CSS-Prüfungen
in Chromium/WebKit, Pure/Cinema und 320/393 px. Gemeldet sind außerdem sieben
Live-Routen und 38 erreichbare JS-Dateien. Kein angemeldeter Livekonto- oder
physischer iPhone-Nachweis dieses UI-Updates. Keine neue Schema-, Push- oder
Shots-Aktivierung laut Übergabe.

Dieser Empfang ändert weiterhin nur Dokumentation im erhaltenen älteren
Mobile-Arbeitszweig. Keine vollständige Quellübernahme, keine erneute Installation
und keine Veröffentlichung. Belege:
`/srv/cinegenius/handoffs/20261119-app-native-toolbar-received/`.

## Vorheriger Stand: erste App-Veröffentlichung

Die Mac-Aufgabe **APP** (`01a1d38d-d672-7941-8033-30d87821d882`, Host `local`)
hat nach Markus' ausdrücklichem „Ja, App-Servercode veröffentlichen“ den gezielt
auf den aktuellen Hauptstand übertragenen App-Servercode veröffentlicht:

- Commit: `6d503f66cfebc7aeda9236dc05e78b049db7a0c2`, `origin/main`.
- Direkter Vorgänger: `6f5ec38a8f4df537a77885285f2bf053875fa785`.
- Deployment: `dpl_HscsdkmUFyLKkpBg17GM7SwcjE74`, Production, Ready.
- Domain: `https://www.cinegenius.co`, gleicher Ursprung.
- Deployment-Adresse: `https://cinegenius-a6bi1236p-cinegenius-7216s-projects.vercel.app`.

Der Release umfasst 125 geänderte Pfade. Der vor dieser Empfangsdokumentation
gesicherte App-Arbeitszweig `6478d77d24a404e4a025ce56a8750d660fb29cee` weicht in
319 Pfaden von dieser Veröffentlichung ab. Er ist ein erhaltener älterer
Entwicklungsstand, keine zu veröffentlichende Kopie der neuen App. Dieser Empfang
ändert ausschließlich Dokumentation; er mischt weder die älteren Abweichungen
in den Hauptstand noch behauptet er, die 125 Release-Pfade in diesen Arbeitszweig
übernommen zu haben.

Für weitere Produktarbeit ist der aktuelle Hauptstand Ausgangspunkt. Geprüfte
zusätzliche App-Quellen müssen gezielt abgeglichen werden. Der neue Hauptcommit
enthält keine Swift-/Xcode- oder `mobile/`-Änderungen; die jüngere native
Mac-Fassung bleibt eine separate Quelle. Der ältere unveröffentlichte
Website-Auftrag „Die Crew“ aus `2bbf54b`/`6478d77` wird durch diesen Release nicht
automatisch veröffentlicht.

## Verhalten und Grenzen der Veröffentlichung

Die App-Darstellung verwendet die genaue Markierung
`data-cg-native-community-appearance="app"`. Ihre Leiste führt zu Shots,
Workspace, Smart, News und Projekte. Smart fasst Crew, Markt, Locations und Firmen
mit Mehrfachauswahl und Kacheln/Liste/Karte mit Liste zusammen. Die Markierung
ändert nur die Darstellung; sie ersetzt keine Anmeldung oder serverseitigen
Rechte. Die bestehenden Smart-Adminrechte bleiben bestehen. Die gewöhnliche
Website nutzt weiterhin ihre bisherige Navigation.

Workspace öffnet die vorhandenen nativen Werkzeuge nach der Kontoprüfung. Lokale
Archive werden dadurch keine Online-Zusammenarbeit. Laut Release-Übergabe wurden
keine neuen Migrationen angewendet und weder Shots-Veröffentlichung noch Push
aktiviert. Deren vorbereiteter Quellcode ist keine Aktivierungsbestätigung.

Die zugrunde liegende, zuvor pausierte Smart-/Spracharbeit ist ein anderer
Arbeitsumfang und wird mit diesem Empfang nicht wieder aufgenommen.

## Hier erneut geprüft

- Remote-Hauptstand und direkter Vorgänger stimmen mit der Übergabe überein.
- Die vorhandene Vercel-CLI bestätigt Projekt CineGenius, Ziel Production,
  Status Ready, Deployment-ID und Domain-Zuordnung.
- Ein eigener anonymer GET auf `/` antwortet mit 200 und enthält genau diese
  Deployment-ID. Kein Wechsel des Ursprungs.
- `/dashboard` leitet mit 307 relativ auf `/sign-in?redirect_url=%2Fdashboard`
  am selben Ursprung weiter. Die erste Prüfannahme verlangte einen absoluten
  Location-Header; der gültige relative Verweis wird nun vor der Prüfung aufgelöst.
- `/api/native/v1/push/capabilities`, `/api/native/v1/discovery` und `/api/shots`
  antworten ohne Anmeldung mit 401 und `private, no-store`.
- 19 ausgewählte kritische Quelldateien sind gegenüber `6f5ec38` bytegleich,
  darunter Homepage, Suchseite, Suchserver/-typen, Datenbankzugriff,
  Profil-/Auth-Pfade, Datenschutzhelfer und Veröffentlichungs-Script.
- Der exakte Darstellungsmarker und die darauf begrenzte App-Navigation wurden
  im veröffentlichten Quellstand gelesen. Keine neue Browserinteraktion oder
  Native-/Geräteprüfung in dieser Server-Aufgabe.

Der anonyme Schnittstellencheck belegt Zugriffsschutz, aber keinen vollständigen
angemeldeten Ablauf und keine Aktivierung bzw. Zustellung von Push. Keine
Datenbankänderung, kein Versand, keine Mitgliedersitzung und kein erneuter
Livegang wurden für diesen Empfang ausgeführt.

## Von der Mac-Aufgabe gemeldete Prüfungen

`docs/app-server-release-20261119.md` im veröffentlichten Commit dokumentiert
Build, Typen, 17 Sprachkataloge, Designprüfung, gezielte Codeprüfung sowie getrennte
Läufe mit 107 Service-, 216 Navigations-/Kontakt-, 43 Smart- und 166
Browser-Komponentenfällen. Diese Zahlen überschneiden sich und sind keine Summe
unabhängiger End-to-End-Fälle. Browser-Abhängigkeiten waren isolierte Testdaten.
Diese Läufe wurden hier nicht wiederholt und nicht als eigene Prüfungen gezählt.

Die Mac-Aufgabe meldet erfolgreiche Installation und Start der nativen Fassung
auf dem iPhone sowie den unveränderten Erhalt von 95 gespeicherten Dateien.
Die dortigen Belege liegen unter
`/Users/markusmueller/Documents/Codex/2026-11-13/cinegenius-mac-app-setup/work/phone-install-20261119/`
(`install.safe.json`, `post-install.safe.json`) sowie
`outputs/app-pruefstand-20261119/completion.safe.json`.
Das ist kein hier wiederholter vollständiger iPhone-Bedientest. Physische
Push-Zustellung und tatsächlicher Shots-Speicher-/Aufräumablauf bleiben separat.

Eigene Empfangsbelege:
`/srv/cinegenius/handoffs/20261119-app-server-release-received/`.
