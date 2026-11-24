# PostHog · Registrierung und Einrichtung · 24. November 2026

Nach dem lesenden Seitencheck hat Markus die vorgeschlagene Reihenfolge bestätigt: zuerst erkennen, wo Nutzer bei Registrierung und Einrichtung hängen bleiben; danach Länder/Zählung und News verbessern. Dieses erste Paket ergänzt die vorhandene Messung, ohne Eingaben, Authentifizierung, Pflichtfelder, Speichern oder Veröffentlichung zu verändern. **Nach ausdrücklicher Freigabe veröffentlicht und live geprüft.**

## Umfang

Vier gezielte Ereignisse: Schritt erreicht, Weiter/Speichern versucht, sichtbarer Fehler und bestätigter Abschluss. Die Registrierung und der gemeinsame Profilassistent für Crew, Talent, Firmen, Locations- und Marktplatzanbieter sind abgedeckt. Bereits bestehende Sucher-Einrichtungen bleiben erhalten. Fehlermeldungen verlassen die Seite nur als feste grobe Kategorien, niemals als Text. Abschluss bedeutet bestätigte Registrierung/Einrichtung, keine allgemeine Freigabe oder öffentliche Sichtbarkeit aller Angebote.

Erweiterte, freiwillige Zustimmung v3 in allen 17 Sprachen. Alte Zustimmung reicht nicht; alte Ablehnungen bleiben wirksam. Wesentliche Funktionen funktionieren auch ohne Messung oder bei ausgefallenem PostHog. Keine neuen Anfragen pro Eingabe, kein Server-Tracking, kein neuer Dienst und keine Änderung an der geografischen Erfassung. Die technische Ereignisdefinition und Grenzen stehen im [Analytics-Vertrag](posthog-analytics.md).

## Grenzen und nächste Aufgaben

- Der Lesezugang zum EU-Projekt 346367 wurde am 24.11. geprüft. Das ist keine Aktivierung des separaten serverseitigen Redaktions-Lernfeeds.
- Ereignisse bleiben beobachtete Browserabläufe. Tab-/Neuladewechsel und abgelehnte Zustimmung verhindern vollständige Personen-/Abbruchzahlen. Ein fehlender Abschluss ist kein Beweis für einen technischen Fehler.
- Anmeldung bestehender Mitglieder, Passwortwiederherstellung, eigenständige alte Firmen-/Inseratassistenten, native Work-Werkzeuge und Geräteanalyse sind nicht Teil dieser Ergänzung.
- Länderstatistik und stabilere anonyme Zählung folgen separat. Danach News-Sichtbarkeit und tatsächliche Artikelöffnungen vergleichen. Bestehende App-/Mail-Arbeit und deaktivierten täglichen Prüfagenten erhalten.

## Prüfung

Belege: `/srv/cinegenius/handoffs/20261124-setup-analytics/`. Kontrollierte Prüfungen verwenden ausschließlich synthetische Konten und einen PostHog-Transportadapter; keine Testereignisse oder Konten in Produktion angelegt. Livegang, echte Ereignisankunft und physische App-Abnahme sind getrennte Schritte. Zwei vorhandene Hook-Abhängigkeitswarnungen im Profilassistenten bleiben dokumentiert; keine neuen ESLint-Fehler.


- 306 bestehende und ergänzte Registrierungs-/Einrichtungsprüfungen bestanden. Anschließend 41 gezielte Analytics-/Abschlussprüfungen bestanden; diese Läufe überlappen und werden nicht zu einer Gesamtfallzahl addiert.
- 40 kontrollierte Browserfälle bestanden: Zustimmung in allen 17 Sprachen bei 320/393 CSS-Pixeln, der tatsächliche Registrierungsablauf und der Analytics-Hook für fünf Bereiche. Sechs gezielte Nachprüfungen bestätigen die abschließende Entdopplung sichtbarer Fehler und den Abschluss vor Navigation. Deutsche 320px-Ansicht zusätzlich visuell geprüft.
- 20 verpflichtende Designprüfungen bestanden. React-Prüfung: Analytics bleibt nach Zustimmung dynamisch geladen, keine zusätzliche Wartezeit im Speicher-/Navigationsablauf, keine Anfragen pro Tastendruck.
- Sprachprüfung: 17 Kataloge mit 11.726 Schlüsseln und keine offenen Quelltext-Literale. Separate vollständige TypeScript-Prüfung ohne Diagnosen abgeschlossen.
- Vollständiger Produktionsbuild einschließlich erneuter TypeScript-Prüfung und 177 statischer Seiten bestanden. Keine Veröffentlichung ausgelöst.


## Livegang · 24. November 2026

Produktcommit `13445c23ec45fe120488d402fd7a439cf358ca0b`, Deployment `dpl_Fpaw5aQyEbJZyavSVPrmr63ucbnV`: normaler geschützter Release aus sauberem `main == origin/main`, Projektidentität und www-Zuordnung bestätigt, READY. Unveränderter geprüfter Kandidat per Fast-forward veröffentlicht. 20 Designprüfungen, 17 Kataloge, vollständiger Produktionsbuild und TypeScript bestanden; festes Basic-Buildprofil mit zwei Kernen/8 GB erhalten. Keine Migration, native Installation oder Änderung an Worker-/Anbietereinstellungen.

Acht öffentliche HTTP-/Zugangstests und zwei echte Browserfälle bei 320/393px bestanden. Alter Opt-in verlangt erneute Zustimmung, alte Ablehnung bleibt erhalten; Einstellungen, Ablehnen und Widerruf funktionieren. Die echte Registrierung wurde ausschließlich durch leeres Absenden bis zur lokalen Validierung geprüft: keine Konto-/Profil-Schreibanfrage und kein erfundener Abschluss. Nach ausdrücklicher Zustimmung drei echte Testereignisse in EU-Projekt346367 per UUID wiedergefunden: `setup_step_viewed`, `setup_submitted`, `setup_error`. Keine Formularwerte, private URL oder Personenprofilverarbeitung im Ereignispayload. Nach Widerruf keine weiteren Ereignisse. **Diese drei synthetischen Testereignisse aus späteren Nutzerkennzahlen ausschließen**; UUIDs und vollständige Nachweise stehen unter `production/live-check.json` und `production/posthog-arrival.json` im Belegordner.

Der zunächst verwendete automatisierte Browser wurde nachweislich vom PostHog-Botfilter verworfen. Gegenprüfung mit regulärem isoliertem Chrome über lokale Browsersteuerung bestanden; kein Produktionscode oder Botfilter dafür geändert. Die abgeschlossene Übertragungsprüfung beweist nicht den angemeldeten kompletten Einrichtungsabschluss auf einem echten Nutzergerät; diese Schreibpfade bleiben durch die vorherigen kontrollierten Prüfungen belegt. Im anschließenden begrenzten Deployment-Logfenster wurden keine Runtime-Fehler zurückgegeben. Physische App-Abnahme bleibt separat.

Veröffentlichungsbeleg: `/srv/cinegenius/handoffs/20261124-setup-analytics/production/receipt.json`. Länder/Zählung und News bleiben die nächsten gesonderten Aufgaben; der Connectorzugang aktiviert keinen Redaktions-Lernfeed.
