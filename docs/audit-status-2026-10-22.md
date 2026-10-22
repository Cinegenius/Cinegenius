# CineGenius Funktionsaudit – Stand 22.10.2026

## Ergebnis in Kürze

Der öffentliche, schreibgeschützte Rundgang wurde durchgeführt. Dabei wurden Verzeichnisse, ausgewählte Detailseiten, Suche, Catering-Filter, geschützte Einstiege und die zuvor gemeldete Browser-Icon-Adresse geprüft. Die Icon-Adresse hatte einen reproduzierbaren Laufzeitfehler; die Weiterleitung auf vorhandene Icon-Dateien wurde veröffentlicht und live geprüft.

Das vollständige Nutzer-Audit ist **noch nicht abgeschlossen**: Die Sitzung dieses Prüflaufs war abgemeldet. Ohne kontrollierte angemeldete Testkonten ließen sich Profilerstellung, Uploads, Speichern, Nachrichten, Gruppen, Favoriten, Bewertungen und Kontaktabläufe nicht sicher ausführen. Es wurden keine fremden Inhalte verändert und keine Testnachrichten versendet.

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
| Geschützte Seiten / Abmeldung | **Geprüft im abgemeldeten Zustand** | `/community`, `/messages`, `/dashboard` und `/profile-setup` leiteten auf derselben Domain zu `/sign-in` weiter und bewahrten das Rücksprungziel. Anmeldeformular wurde angezeigt; Anmeldung selbst nicht durchgeführt. |
| Anmeldung und Registrierung | **Fehlerverdacht reproduziert; Ende-zu-Ende offen** | Der erste Snapshot von `/guided-profile?resume=1` zeigte angemeldete Kontosteuerungen. Ein anschließender vollständiger Aufruf von `/dashboard` führte jedoch zu `/sign-in?redirect_url=%2Fdashboard`; danach zeigte auch die Startseite „Anmelden / Konto erstellen“. In dieser Browser-Sitzung war somit keine stabile, serverseitig nutzbare Sitzung nachweisbar. Ein frischer Login wurde nicht versucht, weil kein aktueller bestätigter Anmeldevorgang vorlag. Die Ursache (abgelaufener/staler Clientzustand oder Cookie-/Host-Sitzung) ist damit noch nicht bestimmt. Registrierung, Bestätigungscode, Logout und erneuter Login bleiben offen. |
| Profile / Firmenprofile | **Nicht geprüft** | Lesen ausgewählter öffentlicher Profile wurde in früheren Prüfschritten gesehen; Profilanlage, Speichern, Mehrfachrollen, Bearbeitung und Persistenz waren in dieser Sitzung nicht möglich. |
| Fotos und Datei-Uploads | **Nicht geprüft – Markt-Upload offen** | Upload-Route verlangt Anmeldung; Upload, Komprimierung, Vorschau und Persistenz wurden nicht mit einem kontrollierten Konto getestet. Der gemeldete Fehler ist daher noch nicht als behoben bestätigt. |
| Nachrichten, Gruppen und Lesestatus | **Nicht geprüft** | Keine kontrollierten Gegenkonten verfügbar; keine Nachricht wurde gesendet. |
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

Für den Abschluss des vollständigen Funktionsaudits werden kontrollierte Testkonten benötigt, darunter mindestens ein zweites Konto für Nachrichten. Die folgenden Abläufe bleiben offen: neuer und bestehender Login samt Einrichtung, Marketplace-Foto-Upload mit dem betroffenen Fehler, Erstellen/Bearbeiten/Veröffentlichen eigener Testangebote, Nachrichten und Gruppen, Lesestatus nach Ab-/Anmeldung, Likes/Bewertungen/Favoriten, Kontakt- und Buchungsabläufe im sicheren Testmodus sowie echte oder simulierte mobile Geräteprüfungen.

Die Icon-Korrektur ist veröffentlicht. Das vollständige Funktionsaudit bleibt wegen der oben genannten fehlenden stabilen Anmeldung und Testkonten offen.
