# App-Startkorrektur – 22. November 2026

## Auftrag und bestätigtes Verhalten

Markus hat die nachhaltige Korrektur des bestehenden Starts beauftragt und ausdrücklich gewählt: **Nach frischer Anmeldeprüfung den zuletzt verwendeten Bereich wieder öffnen.** Ein neuer oder unbekannter Kontokontext beginnt in Smart. Explizite Links, Mitteilungen, Kontoaufgaben und das bestehende Onboarding behalten ihre Ziele. Keine künstliche Mindestwartezeit.

## Gefundene Ursachen und Korrekturen

- Der native Start hatte eine feste Mindestdauer von 1,55 Sekunden, eine unabhängige 1,95-Sekunden-Freigabe und eine weitere Bereichsauswahl/Ladefläche. Jetzt bleibt eine einzige zur LaunchScreen-Grafik passende statische Fläche bis zur aktuellen bereiten Zielansicht sichtbar. Keine automatische Freigabe nach Zeitablauf. Nach 12 Sekunden Stillstand erscheint auf derselben Fläche eine zugängliche Wiederholungsaktion.
- Das Ende von WKWebView.isLoading war weder ein Nachweis für fertiges Clerk/React-Layout noch nötig, um auf alle Bilder zu warten. Ein aktuelles Dokument mit isoliertem Nonce, aktuellem Konto-/Sitzungskontext, fertiger nativer Kopf-/Fußleiste und gemessenem Inhaltsbereich signalisiert seine Darstellung. Smart und Shots müssen ihre frischen berechtigten Ergebnisse oder ihre endgültige Wiederholungsansicht bereitstellen. Zwei tatsächlich stabile Bildframes ersetzen feste Verzögerungen.
- Der sign-in→dashboard-Umweg bleibt zur Erhaltung der bestehenden Auth-/Onboarding-Regeln intern bestehen; die kalte native Zwischenansicht montiert jedoch DashboardContent mit seinen Profil-, Angebots-, Buchungs- und Inboxabfragen nicht. Der harmlose Darstellungsmarker ist kein Anmeldenachweis. Er wird bei tatsächlicher späterer Dashboard-Navigation oder Rückkehr freigegeben und nicht erneut in spätere Dokumente injiziert.
- Die native Identitätsprüfung lud vorher vollständige Verantwortlichendaten einschließlich möglicher Profil-/Angebots-/Firmendaten. GET /api/native/v1/session liefert jetzt ausschließlich die aktuell geprüfte Benutzer-ID und Sprache, private/no-store, 401 bei Abmeldung und 503 bei Fehler. Native Work prüft Konto und lokalen Speicher weiterhin eigenständig frisch.
- Die eigene Profilabfrage führt keine überflüssigen fremden Sichtbarkeitsabfragen aus. Für fremde Profile bleiben Blockierung, Freundschaft und Sichtbarkeit vollständig erhalten.
- Website-Einblendeeffekte mit 350-ms-Observer/1400-ms-Fallback sowie Kartenunschärfe und Verschiebung werden im nativen App-Kontext übersprungen. Die gewöhnliche Website behält ihr Verhalten.

## Schutz gegen Wiederholungs- und Kontorennen

Hintergrund, anderes Dokument, Navigation oder geänderte Clerk-Sitzung entwerten laufende Nachweise. Bereitmeldungen während einer laufenden Prüfung werden zusammengefasst erneut geprüft. Abgebrochene alte Navigationen lösen keinen Fehler der neuen Navigation aus. Recovery bleibt bis zu bewusstem Wiederholen stehen; verspätetes Work-Ergebnis kann sie nicht überdecken. Gespeichert werden nur geschlossene Bereichskennungen pro bereits verifiziertem Konto, keine privaten URLs, Suchbegriffe oder Anmeldebeweise.

## Geprüfter Quellenstand

Die vorher freigegebene gemeinsame App-Hülle und deckenden Zweispaltenkarten sind 2225503, mit veröffentlichtem Website-Commit 57d7658 zu ed334e8 zusammengeführt. Die zusätzliche Startkorrektur ist als eigener überprüfter Quellstand darauf vorbereitet.

- Web: 114 gezielte Startup-/Smart-/Privatsphäretests, 7 Dashboardprüfungen sowie 350 Auth-/Sitzungs-Integrationstests bestanden. Acht tatsächliche lokale Chromiumfälle prüfen den Bootvertrag einschließlich noch ladendem Bild/Netzwerk; acht weitere prüfen native Einblendeeffekte und unveränderte Website. Negativkontrollen erkennen verfrühte Freigaben, alte Dashboard-Montage und gefälschte Identität.
- Native: 126 mobile Tests bestanden; darunter ausgeführte Swift- und tatsächliche JavaScriptprüfungen für Konto-/Lebenszyklus-/Dokumentrennen, Recovery und den Dashboardmarker. SDK-Prüfungen verwenden das installierte Capacitor 8.6.2.
- **Vollständiger Gerätebuild 2026112204 bestanden**, signierter unveränderlicher Kandidat gesichert, 376 Quell-/Ressourceneingaben geprüft; 9 native Kataloge mit je 1876 Schlüsseln und 45 öffentliche Ressourcen stimmen überein. Keine temporäre Genie-Testkonfiguration enthalten.
- Gestaltung und Übersetzungsprüfung bestanden: 17 Webkataloge, 11319 Schlüssel, 0 neue Quellliterale. Keine neuen ESLintbefunde; bestehende Dashboardbefunde sind als unveränderte Basis dokumentiert.

Belege außerhalb des Gitbaums: lokaler App-Auftrag work/app-startup-20261122/{web-startup-final-source-freeze.safe.json,native-build-inputs-2204.safe.json,native-candidate-2026112204.safe.json} und work/native-startup-20261122/receipt.safe.json.

## Tatsächlicher Veröffentlichungs- und Gerätestand

Beim Erstellen dieses Prüfberichts ist 2204 **gebaut, noch nicht veröffentlicht oder installiert**. Installiert bleibt 2202; dessen frühere Bedienungsabnahme ist fehlgeschlagen. Die anschließende Veröffentlichung, frische Sicherung, Datenvergleich vor erstem Start und tatsächliche Kaltstart-/Rückkehrprüfung sind jeweils getrennt nachzuweisen. Tests mit lokalen Browserdaten beweisen keine physische Startzeit oder vollständige Ruckelfreiheit.

Die explizit geöffneten privaten Links behalten ihre bisherigen kontogeprüften Ladeansichten; der neue Kaltstart stellt ausschließlich die fünf regulären Bereiche wieder her. Native und Web verwenden denselben Gestaltungsvertrag, bleiben technisch zwei Renderer. Neue Teamkanäle, E-Mail-Anbindung und erweiterter Planeditor sind weiterhin getrennte offene Arbeit.

Abschlusscheckpoint: Der vollständige 2204-Kandidat und die exakten Web-/Native-Quellen sind unabhängig geprüft. Nach erneut bestätigtem entsperrtem Mac und sichtbarem GitHub-Desktop-Fenster wird der vorgeschriebene Projektabgleich fortgesetzt. Veröffentlichung und Geräteprüfung bleiben bis zum tatsächlichen Nachweis offen.
