# Nachrichten: eigenes Löschen und Kontakte

Stand: 25.10.2026. Lokal geprüft; Datenbank für die angeforderte Veröffentlichung vorbereitet. Der tatsächliche Deploymentstatus wird nach dem Release gesondert kontrolliert.

## Änderungen

- Die vorhandene Freundschaftsschnittstelle liefert bereits bestätigte Kontakte. Die Nachrichtenansicht verwendet diese jetzt unter „Kontakte“, mit Suche nach Namen/Tätigkeit, Bild beziehungsweise Platzhalter und Fehler-/Ladezustand. Private Kontaktangaben werden nicht ergänzt.
- Ein Kontakt öffnet einen passenden direkten Chat. Gruppen und Supportgespräche werden nicht versehentlich ausgewählt; allgemeine Chats haben Vorrang vor Inseratsgesprächen. Eine serverseitige Suche findet auch ältere Chats außerhalb der ersten 50 Listeneinträge. Ohne vorhandenen Chat öffnet sich der neue Nachrichtenentwurf; der Klick allein versendet nichts.
- Nur eigene Nachrichten erhalten „Für mich löschen“. Die Bestätigung erklärt ausdrücklich, dass andere Teilnehmer den Text behalten. Die Datenbank speichert einen persönlichen Ausblendungszeitpunkt am Originaldatensatz. Es gibt keine endgültige Löschung und keine Löschung fremder Nachrichten.
- Die serverseitige Aktion prüft die aktive Mitgliedschaft, Absender, Gespräch und bisherigen Verlauf; direkte Aufrufe der Datenbankfunktion durch Browserrollen sind gesperrt. Wiederholungen sind idempotent. Erfolg wird erst nach bestätigter Speicherung angezeigt; Fehler lassen die Nachricht stehen.
- Chatverlauf und Listenvorschau filtern ausgeblendete eigene Nachrichten vor der Seitenbegrenzung. Lokale Ausblendungen und die Reihenfolge laufender Anfragen verhindern, dass verspätete Antworten gelöschte Nachrichten zurückholen oder gerade gesendete Nachrichten entfernen.
- Desktop: Kontakte/Unterhaltungen neben dem Chat. Handy: eigene Listen- und Chatansicht mit Rückweg; neue Aktionen haben mindestens 44 × 44 CSS-px. Das bestehende Erscheinungsbild bleibt erhalten.

## Tatsächlich ausgeführte Prüfungen

**22 gezielte Tests bestanden, 0 fehlgeschlagen.**

- Echte PostgreSQL-Engine mit isolierten synthetischen Daten (PGlite), Ausführung der tatsächlichen Migration: eigenes Ausblenden, wiederholte Aktion, erhaltener Originaltext, unveränderte Empfängeransicht; Abweisung bei fremder Nachricht, falschem Gespräch, fehlender/beendeter Mitgliedschaft und Nachricht vor aktuellem Beitritt; verweigerte RPC-Aufrufe für `anon` und `authenticated`.
- Ausführung der tatsächlichen Route-Handler mit simuliertem Authentifizierungsdienst und aufgezeichnetem Supabase-Transport: Anmeldung, ID-Prüfung, Ratenbegrenzung, verifizierter Akteur statt manipulierbarer Absenderangabe, bestätigte ID, Fehlerantworten, privater Cache; exakte Kontaktsuche und aktive Mitgliedschaft; kombinierte Filter einschließlich älterer Nachrichten und Listenvorschau.
- Kontakte in beiden Absenderrichtungen, Vorrang allgemeiner Chats, Ausschluss von Gruppen/Support/fremden Gesprächen; kein Wiederauftauchen lokal ausgeblendeter Nachrichten; Erhalt älterer geladener Nachrichten.
- Bestehende gezielte Regressionen für Gruppenberechtigungen, Beitrittsgrenzen, Lesebestätigungen und Ungelesen-Zähler.
- ESLint für die geänderten TypeScript-/Testdateien, TypeScript-Prüfung und Prüfung auf fehlerhafte Diff-Formatierung bestanden.

**Lokale Browserprüfung mit synthetischen Kontakten und simulierter Schnittstelle:** tatsächliche Nachrichtenkomponente und Website-Stile bei 390 × 844 sowie 1280 × 800 CSS-px. Kontakte anzeigen und nach Tätigkeit suchen, bestehenden Chat öffnen, neuen Entwurf öffnen und zurückkehren; Bestätigungsabfrage sichtbar, Abbruch erhält Nachricht, bestätigter Aufruf entfernt nur eigene Nachricht mit Erfolgshinweis. Lange Namen und ungetrennte Nachrichtentexte verursachen keinen Seitenüberlauf (Seitenbreite jeweils gleich Viewportbreite). Löschschaltfläche 44 × 44 CSS-px. Keine Konsolenfehler. Screenshots liegen im Aufgabenordner `outputs/messages-contacts-mobile.png`, `outputs/messages-chat-mobile.png` und `outputs/messages-desktop.png`.

## Noch offen vor Veröffentlichung

- Migration `20261025110000_hide_own_messages.sql` ist in der produktiven Supabase-Datenbank angewendet. Spalte vorhanden; Ausführung als `service_role` erlaubt, als `anon` und `authenticated` verweigert. PostgREST-Schemaaktualisierung angefordert. Anschließend über den vorgesehenen Releaseweg veröffentlichen.
- Echter Ablauf mit zwei kontrollierten Konten gegen Clerk/Supabase einschließlich erneutem Login sowie reale iOS-/Android-Geräte wurden in dieser Änderung nicht geprüft. Die lokalen Browserprüfungen sind Simulationen und keine Produktionsnachweise.
- Keine Nachrichten echter Mitglieder versendet, gelöscht oder verändert. Kein vollständiger Projekt-Testlauf oder Produktionsbuild ausgeführt; geprüft wurde gezielt der betroffene Bereich.
