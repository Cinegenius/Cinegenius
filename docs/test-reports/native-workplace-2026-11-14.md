# Nativer Arbeitsplatz – Prüfstand vom 14. November 2026

## Abgleich und Serverprüfungen

Die App-Ressourcen wurden mit `c3a387d` gesichert. Der geprüfte Website-Commit
`e47c0680be2ab4a19bc724ef8ca5370bcfdec72c` wurde anschließend mit `6c1f65c` in
den App-Zweig übernommen. Die Web-App-Dateien unter `app`, `components` und `lib`
entsprechen exakt diesem Website-Commit. Beide Ergänzungen der Arbeitsregeln
bleiben erhalten. Die neun Kataloge enthalten unverändert die 96 neuen
`NativeRoomScanner`-Texte und zusätzlich den Web-Schlüssel `companyTeam.leadership`.
Der separate Rechtstextentwurf wurde nicht übernommen.

WEB CODEX hat die Veröffentlichung von `e47c068` nach Markus' dortiger ausdrücklicher
Freigabe bestätigt. Die Remote-Vorschau kann diese Version nach frischem Laden
anzeigen. Das ist keine Veröffentlichung des nativen Arbeitsplatzes oder dieser
App-Änderungen auf der Website.

- Fünf mobile Node-Tests erfolgreich: Origins, Konfigurationsgrenzen, alle neun
  nativen Kataloge sowie Berechtigungstexte und Platzhalter.
- `check:i18n`: neun Kataloge, 7.906 Schlüssel, keine neuen unübersetzten Literale.
- `check:design` und `git diff --check` erfolgreich.
- 158 betroffene Web-Prüffälle nach dem Merge erfolgreich: kompakte Zahlen,
  öffentliche Teamordnung, Angebotsbilder, Karten, Locations und Nachrichteneingang.
  Der erste direkte Aufruf ohne den vorhandenen Test-Alias-Loader schlug an der
  Modulauflösung fehl; mit dem regulären Repository-Loader bestanden alle Fälle.
- ESLint der neuen/geänderten mobilen JavaScript-Dateien erfolgreich.

## App-Menü im Browser

14 Chromium-Fälle prüfen das gebündelte Menüskript: neun Sprachen bei 320 px,
Tastatur/Tap, Wechsel der Sprache, ersetzte Menüknoten, fehlenden Native-Handler,
falsche Origins/Ports/Protokolle, eingebettete Frames und unveränderte History.

Zusätzlich wurden neun tatsächliche öffentliche Menüansichten bei 320 px geprüft.
Der Adapter wird erst nach Öffnen des bereits hydratisierten Dialogs aktiv. Der
Arbeitsplatz-Einstieg bleibt bedienbar; Schließen und erneutes Öffnen stellen den
Scrollzustand wieder her. In diesen abschließenden Fällen traten keine
Browser-/Hydrierungsfehler auf. Native Starts wurden dabei nur als Bridge-Aufruf
aufgezeichnet. Diese Browserfälle liefen vor der Veröffentlichung von `e47c068`;
dessen gemeinsamer Menüaufbau blieb unverändert.

Das sind Browserprüfungen, keine echte Kamera-, LiDAR- oder Gerätefreigabe.
Prüfbelege liegen unter
`/srv/cinegenius/handoffs/20261114-native-room-scanner/browser/` und
`web-merge-tests.log` im übergeordneten Übergabeordner.

## Native Quellen und bisherige Simulatorprüfung

18 native Dateien wurden aus `native-final-v1.tar.gz` übernommen. SHA-256:
`4fe7226c74fd22861424196af8bb7a265440634f2b36c284ac3c5df625042a83`.
Archiv, Einzelfiles und die unveränderten Ausgangsdateien wurden vor dem Import
gegen das Manifest geprüft. Buildprodukte und Nutzerdaten wurden nicht übernommen.
Der vollständige Mac-Bericht und die 15 erfolgreichen Swift-Tests liegen im
Unterordner `mac-implementation/` des Übergabeordners.

Die native Ansicht wurde im iOS-26.5-Simulator gebaut und geöffnet. Geprüft wurden
Arbeitsplatz → Locations → Grundrisse, die fehlende Sensorunterstützung im
Simulator, das gekennzeichnete Beispiel, Zoom/Drehung, beide Texteingaben mit
Tastatur und der explizite PDF-Export. Der Beispiel-PDF enthält auf zwei Seiten
Kennzeichnung, Maße, Maßstab und die Linienlegende. Der System-Entsperrdialog war
sichtbar; der Agent gab keinen Gerätecode ein. Ein gespeichertes Beispiel wurde
sichtbar. Diese Beobachtung ersetzt keine physische Face-ID-Prüfung.

Die überprüften Korrekturen erhalten stabile Quelldaten bei wiederholtem Speichern,
laden die Bibliothek nach erneutem Entsperren und behalten aktive Exportdateien
bis zum Ende der Weitergabe. Wände werden mit linearem Aufwand nummeriert;
Linienarten sind in Ansicht und PDF unterscheidbar. Eine eigene passive
Abdeckung schützt auch eigene Dialoge beim Wechsel in den Hintergrund.

Noch offen im ersten Mac-Bericht: abschließende Build-Bestätigung nach dem
Registrierungs-Guard, neun native Sprachansichten, größere Schrift,
Arbeitsplatz-Aufruf aus der echten Webansicht/Schnellaktion sowie vollständige
Abbruch-/Cleanup-Prüfung der Weitergabe. Weitere Mac-Belege ergänzen diesen Stand;
diese offenen Fälle werden nicht als bestanden gezählt.

## Physisches iPhone

Das iPhone 15 Pro wird über USB als verbunden und mit dem Mac gekoppelt erkannt.
Der zuletzt bestätigte Gerätestand zeigte noch ausgeschalteten Entwicklermodus
und keine nutzbare Entwicklungssignatur. Markus hat keine kostenpflichtige
Apple-Developer-Mitgliedschaft; vorgesehen ist die kostenlose direkte Installation
mit Xcodes Personal Team. Persönliche Anmeldung und Gerätebestätigungen bleiben
bei Markus. Es wurde kein TestFlight-Upload durchgeführt.

Echte Raumaufnahme, Kamera-Freigabe, Wiederaufnahme nach Unterbrechung, Vergleich
der Maße vor Ort und USDZ-Export aus einer echten Aufnahme bleiben bis zum
vollständigen Gerätetest offen. Keine gespeicherten privaten Nutzerpläne wurden
für diese Prüfung auf den Server kopiert.
