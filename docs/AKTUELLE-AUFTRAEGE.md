# Aktuelle Aufträge · 21. November 2026

Reihenfolge nach Dringlichkeit und Abhängigkeiten, nicht allein nach Eingang.
Diese Liste ist eine Arbeitsübersicht, kein gestarteter Hintergrundagent.

**Website-Veröffentlichung:** Karten, Länderpriorisierung und Crew-Rotation sind veröffentlicht und nachgeprüft. Auch die zentrale **CineGenius Redaktion** ist jetzt live: 17 bisherige Beiträge und 25 alte Links erhalten; ein echter neuer Artikel über den geprüften Redaktionsdienst veröffentlicht. Der bestehende stündliche Rechercheablauf hat die separate Veröffentlichung aktiviert. Die native Smart/Work-Veröffentlichung bleibt zurückgehalten. Belege: `/srv/cinegenius/handoffs/20261120-country-first-release/receipt.json` und `/srv/cinegenius/handoffs/20261120-newsroom-release/receipt.json`.

| Reihenfolge | Aufgabe | Stand / Abhängigkeit |
| --- | --- | --- |
| 0 · Redaktion | Quellenkonflikt vor automatischer Veröffentlichung stoppen | MeetMarket-Artikel nach widersprüchlicher Gebührenangabe reversibel ausgeblendet. Verlust von Zusatzquellen/Prüfhinweisen behoben; feste Konfliktsperre, 75 isolierte Tests und echte unabhängige Prüfung (`hold`) bestanden. Geprüfter Runtime-Entwurf, Installation durch NEWS und normale Artikelkorrektur noch offen; direkte Chat-Verbindung gestört. Siehe `news-source-conflicts.md`. |
| 1 · WEB | Widersprüchliche Crew-/Kartenanzahl | Website veröffentlicht: oben und unten derselbe berechtigte gefilterte Ergebnissatz. Live-Summen aus Kartenpunkten, außerhalb liegenden und nicht verorteten Einträgen stimmen. App-Release-Halt erhalten. |
| 1 · WEB anschließend | Überdimensionierte Smart-Kartenvorschau | Kompakte Smart-Vorschau veröffentlicht. Zusätzlicher Live-Befund: Fokussieren eines Randpins schließt die Verzeichnisvorschau; Korrektur hält sichtbare Einträge offen, 43 Kartentests bestanden. Veröffentlichung/Browser-Abschluss im Release-Beleg. |
| 1 · APP separat | Hänger in Smart/Work und Wechsel Work → Community | APP diagnostiziert; Release bleibt angehalten. Unfertige native Änderungen nicht durch WEB veröffentlichen; das geprüfte Websitepaket ist separat freigegeben. |
| 2 | Homepage „Die Crew“: neue Mitglieder einen Tag priorisieren, danach mischen | Website veröffentlicht; 24 Stunden Vorrang und danach wechselnde Auswahl. 48 Tests, ursprünglicher Entwurf `f6b45be5`. Kein neues Design. |
| 3 | Mexiko und weitere Länder | Regionale Vorauswahl für Gäste, Reisende, Startseite und Verzeichnisse veröffentlicht: 162 Tests und 32 Browserfälle, 17 Sprachen, Designprüfung und vollständiger Build bestanden. Gastzugriff live zusätzlich geprüft. Vertrag in `country-first-discovery.md`, APP-Übernahme/Gerätetest offen. Mehrwährungen seit 21.11. veröffentlicht: 155 Währungen, Formulare, Preisfilter und Buchungs-Snapshots. Migration und 176 gezielte Tests bestanden; siehe `international-currency-feedback.md`. |
| 4 · WEB / Redaktion | News-Zusammenführung und Technik-/Mexiko-News | Veröffentlicht und live geprüft: acht eigene Redaktionen zusammengeführt, 17 Bestandsartikel/25 alte Links erhalten, drei Mexiko-Artikel weiterhin auffindbar, ein neuer Artikel regulär veröffentlicht. 39 Produkt- und 11 Worker-Prüfungen; vier Live-Browserkonfigurationen bestanden. Stündlicher Dienst und Ausblenden eigener abgelaufener Maschinenartikel separat aktiviert. Galerie, Bildrechte-Anbindung, begrenzte Altimport-Ausblendung und Nutzungsfeed als Website-Code `a58ee77d` veröffentlicht. Echter Galerieartikel samt Bildnachweisen geprüft, Bildautomatik aktiviert. PostHog-Lesezugang und native Prüfung offen. |
| 5 | Mitgestalten / Ländervertreter-Feedback | Website seit 21.11. veröffentlicht (`ab74924d`): private Gespräche, Länder-/Sprachlinks und Admin-Sammlung. WebKit-Bedienprüfung bei 320/390/768/1366 px einschließlich Fehler/Wiederholung und Kontowechsel bestanden. Echter KI-/Versandtest und native Übernahme offen; APP-Chat-Abstimmung wieder erreichbar. |
| 6 · APP | Hintergrundfarbe und weitere App-Gestaltung | Vier Vorschauen bei APP vorgesehen, noch keine Farbauswahl. Nach Funktionsfehlern weiterführen. |
| fortlaufend | Gesamte Website-/App-Übersichten | `CINEGENIUS-WEBSITE-UEBERSICHT.md` und `CINEGENIUS-APP-UEBERSICHT.md` enthalten weitere Bereiche und offene Grenzen. Neue Aufträge dort und hier zuordnen; nichts als erledigt oder live markieren ohne Beleg. |

Bei akuter Sicherheits- oder Datenverlustgefahr wird diese vorgezogen. Neue
Gestaltungswünsche verdrängen keine laufende Fehlerkorrektur. Ein gesicherter,
geprüfter Entwurf ist keine Veröffentlichung. Explizite Betreiberprioritäten
und Veröffentlichungsfreigaben haben Vorrang.

## News-Erweiterung · 21. November 2026

Separater Entwurf nach dem gesicherten internationalen Paket `65651599`: acht
geschützte Artikelbilder mit sichtbaren Bildnachweisen, zustimmungsgebundene echte
Impressionen/Aufrufe und privater aggregierter Lernfeed, einzelne widerrufbare
Altimport-Ausblendungen ohne Rechte zur Veröffentlichung. Vertrag:
`news-gallery-readership.md`. Datenbank/API, 17 Sprachen, isolierte WebKit-Bedienfälle und vollständiger
Produktionsbuild bestanden. Website-Code und Migration veröffentlicht; privater
PostHog-Lesezugang noch offen. Echte Galerie-Medienabnahme bestanden; Bildauswahl aktiviert. NEWS-Runtime betreut Bilder/Ablauf/Lerngewichtung separat; deren bereits
aktivierter Ablaufworker bedeutet keinen Galerie-/Lernfeed-Livegang.

**Historischer gemeinsamer Prüfstand (21.11.; vor separatem Währungs-/Feedback-Livegang):** Währungen/Feedback und News
sind unter `codex/international-news-ready-20261120` zusammengeführt. 166 gezielte
Tests, 17 Sprachen und Designprüfung bestanden. Umfang und offene Aktivierung in
[Gemeinsamer Prüfstand](international-news-release.md); vollständiger Build und
exakter Commit im zugehörigen Handoff. Native Übernahme bleibt separat offen.

News-Veröffentlichung und Live-API-Prüfung: `/srv/cinegenius/handoffs/20261121-news-gallery-release/`.
Währungen/Feedback sind anschließend separat am 21.11. unter `ab74924d` veröffentlicht; aktueller Beleg unten.

**News-Nachbesserung live (21.11., `a44cdec2`):** Tatsächliche Fehler bei Festivalnamen
und Archivdaten korrigiert. Vollständige Texte in Deutsch/Spanisch mit der echten
KI geprüft; Scrollen lädt den Artikel nicht erneut zur Übersetzung. 92 gezielte
Prüfungen und vollständiger Build bestanden. Redaktionelle Sprachfeinarbeit bleibt
möglich; native Abnahme und PostHog-Lesezugang bleiben offen. Das getrennte
Währungs-/Feedbackpaket ist inzwischen ausdrücklich freigegeben und veröffentlicht.

## Währungen und Mitgestalten veröffentlicht · 21. November 2026

Website-Quellstand `ab74924dd659454d1d0746c535c514c70251e62a` ist über den bewachten
Releaseweg veröffentlicht. Produktionsalias `www.cinegenius.co` zeigt auf
`dpl_BuCRJ3WyFFrfnKjSYfoKP9t1MBz3` (READY). 176 gezielte Tests, TypeScript, Lint,
17 Sprachkataloge und vier kontrollierte WebKit-Bedienkonfigurationen bestanden.
155 Währungen ohne Umrechnung; private, bestätigte Ländervertreter-Berichte unter
`/mitgestalten`, Admin-Sammlung unter `/mitgestalten/koordination`.
Die Buchungs-Währungsmigration ist mit unveränderten Altbeträgen und Rechten geprüft.
Aktueller Abschluss-/Livebeleg: `/srv/cinegenius/handoffs/20261121-international-release/receipt.json`.
Echter angemeldeter KI-/Versandtest und native Umsetzung/Geräteabnahme bleiben offen.
Kein weiterer News-Runtime- oder nativer Smart-/Work-Livegang ist darin enthalten.

**Live-Nachbesserung:** Frühe lokalisierte Ablehnungen bei Anmeldung, Adminrechten,
Herkunftsprüfung und Kontingent sind nun ebenfalls ausdrücklich privat und
nicht zwischenspeicherbar. 52 gezielte Folgeprüfungen und erneuter Produktionsbuild
bestanden; Berechtigungen unverändert. Die ursprüngliche abgewiesene Gastantwort
enthielt nur den Fehlertext, keine privaten Feedbackdaten.

**APP-Rückmeldung zum internationalen Paket (21.11.):** Abgleich und kleiner
Proxy-Fix unter `b0c1ea5d` gesichert; 37 gezielte Prüfungen über 17 Sprachen bestanden.
Die ältere App-Basis hat weiterhin EUR-Annahmen und keine neuen Feedback-Handler.
Native Übernahme auf aktuellem `main`, Buchungs-Neubestätigung, private Abläufe
und Geräteabnahme bleiben offen. Keine App-Veröffentlichung oder Installation.
Details und Beleg in der [App-Übersicht](CINEGENIUS-APP-UEBERSICHT.md).

**Mitgestalten-Einstieg (21.11.):** Der zuvor freistehende kleine Link wird zur
normalen Menüzeile direkt vor „Einstellungen“ in „Mein Bereich“. Gleiche Gestaltung
wie die übrigen Zeilen, mindestens 44 px Bedienfläche, für normale Mitglieder und
Admins gleichermaßen. Nutzerbericht zur fehlenden Zeile in der bereits geöffneten
Ansicht ist nicht in der echten Sitzung reproduziert; keine Cache-Ursache behauptet.
Prüf-/Veröffentlichungsstand: `/srv/cinegenius/handoffs/20261121-feedback-entry/receipt.json`.
