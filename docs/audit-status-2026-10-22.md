# CineGenius Funktionsaudit – Stand 22.10.2026

## Ergebnis in Kürze

Der öffentliche, schreibgeschützte Rundgang wurde durchgeführt. Dabei wurden Verzeichnisse, ausgewählte Detailseiten, Suche, Catering-Filter, geschützte Einstiege und die zuvor gemeldete Browser-Icon-Adresse geprüft. Die Icon-Adresse hatte einen reproduzierbaren Laufzeitfehler; die Weiterleitung auf vorhandene Icon-Dateien wurde veröffentlicht und live geprüft.

Das vollständige Nutzer-Audit ist **noch nicht abgeschlossen**. Eine angemeldete Safari-Sitzung des Kontoinhabers wurde verwendet. Im späteren Nachtrag wurde ein isolierter Marktplatz-Testupload erfolgreich geprüft und die unverknüpfte Testdatei anschließend mit Bestätigung gelöscht; es wurde kein Inserat gespeichert. Vorhandene eigene Inserate, Profile, Favoriten und Nachrichten wurden ansonsten nur angesehen. Profilerstellung, Bearbeitung, Gruppen, Bewertungen und Kontaktabläufe bleiben offen; für Nachrichtentests fehlt ein kontrolliertes Gegenkonto. Es wurden keine fremden Inhalte verändert und keine Testnachrichten versendet.

## Prüfumfang und Befunde

| Bereich | Status | Tatsächlich geprüft / Befund |
|---|---|---|
| Öffentliche Startseite | **Geprüft** | Startseite im abgemeldeten Zustand geladen; öffentliche Foto- und Inhaltsbereiche gerendert. Schreibende Likes wurden nicht ausgelöst. |
| Locations | **Teilweise geprüft** | Verzeichnis und eine Detailseite geöffnet. Ein öffentliches Ergebnis sichtbar („Schule Speziallocation“, Eggenfelden). Erstellen, Bearbeiten, Upload, Kontakt und Löschen nicht geprüft. |
| Marktplatz / Requisiten | **Teilweise geprüft** | Drei öffentliche Angebote im Requisitenbereich sichtbar; Suche, Kategorie-Filter und Detail-Lightbox geprüft. Ein sicherer Uploadversuch mit dem angemeldeten eigenen Konto wurde im Nachtrag erfolgreich abgeschlossen; es wurde kein Angebot gespeichert oder veröffentlicht. Der genaue Fehler des Kollegen bleibt mangels seines Kontos beziehungsweise seiner konkreten Datei offen. |
| Fahrzeuge / Tiere / Social Media | **Teilweise geprüft** | Fahrzeuge zeigt ein Ergebnis; Tiere und Social Media zeigen verständliche Leerzustände. Keine Änderungen angelegt. |
| Crew | **Teilweise geprüft** | `/creators` geöffnet; 41 öffentliche Profile und Filter einschließlich Catering sowie Kamerabühne/Grip sichtbar. Profile wurden nicht bearbeitet oder kontaktiert. |
| Jobs | **Teilweise geprüft** | Verzeichnis, Catering-Filter und Leerzustand geprüft; aktuell 0 öffentliche Jobs. Erstellen/Bewerben nicht ausgeführt. |
| Firmen | **Teilweise geprüft** | Verzeichnis und Catering-Filter geprüft; ein öffentliches Unternehmen (Cinegenius), aber 0 Catering-Treffer. Die Firma „Selektion Catering“ aus dem Nutzerfoto ist in diesem öffentlichen Ergebnis nicht vorhanden. Ohne Zugriff auf das Konto des Kollegen lässt sich nicht feststellen, ob sein Speichern fehlgeschlagen ist, ein Entwurf vorliegt oder ein anderer Status greift. Bestehende private Datensätze wurden nicht veröffentlicht. |
| Projekte | **Teilweise geprüft** | `/projects/alle` mit 17 öffentlichen Projekten geöffnet; keine Erstellungs- oder Bearbeitungsaktion. |
| Globale Suche | **Teilweise geprüft** | Suche nach „APC MINI“ lieferte nach dem Laden das passende Angebot. Der erste frühe Zwischenstand zeigte noch den Lade-/Leerzustand; nach etwa 3 Sekunden erschien das Ergebnis. Keine systematische Zeitmessung oder vollständige Filtermatrix. |
| Geschützte Seiten / Abmeldung | **Teilweise geprüft** | Eine vorhandene angemeldete Safari-Sitzung öffnete `/dashboard` und zeigte das Kontomenü. In einem separaten abgemeldeten Browserkontext leiteten `/community`, `/messages`, `/dashboard` und `/profile-setup` auf derselben Domain zu `/sign-in` weiter und bewahrten das Rücksprungziel. Logout und erneuter Login wurden nicht ausgeführt. |
| Anmeldung und Registrierung | **Teilweise geprüft; Ende-zu-Ende offen** | Mit der vorhandenen Safari-Sitzung wurde `/dashboard` direkt geöffnet. Das Dashboard zeigte zunächst asynchrone Platzhalter (leerer Gruß, 0 %); beim nächsten geprüften Zustand waren Name, 70 % Profilstärke, eigene Inserate und ein konsistenter „Alle gelesen“-Hinweis geladen. Ladezeit wurde nicht exakt gemessen. Eine neue Anmeldung, Registrierung, Bestätigungscode, Logout oder erneuter Login wurden nicht getestet; deshalb ist der frühere abgemeldete IAB-Zustand kein Nachweis eines Loginfehlers im Safari-Konto. |
| Profile / Firmenprofile | **Teilweise geprüft** | Das eigene Dashboard und bestehende Inserate/Firmenprofil wurden angezeigt. Keine Bearbeitung oder Speicherung vorgenommen. Profilanlage, Mehrfachrollen, Felder, öffentliche Darstellung nach Speichern und Persistenz bleiben offen. |
| Fotos und Datei-Uploads | **Teilweise geprüft** | Der Nachtrag dokumentiert einen erfolgreichen Testupload und eine sichtbare Vorschau im Marktplatz-Formular. Kein Inserat wurde gespeichert. Das danach unverbundene Testobjekt wurde nach ausdrücklicher Bestätigung gelöscht; die älteren Dateien im Kontoordner blieben erhalten. Andere Uploadarten sowie der Fehler des Kollegen bleiben offen. |
| Nachrichten, Gruppen und Lesestatus | **Teilweise geprüft** | Das Dashboard lud Nachrichtenübersicht und zeigte danach „Alle gelesen“. Keine Unterhaltung geöffnet, Nachricht gesendet oder Zähler nach Ab-/Anmeldung beziehungsweise mit Gegenkonto verglichen. Gruppen und dauerhafter Lesestatus bleiben offen. |
| Likes, Sterne, Favoriten und Bewertungen | **Nicht geprüft** | Schreibaktionen im abgemeldeten Zustand nicht ausgeführt; keine Zähler oder Persistenz über Kontowechsel geprüft. |
| Kontakt, Buchung, Bewerbung, Zahlung | **Nicht geprüft** | Wegen möglicher Außenwirkung oder fehlender Testempfänger nicht ausgelöst. |
| Responsive Darstellung | **Teilweise geprüft** | Nur Desktop-Browseransicht tatsächlich angesehen. Keine echten iPhone-/iPad-/Android-Geräte und in dieser Runde keine Viewport-Emulation; Hoch-/Querformat und Tastaturverhalten bleiben offen. |
| Browser-Icons | **Behoben und live erneut geprüft** | Vorher lieferten `/favicon.ico` und `/apple-touch-icon.png` einen generischen Vercel-Serverfehler. Vercel-Logs zeigten, dass diese nicht vorhandenen Dateipfade die Root-Layout-Authentifizierung außerhalb der Clerk-Middleware auslösten. Nach dem Release endeten die Routen live auf `/icon.svg` beziehungsweise `/apple-icon.png`; beide Antworten zeigten das Bild statt eines Laufzeitfehlers. |
| Veralteter Angebotslink | **Fehlerbild eingeordnet** | Ein direkter, nicht mehr vorhandener Requisiten-Datensatz lieferte DB-Fehler PGRST116 (keine Zeile); die Anwendung zeigte dafür den vorgesehenen „nicht gefunden“-Zustand statt einer Datenoffenlegung. Keine Änderung vorgenommen. |

## Veröffentlichtes Update

Für die zwei fehlerhaften Icon-Pfade wurden temporäre Weiterleitungen auf vorhandene Dateien ergänzt:

- `/favicon.ico` → `/icon.svg`
- `/apple-touch-icon.png` → `/apple-icon.png`

Ein gezielter Regressionstest prüft beide Zuordnungen. Version `c604da57ea53c1b6d650bd96035fcf8fbc399052` wurde über `npm run deploy:production` veröffentlicht. Vercel meldet Deployment `2VfTZUX1FUDrWNuCG73s9xDCHrs8` als `READY` mit der Domain `www.cinegenius.co`. Anschließend wurden `/favicon.ico` und `/apple-touch-icon.png` im Browser live geöffnet und auf die vorhandenen Icons weitergeleitet.

## Prüfungen im Projekt

- `npm test`: **450 bestanden, 0 fehlgeschlagen** (einschließlich Icon-Weiterleitungstest).
- `npm run lint`: **bestanden**.
- `npm run check:design`: **bestanden**.
- `git diff --check`: **bestanden**.
- `npm run build`: **bestanden**. Next.js/webpack kompilierte, TypeScript-Prüfung und Generierung aller 116 statischen Seiten liefen erfolgreich.

## Noch erforderliche Nachweise

Für den Abschluss des vollständigen Funktionsaudits werden ein kontrolliertes zweites Konto für Nachrichten und ein klar abgegrenzter Testinhalt benötigt; das vorhandene Konto enthält bereits echte Inserate, die unangetastet bleiben. Offen sind: Registrierung und frischer Login samt Einrichtung, Reproduktion des Kollegen-Uploads mit seiner konkreten Datei oder kontrolliertem Konto, Erstellen/Bearbeiten/Veröffentlichen/Löschen eines eigenen Testangebots, Nachrichten und Gruppen zwischen Testkonten, Lesestatus nach Ab-/Anmeldung, Likes/Bewertungen sowie Kontakt- und Buchungsabläufe im sicheren Testmodus. Echte oder simulierte mobile Geräteprüfungen stehen ebenfalls aus.

Die Icon-Korrektur ist veröffentlicht. Das vollständige Funktionsaudit bleibt offen, weil Schreibabläufe mit einem separaten Testinhalt und Nachrichten mit einem kontrollierten Gegenkonto noch nicht praktisch ausgeführt wurden.

## Nachtrag: angemeldeter Live-Funktionstest in Safari, 22.10.2026

Dieser Nachtrag ergänzt und, wo ausdrücklich angegeben, aktualisiert die vorherigen Beobachtungen. Getestet wurde die Produktionswebsite `https://www.cinegenius.co` in Safari mit dem angemeldeten Konto des Kontoinhabers. Bestehende Profile, Favoriten, Inserate und Nachrichten wurden nicht verändert.

| Ablauf | Ergebnis | Beobachtung |
|---|---|---|
| Marktplatz-Verzeichnis | **Bestanden für Suche/Filter/Detail** | 3 öffentliche Angebote. Der Filter „Licht“ reduzierte die Liste auf 2; die Suche „Aputure“ zusammen mit dem Filter lieferte 1; „Alle Filter löschen“ stellte 3 wieder her. Ein Detail öffnete die vollständige Bildansicht; Escape schloss sie. |
| Marktplatz-Bildupload | **Upload bestanden; Inseratserstellung nicht abgeschlossen** | Im eigenen, angemeldeten Ablauf wurde ein neutrales Testbild hochgeladen, verarbeitet und als Vorschau angezeigt. Pflichtfelder blieben absichtlich leer; daher wurde nichts gespeichert oder veröffentlicht. Das nicht verknüpfte Testobjekt wurde nach Bestätigung des Kontoinhabers gelöscht; die 3 älteren Dateien im Ordner blieben bestehen. Das meldende Kollegenproblem wurde damit nicht reproduziert. |
| Crew-Verzeichnis | **Teilweise bestanden** | 43 öffentliche Profile, zunächst 24 und danach Option auf weitere 19. Suche und Catering-Filter lieferten 0 Treffer; nach Zurücksetzen/Neuladen wurde wieder die vollständige Liste angezeigt. Das ist ein beobachteter Leerzustand, kein Nachweis eines Filterfehlers. |
| Firmenverzeichnis | **Offener Befund** | Öffentlich sichtbar war 1 Firma („Cinegenius“). Catering-Filter und Suche nach „Selektion Catering“ lieferten jeweils 0 Firmen. Die Firma aus dem Screenshot des Kollegen ist damit nicht öffentlich auffindbar; ohne Zugriff auf sein Konto lässt sich nicht unterscheiden, ob Speichern, Sichtbarkeit oder Veröffentlichung der Grund ist. Es wurde nichts veröffentlicht oder bearbeitet. |
| Locations | **Teilweise bestanden** | 1 öffentliches Ergebnis („Schule“, Eggenfelden); Detailseite, Bewertungsanzeige, Kalender und Anfrageformular gerendert. Eigener Favoritenzustand war sichtbar. Keine Anfrage gesendet und kein Favorit geändert. |
| Jobs | **Teilweise geprüft** | Verzeichnis zeigte 0 öffentliche Jobs; Catering ist als Kategorie vorhanden. Es wurde kein Testjob erstellt. |
| Projekte | **Teilweise bestanden** | 17 öffentliche Projekte; Suche „ZOMA“ lieferte 1 Treffer. Projekt-Detail und verknüpftes Crewprofil ließen sich öffnen. |
| Foto-Detail und Homepage-Fotoband | **Teilweise bestanden** | Einzelne Fotodetailseite zeigte das passende Foto, separaten Profil-Link und vorhandenen Like-Zustand. Das automatische Fotoband zeigte vier sichtbare Slides; Likes wurden nicht verändert. |
| Merkliste | **Teilweise bestanden** | Die persönliche Merkliste zeigte 1 gespeicherten Location-Eintrag mit korrektem Detail-Link. Der Eintrag wurde nicht entfernt. |
| Sitzung und Anmeldeeinstieg | **Bestanden für bestehenden Login-Zustand** | `/sign-in` leitete bei gültiger Sitzung auf `/` weiter. Nach Neuladen des Dashboards blieben Name, Profilstärke, Inserate und Firmenprofil sichtbar. Abmelden und erneute Anmeldung wurden nicht ausgeführt. |
| Dashboard / Nachrichten | **Teilweise geprüft** | Dashboard zeigte 2 aktive eigene Marktplatz-Inserate, 0 ungelesene Nachrichten und die vorhandenen Nachrichtenüberschriften. Nachrichten wurden nicht geöffnet oder versendet; Lesestatus nach Kontowechsel bleibt offen. |

### Noch offen nach diesem Nachtrag

- Das genaue Uploadproblem des Kollegen ist nicht reproduziert. Dafür werden seine konkrete Fehlermeldung und die betroffene Datei beziehungsweise ein kontrolliertes Testkonto benötigt.
- „Selektion Catering“ ist im öffentlichen Firmenverzeichnis nicht auffindbar. Der Datensatzstatus im Konto des Kollegen wurde nicht geprüft; private Datensätze wurden nicht veröffentlicht.
- Inserate, Firmenprofile und Crewprofile wurden in diesem Nachtrag nicht neu angelegt, bearbeitet oder veröffentlicht. Kontakt-, Buchungs-, Bewerbungs-, Zahlungs- und Nachrichtensendeabläufe blieben aus Sicherheitsgründen unangetastet.
- Es gab keine echte iPhone-/iPad-Prüfung und keine vollständige Geräte- oder Browsermatrix. Der Safari-Lauf war auf dem Desktop.
- Das vollständige Funktionsaudit ist weiterhin **nicht abgeschlossen**. Der erfolgreiche Einzel-Upload belegt nur, dass der getestete Dateityp und Ablauf in diesem Konto funktioniert.
