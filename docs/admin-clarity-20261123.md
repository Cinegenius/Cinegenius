# Adminbereich: Mitglieder und Anbieter · 23. November 2026

## Auftrag und Stand

Markus möchte den Adminbereich verständlicher gliedern und Konten/Profile nach Crew, Marktplatz, Locations und Firmen finden. Auf Produktcommit `a6d7a34abb394a9d36150727eb43c87defc0a045` **veröffentlicht und live geprüft** (`dpl_6u5AnGBUk4gFsPw3vEaw3MvavY4d`, www-Zuordnung bestätigt). Bestehende Sucher bleiben als Bestand auffindbar. Dieser Auftrag ändert keine Registrierungs-, Veröffentlichungs- oder Verifizierungsrechte.

## Bedienung

- Navigation in Übersicht, Mitglieder & Firmen, Prüfen & helfen, Inhalte & Betrieb sowie Verwaltung gegliedert. Alle bisherigen 16 Reiter und die beiden bestehenden Unterseiten bleiben erreichbar. Länder-Feedback führt zusätzlich direkt zur bestehenden geschützten Koordination.
- Auf dem Handy ein aufklappbares, gegliedertes Menü statt der langen horizontalen Reiterreihe. Bestehende Supportanzeigen und Navigation mit Entwurfsschutz erhalten.
- „Mitglieder & Anbieter“ ist der gemeinsame Einstieg zu allen Konten. Filter: Crew, Marktplatz, Locations, Firmen, bestehende Sucher und noch nicht zugeordnete Konten; Einrichtung unabhängig davon offen/abgeschlossen. Sortierung nach neuester/ältester Registrierung, Name oder letzter Anmeldung. Ein Mitglied kann mehreren Bereichen angehören und wird innerhalb einer Ergebnisliste nur einmal gezählt.
- Bereichszuordnung berücksichtigt gespeicherte Einrichtungsziele, tatsächliche Profiltypen und tatsächliche Firmeneigentümer. Eine bloße Inseraterstellung für einen anderen Anbieter macht den technischen Ersteller nicht zum Anbieter. Unveröffentlichte Profile bleiben für berechtigte Administratoren erreichbar. Ein alter leerer Such-Platzhalter ist keine echte Sucher-Auswahl.
- Kompakte Mitgliederzeilen zeigen Name, E-Mail, Bereiche, Einrichtung und einen tatsächlich vorhandenen Profil-Verifizierungshaken. Gespeicherte Namen aus der Einrichtung sind auch ohne fertiges Profil sichtbar. „Einrichtung offen“ behauptet keinen technischen Fehler und kein Hängenbleiben.
- Erst beim Aufklappen werden Firmen, Inserate, Entwürfe, Profilaktionen, letzte Anmeldung und Support geladen. Status „Einrichtung abgeschlossen“ ist keine Veröffentlichungs- oder Verifizierungsfreigabe. Gespeicherte Firmen-/Inseratstatus und verantwortliche Anbieter bleiben getrennt.

## Ergänzung: unfertige Profile und englischer Support

Markus hat nach den Ergänzungen das gesamte Paket ausdrücklich mit „Ja, alles live stellen“ freigegeben. Der aktuelle Hauptstand einschließlich App2212 ist konfliktfrei übernommen; APP hat sein Releasefenster nach dem eigenen finalen Nachweis ausdrücklich freigegeben. Das gesamte Adminpaket ist anschließend über den geschützten Releaseweg veröffentlicht.

- Eigener Statusfilter **Nicht fertiggestellte Profile**: offene Kontoeinrichtung oder ein gespeichertes Profil ohne die bestehenden Pflichtgrundlagen. Die Zeilen unterscheiden „Noch kein Profil gespeichert“ und „Profil noch nicht vollständig“. Abgeschlossene Firmen-/Anbieterkonten und bestehende Sucher benötigen kein persönliches Profil. Bilder, Biografie und zusätzliche Tätigkeiten sind kein Vollständigkeitskriterium. „Einrichtung offen“ bleibt zusätzlich als engerer Filter erhalten; „Abgeschlossen“ schließt tatsächlich unvollständige gespeicherte Profile aus. Eine offene Einrichtung beweist keinen technischen Fehler.
- Sieben unveränderte gespeicherte Standardvorlagen werden mit der gezielten Migration `20261123210028_english_admin_support_templates.sql` ins Englische übersetzt. Die beiden ergänzenden Vorlagen für Kontoeinrichtung und begonnene Angebote werden explizit aus dem englischen Katalog geladen, unabhängig von der Sprache des Administrators. Eingesetzte Pflichtfeldbezeichnungen und ersatzweise Angebotstitel sind ebenfalls Englisch; eigene Namen und Angebotstitel bleiben original.
- Die E-Mail-Benachrichtigungen für neue administrative Supportnachrichten und Antworten verwenden ebenfalls Englisch. Zustellpräferenzen, dauerhafte Speicherung und Wiederholschutz bleiben bestehen. Persönliche Mitgliederchats behalten ihre bisherige Sprachwahl.
- Die drei Schreibflächen für neue Nachrichten, Antworten und Vorlagen kennzeichnen Englisch als Zielsprache. Freie Texte bleiben vom Administrator editierbar; keine versteckte KI-Übersetzung oder zusätzliche API-Kosten. Bestehende Nachrichten werden nicht nachträglich übersetzt und es wird keine Nachricht automatisch gesendet.

### Migration und Veröffentlichung

Die lesende Bestandsprüfung am 23. November fand genau die sieben ursprünglichen deutschen Standardvorlagen und keine gespeicherten Überschreibungen der beiden zusätzlichen Vorlagen. Die Migration übersetzt nur exakt diese Ausgangstexte, erhält Beschriftungen und Aktivierung und stoppt atomar bei zwischenzeitlich geändertem Text. Eigene zusätzliche Vorlagen und gelöschte Standardvorlagen bleiben erhalten; bereits englische Zieltexte sind idempotent. Es werden weder Konten noch Gesprächsverläufe, Berechtigungen oder Versanddaten geändert.

**Am 23. November auf Produktion angewandt und zurückgelesen.** Genau sieben englische Vorlagen; Beschriftungen, Aktivierung, RLS und Clientrechte unverändert. Vorher-/Nachhersicherung und SHA-Beleg unter `/srv/cinegenius/handoffs/20261123-admin-clarity/production/receipt.json`.

Vorgehen und Rücknahmevertrag: Die frische Katalogprüfung bestätigt wie beim vorherigen Team-/Mail-Release: Es existiert kein Anwendungs-Migrationsregister (nur die internen auth/realtime/storage-Register). Kein neues Register und keine historischen Migrationen anlegen. Die sieben Zeilen vorab sichern, nur diese geprüfte Migration gezielt atomar anwenden und mit Quellhash, Vorher-/Nachhervergleich und Betreiberbeleg dokumentieren; kein pauschales `db push`. Anschließend die englischen Vorlagen samt aktivierten Zuständen lesen und den geprüften Appcode über sauberes `main == origin/main` veröffentlichen. Das laufende App-Releasefenster bleibt davon getrennt. Rücknahme nur anhand des gesicherten Bestands mit Vergleich der aktuellen Zieltexte, keine zwischenzeitlichen Adminänderungen überschreiben.

## Daten- und Kostenvertrag

`GET /api/admin/account-directory?page=…` prüft `requireAdmin` vor Clerk/DB und liefert ausschließlich die kleine Adminprojektion: je 100 Konten, deren Profilstatus und Firmeneigentum. Private Metadaten, Dokumente und Entwurfsinhalte werden nicht an diese Übersicht ausgeliefert. Alle Antworten sind privat/no-store; keine gemeinsam genutzten Kundendaten-Caches und keine Schreibzugriffe.

Die Oberfläche liest alle Indexseiten einmal beim Öffnen/Aktualisieren, bevor sie Gesamtfilter und Trefferzahlen zeigt. Danach erfolgen Suche, Bereichs-/Statusfilter und 25er-Anzeigeseiten im Arbeitsspeicher ohne neue Netzaufrufe. Details verwenden den bereits geschützten Einzelkonto-Leseweg. Keine Hintergrundabfrage, keine zusätzlichen kostenpflichtigen Dienste. Ein Kontowechsel entfernt den vorhandenen Adminzustand über die bestehende Kontogrenze; späte Antworten nach Abbruch werden nicht angewendet.

Veränderte Gesamtzahlen während des Lesens, doppelte IDs, vorzeitig endende Seiten oder Fehler werden nicht als vollständige Liste ausgegeben. Aktualisieren lädt erneut. Die Übersicht hat eine explizite Schutzgrenze von 10.000 Konten und liest Firmeneigentum über die Datenbankseitengrenze hinaus; oberhalb ihrer Schutzgrenze meldet sie einen Fehler statt einer falschen Gesamtzahl. Für deutlich größere Bestände ist ein persistenter serverseitiger Suchindex eine separate Erweiterung. Dies ist eine geladene Momentaufnahme, kein Echtzeitmonitor.

## Prüfungen und Grenzen

Abgleich mit `3afe555d`: 104 gezielte Tests, TypeScript, 17 Sprachkataloge mit 11.720 Schlüsseln und die verpflichtenden Designprüfungen bestanden. Eingehende App-Laufzeitdateien und alle neuen App-Katalogwerte unverändert erhalten. Belege: `/srv/cinegenius/handoffs/20261123-admin-clarity/production/`.

Folgeauftrag unfertige Profile/englischer Support: 88 gezielte Tests bestanden, einschließlich real ausgeführter lokaler PostgreSQL-Migration mit atomarem Abbruch und Wiederholung. Nach der abschließenden Sprachkorrektur weitere 13 Versand-/Supportprüfungen und 26 gezielte Sprach-/E-Mail-Prüfungen bestanden (teilweise überlappend, nicht addiert). 21 aktualisierte Verzeichnis-Browserfälle über 17 Sprachen sowie 9 zusätzliche Supportdialog-Fälle bei 320/393/1440 Pixeln bestanden. Support-Empfänger, Vorlagen und Transport sind im Browser kontrollierte Testdaten; dabei kein Versand. TypeScript, 17 Kataloge mit 11.686 Schlüsseln und 20 Designprüfungen bestanden. Fünf bestehende ESLint-Warnungen in den beiden Supportkomponenten unverändert, keine neuen Fehler. Belege des Folgeauftrags: `/srv/cinegenius/handoffs/20261123-admin-clarity/followup/`. Die ursprünglichen Prüfungen des Adminpakets folgen als eigener Checkpoint:

- 81 gezielte Tests: Bereichs-/Statusüberschneidungen, Sucherbestand, fehlende Profile, Datengrenzen und Seiten >100, Fehler statt falscher Nullzahlen, Adminschutz/no-store, alle Navigationsziele, bestehende Konten-/Support- und Verifizierungsverträge.
- TypeScript bestanden; 17 Sprachkataloge vollständig; 20 verpflichtende Designprüfungen bestanden.
- 21 bestandene kontrollierte Komponenten-Browserfälle über 17 Sprachen, Deutsch/Spanisch bei 320/393/1440 Pixeln: reale `AdminAccounts`/`AdminNavigation`, tatsächliche Navigationsdefinition und gemeinsame CSS; synthetische Konten und ersetzter Netzwerk-/Anmeldezugang. Filter ohne neue Anfragen, Detailabruf erst bei Bedarf, Fehler/Wiederholen, mobile Navigation und Sortierung. Prüfbelege: `/srv/cinegenius/handoffs/20261123-admin-clarity/`.
- Neue/überarbeitete eigenständige Module ohne ESLint-Fehler. Die bestehende große Adminseite hat unverändert zwei ältere Hook-Regelfehler und zwölf Warnungen; vor/nach dem Patch abgeglichen. Der alte Admin-Ladetest erhielt die zuvor fehlende echte Währungsabhängigkeit sowie die neue Navigationskomponente.
- Die vorstehenden Komponentenprüfungen versendeten keine echten Supportnachrichten und änderten keine Verifizierungen oder Kundeneinträge.

## Veröffentlichungsnachweis

Normaler geschützter Produktionsbuild von sauberem `main == origin/main` mit Exit 0: `a6d7a34a` → `dpl_6u5AnGBUk4gFsPw3vEaw3MvavY4d`, READY und www-Alias sowie Projekt-/Quellidentität geprüft. Next-Build, TypeScript, 17 Sprachkataloge/11.720 Schlüssel und 20 Designprüfungen bestanden. Sieben lesende HTTP-Prüfungen bestätigen vier anonyme Admin-API-Ablehnungen und drei erreichbare öffentliche Seiten. Zwei echte Gast-Browserfälle bei 393/1440 Pixeln bestätigen die Weiterleitung vom Adminbereich, keine Inhaltsüberbreite und keine Browserfehler.

Keine angemeldete Admin-Sitzung stand hier für einen echten Live-Durchlauf zur Verfügung; die Verwaltungsansichten und Supportdialoge wurden zuvor mit kontrollierten Testdaten geprüft. Kein echter Nachrichtenversand, keine Provider-/Flagänderung und kein nativer Build oder Geräteinstallationsnachweis dieses Auftrags. Betreiberbeleg: `/srv/cinegenius/handoffs/20261123-admin-clarity/production/receipt.json`.
