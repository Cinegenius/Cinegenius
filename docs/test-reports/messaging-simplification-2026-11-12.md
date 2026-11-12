# Nachrichten und Kontakte vereinfachen – 12.11.2026

Auftrag nach dem Support-/Admin-Release: Einzelchats und Gruppen einfach wie
vertraute Messenger bedienen, CineGenius-Design erhalten und App-Regel beachten.

Abnahme: ein Einstieg „Neue Nachricht“, Personenwahl für Einzelchat/Gruppe,
gemeinsame Gesprächsliste mit Suche, Gruppeninfos über den Chatnamen und klare
Kontaktanfragen statt uneinheitlicher Freund-/Vernetzen-Begriffe. Gegenseitige
Annahme, bestehende Chats, persönliche Lesestände und Beitrittsgrenzen erhalten.
Private Entwürfe und Wiederholungsschlüssel dem richtigen Konto/Empfänger zuordnen.
Blockierungen, Nachrichtenprivatsphäre und 50er-Gruppengrenze serverseitig prüfen.
Keine automatischen Administratorvergaben. Alle neuen Texte in neun Sprachen;
Touch, Tastatur, sichere Bildschirmränder und echte Zurücknavigation prüfen.

Vorprüfung belegt: Gruppeneinladungen umgingen Blockierung/friends_only, eine
50er-Gruppe konnte auf 51 wachsen. Wiederholtes Annehmen benachrichtigte erneut;
zwei Profilansichten verwendeten ein veraltetes API-Antwortformat.

Die nachfolgenden Nachweise verwenden ausschließlich eigene Beispieldaten.
Es wurden keine echten Nachrichten, Kontaktanfragen oder Gruppen als Test erzeugt.

## Kontakte: Änderungen und belegte Prüfung

Ein gemeinsamer Kontaktknopf ersetzt die doppelten Profilimplementierungen und
verwendet den tatsächlichen `{friendship}`-Vertrag. Er zeigt „Kontakt hinzufügen“,
„Anfrage gesendet“, „Annehmen“/„Ablehnen“ und „In deinen Kontakten“, mit sichtbarer
Fehleranzeige und Wiederholung. Gesendete Anfragen können zurückgezogen werden.
Profilvarianten, Kontakteinstellungen, Dashboard, Benachrichtigungen und
Kontakt-E-Mails verwenden die Begriffe in allen neun Katalogen. Persönliche
Namen und selbst geschriebene Zusammenarbeitsbezeichnungen bleiben unverändert.
Die bisherigen strukturierten Benachrichtigungsvorlagen bleiben als unveränderliche
Speicher-/Altdatenformate erhalten; die Anzeige nutzt die aktuellen Leserkataloge.

`20261112210000_atomic_contacts.sql` ergänzt die serverseitige,
transaktionale Kontaktverwaltung. Eine gemeinsame Sperre für das Personenpaar
serialisiert wiederholte und gegenläufige Anfragen. Eine Gegenanfrage nimmt
keine Anfrage automatisch an. Nur der tatsächliche Empfänger darf annehmen;
beide Parteien dürfen ihre Verbindung entfernen und nur die jeweils eigene
Zusammenarbeitsbezeichnung bearbeiten. Blockierungen werden in beiden Richtungen
geprüft. Die Migration ändert oder löscht keine vorhandene Verbindung.
Vorhandene Dubletten werden in Listen zusammengefasst; erst eine ausdrücklich
beauftragte Entfernung entfernt alle Verbindungszeilen dieses Personenpaars,
damit keine versteckte Altzeile den privaten Profilzugriff erhält.

Kontaktstatus und zugehörige Benachrichtigung werden gemeinsam gespeichert.
Bereits angenommene oder ausstehende Anfragen liefern bei Wiederholung den
aktuellen Zustand zurück und erzeugen keine zweite Benachrichtigung oder
zweite optionale E-Mail. Fehlgeschlagene Datenbankantworten werden nicht als
leere Kontaktliste oder erfolgreiche Annahme behandelt. Neue Anfragen und
Änderungen sind pro Konto begrenzt. Das Kontaktverzeichnis berücksichtigt
Blockierungen und aktuelle private Profilgrenzen vor der Namens-/Fotoausgabe.

Dashboard und Benachrichtigungsseite behalten bei Fehlern die bestätigten Daten
und bieten eine Wiederholung. Verspätete Antworten überschreiben weder ein
anderes Konto noch eine neuere Kontaktliste. Der Creator-Nachrichtenweg verwendet
nun konto-, empfänger-, profil- und textgebundene Wiederholungsschlüssel nach
dem neuen Messaging-Vertrag; erst eine bestätigte Nachricht leert den Text.
Blockieren/Entblockieren sendet einen ausdrücklichen Sollzustand statt eines
Toggles. Wiederholung nach verlorener Antwort kann dadurch eine Blockierung
nicht versehentlich zurücknehmen. Doppeltippen und verspätete Kontoantworten
sind gesondert geprüft; Fehler bleiben nach Schließen des Menüs sichtbar.

Lokale Verhaltenstests führen die tatsächlichen Komponenten-/API-Rückrufe mit
kontrollierten Antworten aus. Der kombinierte Lauf aus Kontaktknopf,
Kontakt-API, PGlite-Kontaktmigration, Creator-Nachrichtenweg, Dashboardkontakten,
Blockierknopf, E-Mail-Lokalisierung und strukturierten Benachrichtigungen bestand
191 Tests ohne Fehler. Die sechs PGlite-Fälle prüfen gegenseitige Annahme,
Wiederholungen beider Richtungen, Blockierungen, fremde Konten,
Zusammenarbeitsrechte, Rücknahme bei Benachrichtigungsfehlern, bestehende Dubletten,
Service-Rollenrechte und erneutes Anwenden ohne Verlust vorhandener Zeilen oder
Bezeichnungen. `anon` und `authenticated` dürfen weder die Funktion ausführen
noch direkt auf die Verbindungstabelle zugreifen; `service_role` darf die
zugelassene Funktion verwenden. Berührungsziele der neuen Kontaktaktionen und
des geänderten Profilmenüs sind mindestens 44 CSS px hoch; die neun
Kontaktknopf-Sprachvarianten werden tatsächlich gerendert.

ESLint besteht für Kontakt-API/-Hilfsdateien, Kontaktknopf, beide Profilvarianten,
Creator-Detailansicht und Benachrichtigungsseite. Der Dashboardkontaktabschnitt
fügt keine neuen Lintmeldungen hinzu; außerhalb dieses Abschnitts bestehen
bereits vorhandene Dashboardmeldungen. Katalogprüfung und Diff-Whitespace-Prüfung
bestehen. Ein TypeScript-Lauf mit der unveränderten Node-Speichergrenze brach
wegen Speichererschöpfung ab; der abschließende Gesamtcheck benötigt mehr Heap.

Diese Nachweise sind lokale Simulationen mit Beispieldaten. PGlite verwendet
eine Verbindung und ersetzt keine Prüfung echter konkurrierender
PostgreSQL-Sitzungen. Es wurden keine echten Kontaktanfragen, Nachrichten,
Blockierungen, Konten, E-Mails oder Gruppen als Test verändert. Echte
E-Mail-Zustellung sowie reale Smartphone-/WebView-Nutzung sind damit nicht
belegt. Migration, Release und abschließende Integrationsabnahme sind separat
zu dokumentieren.

## Bewerbung als getrennter Nachrichtenkanal

Der bereits gespeicherte Bewerbungseintrag bleibt die maßgebliche Bestätigung.
Der optionale Nachrichtenweg verwendet nun ausschließlich die atomare Funktion
`start_direct_conversation`; manuelle Gesprächs-/Mitgliedseinträge und der alte
Drei-Parameter-Sendeaufruf entfallen. Der Wiederholungsschlüssel wird aus der
bestätigten Bewerbungs-ID und dem ursprünglichen Nachrichteninhalt abgeleitet.
Gleiche Wiederholungen erzeugen dadurch keine weitere Chatnachricht. Aktuelle
Blockierungen und Nachrichtenfreigaben gelten auch hier; verweigert oder scheitert
nur dieser Nebenkanal, bleibt die erfolgreiche Bewerbung erfolgreich. Seine
Datenabfrage und sein Aufruf teilen eine Grenze von acht Sekunden. Vier gezielte
Verhaltenstests bestehen: autorisierte Datenzuordnung und unveränderter Inhalt,
stabile Schlüssel/Deduplizierung, fehlende Chatfreigabe/Transportausfälle sowie
fehlgeschlagene Bewerbungsspeicherung ohne Chatversuch. Keine echte Bewerbung
oder Nachricht wurde für diese Prüfung erzeugt.

## Gemeinsame Abschlussprüfung

Das Postfach bietet Suche und einen gemeinsamen Einstieg „Neue Nachricht“.
Eine ausgewählte Person öffnet den bestehenden Einzelchat oder ein noch
ungesendetes Gespräch; mehrere Personen erstellen eine Gruppe mit optionalem
Namen. Gruppeninfos und ausdrückliche Administratorübergabe sind vom Chatkopf
zugänglich. Nachrichtenaktionen erscheinen erst nach Betätigung der eigenen
Nachricht. Der Nachrichteninhalt und die Uhrzeit bleiben dabei im zugänglichen
Namen erhalten; der Aktionshinweis überschreibt den Inhalt nicht.

Nachrichtenfeld und Dashboard teilen dieselbe wiederherstellbare Komponente.
Die Bestätigung prüft Nachrichten-ID, Absender, exakten Inhalt und Zeitstempel,
bevor ein Entwurf beendet wird. Konto- und Empfängerwechsel trennen laufende
Vorgänge. Vorhandene private Kontakte bleiben auch bei Suchtext verfügbar;
öffentliche Suche erschließt kein E-Mail- oder Clerk-Kontoverzeichnis. Die
Gruppenverwaltung berücksichtigt verbleibende Plätze und schützt Eingaben vor
Verlassen oder Wechseln. Reine Sprachwechsel laden Kontakte nicht unnötig neu.

Der vollständige lokale Regressionslauf bestand **2.946 Tests ohne Fehler**.
Vorher aufgedeckte Testaufbauten wurden an die tatsächlichen Import-/API-Verträge
angepasst, ohne die bisherigen Assertions zu entfernen. Der Sprachwechseltest
fand außerdem einen tatsächlichen Kontakt-Refreshfehler, der durch zusätzliche
Verhaltenstests behoben wurde. Der integrierte TypeScript-Lauf mit vergrößertem
Heap bestand; gezieltes ESLint für die geänderten Nachrichten-/Kontaktflächen
bestand. Die vorhandene allgemeine Lintlast außerhalb dieses Auftrags wird damit
nicht als beseitigt dargestellt. Neun Sprachkataloge, gemeinsame Designregeln
und Änderungsformatprüfung bestanden.

Safari stellte die tatsächlichen Komponenten mit erfundenen API-Daten in
320- und 390-CSS-px-Rahmen dar. Personenwahl, lange Namen, Gruppenerstellung,
Gruppeninfos, Escape und reale Rückkehr ins Postfach funktionierten. Ein
absichtlich verlorener Sendebeleg ließ Text und Schlüssel erhalten; der erneute
Versuch bestätigte genau eine Nachricht und leerte erst danach das Feld. Die
zusätzliche AX-Prüfung fand und korrigierte den oben beschriebenen
Nachrichten-Namensfehler. Dies ist eine Browserprüfung, kein realer
Smartphone-, Screenreader- oder nativer WebView-Nachweis. Softwaretastatur und
Safe-Area-Verhalten sind zusätzlich durch lokale Viewport-/Komponententests
abgesichert, aber noch auf echten Geräten zu prüfen.

Die roten Fehler-/Ausblendaktionen nutzen in den neuen Nachrichtenflächen
lesbare Statusfarben für dunkles und helles Thema. Die dunkle Textfarbe des
Ausblendknopfs war im visuellen Vergleich zu schwach; die verwendete helle
Rotvariante erreicht auf der geprüften dunklen Fläche rund 6,9:1 Kontrast.

## Produktive Datenbank vor dem Frontend-Release

Beide Migrationen wurden erfolgreich angewendet und anschließend ausschließlich
lesend geprüft. Die Kontaktmigration hat SHA-256
`9a99db8f83273d65bf7b884e1cc7a22b7756cb7cf4dd8ad8736fadbcee029327`,
die Nachrichtenmigration
`d610610d7f4b440acecc508c19e6a317c00f02e4081feac8dc6e2c1a8ea4a579`.
Die bekannte Entwurfsschlüsselgrenze wurde kontrolliert von 100 auf 180 Zeichen
erweitert; die Datenprüfung für private Entwürfe blieb erhalten. Alle 13
zugehörigen Funktionssignaturen sind für `anon` und `authenticated` gesperrt;
die vorgesehenen öffentlichen Serverfunktionen sind für `service_role`
ausführbar. Interne Hilfsfunktionen bleiben intern. Die vier geprüften Tabellen
haben RLS und keinen direkten Clientzugriff. Das neue Sendeprotokoll enthielt
unmittelbar danach null Einträge.

Vorher und nachher identisch: 174 Profile, 277 Kontaktzeilen, 1 Blockierung,
192 Gespräche, 379 Nachrichten, 386 Mitgliedschaften, 239 Lesebelege und
153 private Entwürfe. Es gab keine Datenbereinigung, Zusammenführung alter
Chats oder automatische Administratorvergabe. Erneutes Anwenden, Rechte und
Altdatenbewahrung sind in PGlite getestet. Der Rückbau wurde nicht produktiv
probeweise ausgeführt. Veröffentlichung erfolgt anschließend über den
vorgeschriebenen sauberen GitHub-Desktop-/Produktionspfad.
