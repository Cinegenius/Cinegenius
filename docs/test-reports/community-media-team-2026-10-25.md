# Öffentliche Communitybilder und gezielte Teameinladungen

Stand: 25.10.2026. Technischer Prüfbericht zur Veröffentlichung. Der Deploymentstatus wird zusätzlich über den vorgesehenen Vercel-Releaseweg kontrolliert.

## Ausgangslage und Änderungen

Die Communitysammlung las bislang nur eine begrenzte Menge persönlicher Profile aus. Profilporträts, Titelbilder, Firmenlogos und Bilder anderer Inhaltstypen wurden nicht gemeinsam berücksichtigt. Die vollständige Galerie war ebenfalls auf diese Profilauswahl begrenzt. Die vorhandene Teamverwaltung bot Beitrittsanfragen und private Einladungslinks, aber keine gezielte Profilsuche mit einer direkt adressierten, bestätigungspflichtigen Einladung.

### Zentrale Bildzuordnung

`public_community_media` ist eine ausschließlich serverseitig lesbare Datenbankansicht. Die Zuordnung wird bei einer neuen Anfrage aus den aktuellen Elterninhalten und vorhandenen öffentlichen Storageobjekten berechnet. Es wird keine zweite, möglicherweise veraltete Kopie der Bildsammlung gepflegt.

| Öffentlicher Bereich | Berücksichtigte Bildfelder |
| --- | --- |
| Persönliche Profile | Avatar, Titelbild, `profile_images` einschließlich Porträts, ältere `portfolio_images` |
| Firmen | Logo, Titelbild, Galerie |
| Firmen-Equipment | Veröffentlichte Equipmentbilder einer öffentlichen Firma |
| Locations | Hauptbild, weitere und ältere Galeriebilder, öffentliche Bildgrundrisse, Fotos aus Produktionsreferenzen |
| Marktplatz | Hauptbild, weitere und ältere Galeriebilder, Fotos aus Produktionsreferenzen; Fahrzeuglinks führen nach `/vehicles` |
| Projekte | Poster und Projektfotos; private Metadateneinträge werden ausgeschlossen |
| Weitere vorhandene Angebote | Bilder öffentlicher Jobs, Tiere und Firmen-Dienstleistungen mit gültigem Ziel |
| Schwarzes Brett | Adapter für öffentliche Bildfelder; der aktuelle Aushangeditor ist textbasiert und hat keinen Bildupload |

Nur Dateien, die einem gültigen öffentlichen Inhalt zugeordnet sind und als Bild in einem öffentlichen Storage-Bucket existieren, kommen in die Auswahl. Private Profile, Entwürfe, private Einzelbilder, private Buckets, ablaufende signierte Adressen, lokale Vorschaubilder, Nachrichten und Supportanhänge werden nicht aufgenommen. Bei öffentlichen Projekten einer privaten Person wird deren Profilzuordnung nicht offengelegt. PDFs erscheinen nicht als Fotos.

Identische Verweise auf dasselbe Storageobjekt werden einmal angezeigt. Physisch getrennt erneut hochgeladene Dateien werden nicht anhand ihres Bildinhalts zusammengeführt; vorhandene Zuschreibungen und Likehistorien werden nicht verändert. Neue Bereiche lassen sich im zentralen Quellenblock ergänzen.

### Darstellung

- Der bestehende zweireihige, gegenläufige Fotostreifen mit Ziehen und Wischen bleibt erhalten. Die Auswahl verwendet neue öffentliche Bilder und verteilt Beiträge verschiedener Anbieter. Eine Mindestanzahl an Likes ist nicht erforderlich.
- „Alle Einblicke ansehen“ öffnet die komplette, chronologische Sammlung mit jeweils 48 Bildern und Seitennavigation.
- Jedes Foto führt zur konkreten Fotoansicht. Namen und Inhalte haben getrennte Links zu den tatsächlich zugeordneten öffentlichen Zielen. Für unbekannte oder private Personen wird kein Profilziel erfunden.
- Logos werden vollständig eingepasst. Die Großansicht zeigt jedes Bild ohne Verzerrung. Schließen und weitere Bedienelemente bleiben auch auf schmalen Bildschirmen erreichbar.
- Karten nutzen responsive Bildgrößen. Bei einem Auslieferungsfehler gibt es einen verständlichen Fehlerzustand. Nicht mehr öffentliche Fotos können nicht über einen alten Galerielink erneut geöffnet werden.
- Bestehende Foto-Likes behalten ihre vorhandenen Schlüssel und Datensätze. Auch neue öffentliche Bildarten können über denselben Dienst geliked werden. Like-Benachrichtigungen führen zum konkreten Foto. Personenbezogene Antworten werden nicht gemeinsam zwischengespeichert.

### Teamverwaltung

- Getrennte Ansichten für bestätigte Mitglieder, eingehende Anfragen und ausstehende Einladungen; zusätzlicher Einstieg „Mitglied hinzufügen“.
- Profilsuche mit Namen, Bild, Tätigkeit und allgemeinem Standort. Private Profile, bereits verknüpfte Personen und laufende Vorgänge werden vor der Ergebnisbegrenzung ausgeschlossen. Keine E-Mail oder Telefonnummer wird ausgewählt oder ausgeliefert.
- Bis zu fünf öffentliche Funktionen einschließlich individueller Bezeichnung. Direkt adressierte Einladungen gewähren ausschließlich die technische Rolle `member` nach der Annahme.
- Die Person erhält eine gespeicherte Benachrichtigung und kann unter `/company-invitations` annehmen oder ablehnen. Auch „Mein Bereich“ verlinkt die eigenen Einladungen. Die Firma kann offene Einladungen zurückziehen.
- Vor der Annahme entsteht keine Teammitgliedschaft, öffentliche Funktion, Profilverknüpfung oder Zählererhöhung. Bestehende öffentliche Leser berücksichtigen weiterhin ausschließlich bestätigte Zugehörigkeiten.
- Erstellung, Statuswechsel, Mitgliedschaft und Benachrichtigung erfolgen für direkte Einladungen atomar. Wiederholungen erzeugen keine Duplikate. Gemeinsame Sperren verhindern parallele, widersprüchliche Anfrage- und Einladungsvorgänge.
- Nur Kontoinhaber und bestätigte Firmenadministratoren können einladen oder verwalten. Normale Mitglieder und Bearbeiter können das nicht. Die entsprechenden Datenbankfunktionen sind nur für den authentifizierten Serverdienst ausführbar.
- Annahme und Beendigung entwerten die betroffenen Firmen- und Profilcaches unmittelbar. Mehrere Firmenzugehörigkeiten bleiben möglich; das persönliche Konto wird beim Beenden einer einzelnen Zugehörigkeit nicht gelöscht.
- Der bestehende private Einladungslink für Personen ohne Konto bleibt als gesonderter, eingeklappter Ablauf erhalten.

## Tatsächlich ausgeführte Prüfungen

### Automatisierte Regressionen

- Gesamte Testsuite: **518 bestanden, 0 fehlgeschlagen**.
- Darin zwölf neue Datenbanktests mit einer echten PostgreSQL-Engine über PGlite und isolierten synthetischen Datensätzen. Die tatsächlichen beiden Migrationsdateien werden dabei ausgeführt.
- Geprüft: sämtliche Quellen einschließlich Profilfoto und Firmenlogo, alte Galeriefelder, Dateizuordnung, Sonderzeichen, Dateiduplikate, Bildaustausch, Entfernen, Deaktivierung, Sichtbarkeitsänderung, abgelaufene Aushänge, Grundrisse und Referenzfotos, Erhalt vorhandener Likes.
- Geprüft: Einladen, wiederholtes Senden, adressatgebundene Annahme, Ablehnung, Rücknahme, Ablauf, widersprüchliche Anfragen, getrennte Rechte und Funktionen, mehrere Firmen sowie Erhalt des Kontos nach Beenden einer Zugehörigkeit.
- Geprüft: verweigerte Datenbankzugriffe für `anon` und `authenticated`, verweigerte Verwaltung für Bearbeiter, Profilsuche ohne Kontaktfelder.
- Gezielte TypeScript-/ESLint-Prüfung, gemeinsame Designprüfung und produktiver Build bestanden. Der Build ersetzt keine Ablaufprüfung.

### Abgleich mit der vorhandenen Supabase-Datenbank

- Beide Migrationsdefinitionen gegen das reale Schema in einer Transaktion ausgeführt und anschließend zurückgerollt.
- Der Bestandsabgleich erfasste 109 aktuell zugeordnete öffentliche Bilder, darunter 36 Profilfotos und drei Firmenlogos. Bei den zwei öffentlichen Locations war kein Hauptbild hinterlegt. Vorhandene Avataradressen verwenden den eigenen Supabase-Storage.
- Mit ausschließlich neu angelegten synthetischen Prüfprofilen und einer Prüffirma ausgeführt: Einladung, wiederholtes Senden, einzelne Benachrichtigung, verweigerte Annahme durch eine andere Person, Annahme, wiederholte Annahme, öffentliche Funktion bei technischer Rolle `member`, Ablehnung, Rücknahme, Anfragekonflikt und gesperrter anonymer Zugriff.
- Alle Prüfschreibvorgänge und Testbenachrichtigungen zurückgerollt. Anschließend separat bestätigt: **0 Prüfprofile, 0 Prüffirmen, 0 Testbenachrichtigungen**. Die neue Datenbankansicht ist nach dem Rollback nicht installiert. Keine reale Person wurde eingeladen oder angeschrieben.
- Der wiederholbare, ausschließlich zurückgerollte Prüflauf liegt unter `supabase/tests/community_media_team.sql`. Er setzt die beiden Migrationen voraus; der durchgeführte Kompatibilitätstest hat sie innerhalb derselben zurückgerollten Transaktion vorgeschaltet.

### Browsersimulation

Die tatsächlichen neuen UI-Komponenten wurden lokal mit synthetischen Testantworten geprüft. Diese Prüfung verwendet keine echte Clerk-Anmeldung und keinen echten Storageupload.

- Profilsuche, Auswahl einer Person mit langem Namen, mehrere Funktionen und freie Bezeichnung, Versandbestätigung, ausstehende Einladung, Annahme, Ablehnung und Rücknahme.
- Erneutes Laden der simulierten Einladungsansicht, Logoansicht, Fotostreifen, konkrete Fotoansicht sowie getrennte Profil- und Inhaltslinks.
- Breiten 320, 390, 768 und 1366 CSS-Pixel. Kein horizontaler Seitenüberlauf gemessen. Eine Überlagerung des Logos durch die Schließen-Schaltfläche auf kleinen Bildschirmen wurde gefunden, korrigiert und nachkontrolliert.
- Temporäre Prüfrouten und Entwicklungsumgehungen wurden entfernt; sie gehören nicht zum Release.

## Noch offen und Releaseabhängigkeiten

- **Keine vollständige Prüfung mit zwei echten Clerk-Testkonten**, echter Neuanmeldung, echtem Bildupload, Abmeldung und erneutem Login. Die Datenbankprüfung und die Browserprüfung decken diese externe Verbindung nicht vollständig ab.
- **Keine echten iOS-/Android-Gerätetests**. Die genannten Größen sind Browsersimulationen.
- Das Schwarze Brett hat derzeit keinen Foto-Upload. Es wurden keine nicht vorhandenen Beitragsbilder erfunden und kein neuer Beitragseditor gebaut.
- Keine pauschale Änderung bestehender Nutzerbilder, bestätigter Zugehörigkeiten oder Rechte.
- Die beiden Migrationen `20261024190000_public_community_media.sql` und `20261024191000_direct_company_invitations.sql` wurden am 25.10.2026 dauerhaft auf der Produktionsdatenbank angewendet; PostgREST wurde zum Neuladen des Schemas aufgefordert. Anschließend bestätigt: 109 öffentliche Bilder, kein direkter Zugriff auf die Ansicht als `anon`, keine Ausführung der vertrauenswürdigen Einladungsfunktion als `authenticated`.
- Die abhängige Website-Version darf ausschließlich als sauberer, mit `origin/main` synchronisierter Stand über `npm run deploy:production` veröffentlicht werden. Eine erfolgreiche Migration allein bestätigt noch keinen Website-Deploymentstatus.
