# CineGenius Funktionsaudit – Stand 22.10.2026

## Ergebnis in Kürze

Der öffentliche, schreibgeschützte Rundgang wurde durchgeführt. Dabei wurden Verzeichnisse, ausgewählte Detailseiten, Suche, Catering-Filter, geschützte Einstiege und die zuvor gemeldete Browser-Icon-Adresse geprüft. Die Icon-Adresse hatte einen reproduzierbaren Laufzeitfehler; die Weiterleitung auf vorhandene Icon-Dateien wurde veröffentlicht und live geprüft.

Das vollständige Nutzer-Audit ist **noch nicht abgeschlossen**. Eine angemeldete Safari-Sitzung des Kontoinhabers wurde verwendet und das Dashboard erfolgreich geöffnet. Vorhandene eigene Inserate und das Firmenprofil wurden nur angesehen und nicht verändert. Profilerstellung, Uploads, Speichern, Gruppen, Favoriten, Bewertungen und Kontaktabläufe wurden nicht ausgeführt; für Nachrichten fehlt ein kontrolliertes Gegenkonto. Es wurden keine fremden Inhalte verändert und keine Testnachrichten versendet.

## Prüfumfang und Befunde

| Bereich | Status | Tatsächlich geprüft / Befund |
|---|---|---|
| Öffentliche Startseite | **Geprüft** | Startseite im abgemeldeten Zustand geladen; öffentliche Foto- und Inhaltsbereiche gerendert. Schreibende Likes wurden nicht ausgelöst. |
| Locations | **Teilweise geprüft** | Verzeichnis und eine Detailseite geöffnet. Ein öffentliches Ergebnis sichtbar („Schule Speziallocation“, Eggenfelden). Erstellen, Bearbeiten, Upload, Kontakt und Löschen nicht geprüft. |
| Marktplatz / Requisiten | **Teilweise geprüft** | Drei öffentliche Angebote im Requisitenbereich sichtbar (APC MINI, Aputure Sidus One und ein Fahrzeug); ein Detail geöffnet. Der gemeldete Foto-Upload beim Erstellen eines Angebots wurde nicht mit einer angemeldeten Testperson reproduziert. |
| Fahrzeuge / Tiere / Social Media | **Teilweise geprüft** | Fahrzeuge zeigt ein Ergebnis; Tiere und Social Media zeigen verständliche Leerzustände. Keine Änderungen angelegt. |
| Crew | **Teilweise geprüft** | `/creators` geöffnet; 41 öffentliche Profile und Filter einschließlich Catering sowie Kamerabühne/Grip sichtbar. Profile wurden nicht bearbeitet oder kontaktiert. |
| Jobs | **Teilweise geprüft** | Verzeichnis, Catering-Filter und Leerzustand geprüft; aktuell 0 öffentliche Jobs. Erstellen/Bewerben nicht ausgeführt. |
| Firmen | **Teilweise geprüft** | Verzeichnis und Catering-Filter geprüft; ein öffentliches Unternehmen (Cinegenius), aber 0 Catering-Treffer. Die Firma „Selektion Catering“ aus dem Nutzerfoto ist in diesem öffentlichen Ergebnis nicht vorhanden. Ohne Zugriff auf das Konto des Kollegen lässt sich nicht feststellen, ob sein Speichern fehlgeschlagen ist, ein Entwurf vorliegt oder ein anderer Status greift. Bestehende private Datensätze wurden nicht veröffentlicht. |
| Projekte | **Teilweise geprüft** | `/projects/alle` mit 17 öffentlichen Projekten geöffnet; keine Erstellungs- oder Bearbeitungsaktion. |
| Globale Suche | **Teilweise geprüft** | Suche nach „APC MINI“ lieferte nach dem Laden das passende Angebot. Der erste frühe Zwischenstand zeigte noch den Lade-/Leerzustand; nach etwa 3 Sekunden erschien das Ergebnis. Keine systematische Zeitmessung oder vollständige Filtermatrix. |
| Geschützte Seiten / Abmeldung | **Teilweise geprüft** | Eine vorhandene angemeldete Safari-Sitzung öffnete `/dashboard` und zeigte das Kontomenü. In einem separaten abgemeldeten Browserkontext leiteten `/community`, `/messages`, `/dashboard` und `/profile-setup` auf derselben Domain zu `/sign-in` weiter und bewahrten das Rücksprungziel. Logout und erneuter Login wurden nicht ausgeführt. |
| Anmeldung und Registrierung | **Teilweise geprüft; Ende-zu-Ende offen** | Mit der vorhandenen Safari-Sitzung wurde `/dashboard` direkt geöffnet. Das Dashboard zeigte zunächst asynchrone Platzhalter (leerer Gruß, 0 %); beim nächsten geprüften Zustand waren Name, 70 % Profilstärke, eigene Inserate und ein konsistenter „Alle gelesen“-Hinweis geladen. Ladezeit wurde nicht exakt gemessen. Eine neue Anmeldung, Registrierung, Bestätigungscode, Logout oder erneuter Login wurden nicht getestet; deshalb ist der frühere abgemeldete IAB-Zustand kein Nachweis eines Loginfehlers im Safari-Konto. |
| Profile / Firmenprofile | **Teilweise geprüft** | Das eigene Dashboard und bestehende Inserate/Firmenprofil wurden angezeigt. Keine Bearbeitung oder Speicherung vorgenommen. Profilanlage, Mehrfachrollen, Felder, öffentliche Darstellung nach Speichern und Persistenz bleiben offen. |
| Fotos und Datei-Uploads | **Nicht geprüft – Markt-Upload offen** | Mit dem angemeldeten Konto wurde die Auswahlseite `/inserat` geöffnet; das Marktplatz-Erstellformular und ein tatsächlicher Upload wurden nicht erreicht. Komprimierung, Vorschau und Persistenz wurden nicht geprüft. Der gemeldete Fehler ist daher nicht als behoben bestätigt. |
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

Für den Abschluss des vollständigen Funktionsaudits werden ein kontrolliertes zweites Konto für Nachrichten und ein klar abgegrenzter Testinhalt benötigt; das vorhandene Konto enthält bereits echte Inserate, die unangetastet bleiben. Offen sind: Registrierung und frischer Login samt Einrichtung, Marketplace-Foto-Upload mit dem betroffenen Fehler, Erstellen/Bearbeiten/Veröffentlichen/Löschen eines eigenen Testangebots, Nachrichten und Gruppen zwischen Testkonten, Lesestatus nach Ab-/Anmeldung, Likes/Bewertungen/Favoriten, Kontakt- und Buchungsabläufe im sicheren Testmodus sowie echte oder simulierte mobile Geräteprüfungen.

Die Icon-Korrektur ist veröffentlicht. Das vollständige Funktionsaudit bleibt wegen der oben genannten fehlenden stabilen Anmeldung und Testkonten offen.
