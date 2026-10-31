# Öffentliche Auditkorrekturen – 31. Oktober 2026

Ausgangspunkt: Nutzerbericht „Öffentliche Stichprobe · Deutschland / EU · 31. Oktober 2026“. Referenz vor Änderungen: `0258e31`. Die Befunde wurden gegen den Quellcode geprüft; der Bericht allein wird nicht als Beleg einer Rechtsverletzung behandelt. Keine Testbuchung, Registrierung oder E-Mail an echte Mitglieder; keine Änderungen an bestehenden Nutzerdaten. Diese Änderungen sind noch nicht veröffentlicht.

## Befunde und Korrekturen

| Befund | Ergebnis |
| --- | --- |
| CG01 Zahlungsversprechen | Bestätigt: Location, Crew-Anfragehinweise, Startseitentext und alter Checkout versprachen Treuhandzahlung. Der tatsächliche API-Aufruf speichert hingegen eine Anfrage mit `pending`; hier wird keine Zahlung ausgelöst. Hinweise, Schritte, Zustimmungstext, Buttons, E-Mail und Benachrichtigungen benennen jetzt eine Anfrage und direkt mit dem Anbieter zu vereinbarende Konditionen. Keine pauschale kostenlose Stornierung versprechen. |
| Zusätzlicher Fehler im selben Ablauf | Die bisherige Oberfläche erzeugte bei einer fehlerhaften Serverantwort eine zufällige Erfolgsreferenz. Entfernt: Nur eine erfolgreiche Antwort mit gültiger Serverreferenz führt zur Bestätigung. Fehler lassen das Formular und seine Eingaben bestehen. Gleichzeitige Mehrfachklicks werden abgefangen; eine unklare Netzwerkantwort wird nicht als sichere Speicherung ausgegeben. Kein neuer Idempotenznachweis für nachträglich manuell wiederholte Anfragen – bei unklarer Antwort soll zuerst die Anfragenliste geprüft werden. |
| CG02 Session Replay | In `sentry.client.config.ts` waren Fehler-Replays mit 100 % und eine Replay-Integration mit ungesperrten Medien vorbereitet. Eine aktive Sentry-Initialisierung ist in der aktuellen Next-Einbindung nicht vorhanden; das beweist keine frühere Aufzeichnung. Beide Replay-Raten sind nun null, die Recorder-Integration ist entfernt. Keine neue Tracking-Einbindung oder Einwilligungsbox hinzugefügt. Datenschutzbeschreibung an diesen tatsächlichen Codezustand angepasst. |
| CG03 Kalender | Tage waren anklickbare `div`s. Jetzt native Buttons mit vollständig lokalisierten Datumsnamen, Auswahlzustand, deaktivierten vergangenen/belegten Tagen und sichtbarem Fokus. Monatswechsel ist benannt und per Tastatur erreichbar. Keine unvollständig implementierte ARIA-Grid-Rolle eingeführt. |
| Zusätzliche Kalenderfehler | Lokale Mitternacht wurde über UTC in einen falschen Datumswert umgewandelt. Lokale Datumsschlüssel bleiben jetzt auch in Berlin am richtigen Tag. Kalender und Checkout benutzen dieselbe bereits vom Server verwendete, endexklusive Miettageberechnung (gleicher Tag mindestens ein Tag). Reset und Neuwahl löschen die alte Auswahl auch im übergeordneten Anfragebereich. Ein eintägiger Zeitraum kann mit zweimaliger Wahl desselben Tages gewählt werden. Keine Abrechnungs-/Zahlungsfunktion hinzugefügt. |
| CG04 Namen für Bedienelemente | Suchfeld und eigenständige Leeren-Aktion erhalten zugängliche Namen. Leeren ist per Tastatur möglich und setzt den Fokus zurück ins Eingabefeld. Auch globale Suche korrigiert; zusätzlicher Platz durch `min-w-0` abgesichert. |
| CG05 Registrierung | AGB und Datenschutz waren nur bei Clerk-Pflichtfeld `legal_accepted` unmittelbar im Formular erreichbar. Jetzt stehen beide Links stets vor dem Erstellen-Button. Falls Clerk eine ausdrückliche Zustimmung verlangt, bleibt dessen Pflichtfeld bestehen und bezieht sich auf die Nutzungsbedingungen; Datenschutz wird als Information erklärt, nicht als pauschale Einwilligung. Keine zusätzliche Pflicht oder zweite Registrierung eingeführt. Die AGB behaupten keine Zustimmung durch bloßen Seitenbesuch mehr. Ein eigener versions-/hashbezogener Zustimmungsnachweis wurde damit nicht nachgerüstet; dieser bleibt gesondert zu prüfen. |
| CG06 Löschfristen | Offen. Im Code und vorhandenen Rechtsprüfunterlagen ist keine belastbare, vollständige Fristentabelle für alle Dienste und Datenklassen nachgewiesen. Es wurden keine Fristen erfunden oder Aufbewahrungseinstellungen verändert. Anbietervereinbarungen, tatsächliche Hosting-/Backup-Konfiguration, Zwecke und Löschprozesse müssen abgestimmt werden. |
| CG07 Provision | Die veraltete Untersagung von Direktkontakt zur Umgehung einer Plattformprovision ist aus § 4 entfernt. Sie widersprach der kostenlosen Plattform und dem vorgesehenen Direktkontakt. Weitere rechtliche Prüfung insbesondere zu Nutzungsrechten, AGB-Änderungen und Teilunwirksamkeit bleibt offen; kein vollständiger juristisch geprüfter AGB-Neuentwurf behauptet. |

## Geänderte Dateien

- `components/AvailabilityCalendar.tsx`, `components/LocationDetail.tsx`, `components/CreatorDetail.tsx`
- `app/booking/checkout/page.tsx`, `app/api/bookings/route.ts`, `lib/booking-request.ts`, `lib/email.ts`
- `components/AuthForm.tsx`, `components/GlobalSearch.tsx`, `app/search/page.tsx`
- `sentry.client.config.ts`, `app/agb/page.tsx`, `app/datenschutz/page.tsx`
- `messages/{de,en,es,it,cs,hu}.json`, `scripts/i18n-legacy-texts.json`
- `lib/public-audit-request.test.mjs`, dieser Prüfbericht

Neue Website-/Systemtexte verwenden ausschließlich das vorhandene Übersetzungssystem. Die geänderten deutschen Rechtstexte bleiben in allen Sprachansichten die ausdrücklich maßgebliche deutsche Originalfassung; sie werden nicht als geprüfte Übersetzungen ausgegeben. 50 nicht mehr verwendete Einträge aus dem eingefrorenen Bestand fest eingebauter Texte entfernt; keine neuen Ausnahmen hinzugefügt.

## Tatsächlich geprüfte Abläufe

### Automatisiert

27 neue gezielte Tests bestehen:

- Ablehnungen mit 400/401/403/404/409/500/503, fehlende/ungültige Referenz, ungültiges JSON und Verbindungsfehler erzeugen keinen erfundenen Erfolg.
- Erfolgreiche Antwort übernimmt exakt die Serverreferenz.
- Datumsschlüssel mit `TZ=Europe/Berlin`, Sommer-/Winterzeitwechsel und konsistente Tagesberechnung.
- Native Kalender-Bedienelemente, Sperren und Beschriftungen in allen sechs Sprachen.
- Tatsächlich gerenderte Registrierung mit und ohne Clerk-Pflichtfeld: beide Rechtslinks vor dem Submit, keine zusätzliche Datenschutz-Pflichtbestätigung.
- Sentry-Konfiguration initialisiert keinen Replay-Recorder, beide Raten null.
- Tatsächlicher Buchungs-API-Handler mit isolierten Datenbank-/Dienst-Doubles: Status pending, Preis und Titel aus dem Inserat statt Clientangaben; Nachrichten an den richtigen Anbieter; fehlgeschlagene Speicherung ohne Referenz/Benachrichtigung; Gäste und eigene Inserate werden weiter abgewiesen.
- Ein fehlgeschlagener Clerk-E-Mail-Kontolookup verhindert die In-App-Benachrichtigung des Anbieters nicht.
- E-Mail-Rendering in sechs Sprachen mit maskierten Mitgliedereingaben; kein externer Versand.

`check:i18n`, TypeScript, Designprüfung und der Produktionsbuild bestehen. Der erste lokale Build scheiterte am gesperrten Zugriff auf Google Fonts; mit freigegebenem Netzwerk erfolgreich. Für diesen reinen Build wurde ein nicht funktionsfähiger lokaler Clerk-Testplatzhalter verwendet, keine Produktionsanmeldung. Das ersetzt keine Produktionsprüfung mit einem echten Testkonto.

Der vollständige bestehende Testlauf hatte sechs Fehler in drei älteren Testharnessen: fehlende Mocks/Modulauflösung für `project-media-rights` und `support-started-offer-template`. Derselbe Stand wurde aus dem unveränderten Git-Commit separat ausgeführt: exakt dieselben sechs Fehler (19/25 Tests der drei betroffenen Dateien bestanden). Diese Fehler wurden nicht verdeckt und in diesem gezielten Änderungssatz nicht fachfremd repariert. Bestehende Lint-Befunde in Suche und altem CreatorDetail werden getrennt ausgewiesen; die übrigen hier geänderten TS/TSX-Dateien sind lint-fehlerfrei.

### Browser

Die vollständige lokale Anwendung konnte wegen fehlender lokaler Clerk-Schlüssel nicht starten. Daher wurde eine isolierte lokale Next-Testansicht mit den **echten geänderten Komponenten**, den bestehenden Website-Stilen und Katalogen verwendet. Clerk sowie Buchungs-/Such-API waren Test-Doubles ohne Zugriff auf Produktivdaten.

- Monatswechsel und Bereichswahl ausschließlich mit Tab, Enter und Leertaste bestanden.
- Belegter Tag 5. November verhindert übergreifende Auswahl. Bereich 6.–8. November ergibt konsistent zwei Tage. Zurücksetzen entfernt auch die übergebene Auswahl.
- Simulierter Speicherfehler 503: keine Weiterleitung, sichtbarer Fehler, Datum und Notiz nach Zurückgehen erhalten.
- Anschließend erfolgreiche Testantwort: Navigation ausschließlich mit `CG-TEST123`; keine echte Buchung angelegt.
- Suchfeld benannt; Leeren mit Tab/Enter setzt Inhalt zurück und fokussiert wieder die Eingabe.
- Registrierung und beide Anfrage-Schritte bei 320 px in DE/EN/ES/IT/CS/HU geprüft: keine horizontalen Seitenüberläufe. Zusätzlich 390 px, Tablet 768 px und Desktop 1440 px geprüft; Datumsfelder stehen auf kleinen Bildschirmen untereinander, damit der Jahreswert nicht abgeschnitten wird.
- Keine tatsächlichen iPhone-/Android-Gerätetests und kein neuer Safari-Anmeldetest für diesen Änderungssatz.

Vorschauen außerhalb des Repositorys:

- `audit-signup-mobile.png`
- `audit-calendar-mobile.png`
- `audit-request-desktop.png`

Pfad: `/Users/markusmueller/.codex/visualizations/2026/10/01/01a0f6ab-47e2-72d2-9d2b-c15137c043fd/`

## Nicht als erledigt darstellen

- Keine vollständige rechtliche Freigabe oder Barrierefreiheitszertifizierung.
- Fristen, versionsbezogener AGB-Nachweis und weitere Rechtsklauseln bleiben offen.
- Der vorherige Safari-Anmeldevorgang mit drei roten RSC-Meldungen ist ein getrennter, weiter offener Vorgang. In diesem Änderungssatz wurde keine weitere Authentifizierungs-/CSP-Korrektur auf Verdacht vorgenommen.
- Keine produktive Veröffentlichung, keine Migration und keine Änderung von Konten, Angeboten, Buchungen oder Berechtigungen.
