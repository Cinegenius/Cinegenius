# Organisationen und Branchenbeiträge – Phase 1

Stand: 4. November 2026. Lokal implementiert; genehmigte Migration in Supabase Produktion ausgeführt und mit zurückgerollten Testdaten geprüft. Die Website-Erweiterung ist noch nicht veröffentlicht.

## Umfang

- Eigenständige Organisationsdaten, Verwaltung durch Eigentümer und serverseitig geprüfte Berechtigungen.
- News, Workshops, Weiterbildung und Veranstaltungen mit typabhängigen Eingaben und externen Anmeldelinks.
- Öffentliche Übersicht, Organisationsseite und Beitragsdetail; Veröffentlichung abhängig von freigegebener Organisation und freigegebenem Beitrag.
- Adminprüfung mit Versionsprüfung und Änderungsprotokoll; private Wiederherstellungsentwürfe über das vorhandene System.
- Medienzugriff anhand des tatsächlichen Elterninhalts. Neue Texte in Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch.

## Geänderte Bereiche

Neue Seiten unter `app/news`, `app/organizations` und `app/organization-dashboard`; APIs unter `app/api/organizations` und `app/api/admin/organizations`; Verwaltungsoberflächen unter `components/organizations` und `components/admin/AdminOrganizations.tsx`.

Gemeinsame Logik in `lib/organization-{access,data,media,taxonomy}.ts`; Integration in Formulentwürfe, geschützte Medien, Adminseite, Footer und sechs Sprachkataloge. Datenbankänderung: `20261103170000_organizations_and_news.sql`.

## Bestandene Prüfungen

- 26 gezielte Tests: 3 öffentliche/protected Routingtests sowie 8 API-/Datenbankabläufe, 6 lokale PGlite-Datenbanktests, 3 Taxonomietests, 6 Formulentwurfstests. Geprüft wurden unter anderem private Standardwerte, gesperrte direkte Datenbankrechte, Freigabeabhängigkeiten, Audit-Rollback, Medienzugriff und entzogene Mitgliedschaft.
- TypeScript ohne Fehler, Produktions-Build erfolgreich, `git diff --check` erfolgreich.
- Übersetzungsschlüsselprüfung: sechs Kataloge mit je 2271 Schlüsseln.
- Browser mit ausschließlich synthetischen lokalen Testdaten: Übersicht und Detaildarstellung, sprachabhängige Beschriftungen, ereignisspezifische Felder, Wechsel Workshop/News unter Erhalt des eingegebenen Titels.
- Vorschau bei 390, 820 und 1440 CSS-Pixeln geprüft. Suchfeld auf dem Handy, Formularüberlauf und nicht vorhandenes Farbtoken korrigiert. Gemessene Inhaltsbreiten liegen innerhalb des jeweiligen Viewports.

Screenshots liegen außerhalb des Repositories unter `../organization-preview/`.

## Zusätzlicher Integrationsschritt

`lib/organization-api.test.mjs` führt die tatsächlichen Speicher-, Workspace- und Admin-Handler sowie die öffentliche Datenabfrage gegen eine lokale PostgreSQL-Engine (PGlite) mit der tatsächlichen Migration aus. Die minimale Ausgangsstruktur liegt gemeinsam unter `lib/test-fixtures/organization-database.mjs`.

Bestanden:

- Privaten Organisations- und Beitragsentwurf speichern, erneut lesen, einreichen, exakt geprüften Stand freigeben und öffentlich abrufen. Ein Beitrag wird ohne freigegebene Organisation nicht öffentlich.
- Gefälschte Eigentümer-/Freigabefelder, fremde Bearbeitung und unberechtigte Adminfreigabe werden abgewehrt; fremde Arbeitsbereiche bleiben leer.
- Veraltete Prüfstände und fehlendes Admin-Audit verhindern die Freigabe. Änderungen an freigegebenen Beiträgen setzen diese wieder auf „eingereicht“ und entfernen sie aus öffentlichen Abfragen.
- Nachbesserung und erneutes Einreichen erhalten ID und öffentliche Adresse.
- Fremde Bilder, lokale Vorschauadressen und Wiederverwendung eines bereits anders zugeordneten Bildes werden zurückgewiesen; die bestehende eigene Zuordnung bleibt bearbeitbar.
- Beendete Organisationsmitgliedschaft entzieht Bearbeitung und Zugriff auf den Arbeitsbereich.
- Ungültige Termine und unsichere Links werden abgewiesen. Ein simulierter Speicherfehler liefert keinen Erfolg; nach Wiederholung sind Daten gespeichert.
- Suche, Typ-/Themenfilter und zwei Ergebnisseiten mit 26 freigegebenen Testbeiträgen bleiben eindeutig. Private Beiträge werden nicht gefunden. Ausblenden der Organisation sperrt ihre Übersicht und Beitragsdetails.

Aufruf: `node --experimental-strip-types --import ./scripts/register-test-aliases.mjs --test lib/footer-public-routes.test.mjs lib/organization-api.test.mjs lib/organization-db.test.mjs lib/organization-taxonomy.test.mjs lib/form-draft.test.mjs` — 26 bestanden, 0 fehlgeschlagen.

## Grenzen und nächste Schritte

### Lesender Produktionsabgleich vor der Migration

Am 3. November wurden in Supabase `Cinegenius / main / PRODUCTION` ausschließlich Schema-Metadaten und Funktionsdefinitionen abgefragt. Zum Zeitpunkt dieses Vorabgleichs waren die vier neuen Organisationstabellen noch nicht vorhanden. `media_assets` und die erwarteten Signaturen von `bind_media_source`, `media_company_editor`, `readable_media_asset` und `source_image_urls` sind vorhanden.

Die vollständigen Funktionskörper von `bind_media_source`, `readable_media_asset` und `source_image_urls` wurden mit der vorbereiteten Erweiterung verglichen. Die bestehenden Zweige für Profile, Firmen, Inserate, Projekte, Projektentwürfe, Communitybeiträge und Firmenequipment entsprechen der erwarteten Ausgangslage; die Migration ergänzt Organisationsquellen. Auch die bisherige Behandlung privater Profilbilder und Produktionsreferenzen sowie der Blockierungen wurde berücksichtigt. Dies ist ein Kompatibilitätsabgleich, kein Nachweis einer bereits angewendeten Migration oder eines realen Uploadtests. Die Produktionsdaten und Zugriffsregeln wurden nicht verändert.

- Die Browservorschau ersetzt Daten und Entwurfshook durch lokale Fixtures. Sie belegt keine reale Anmeldung, Uploadspeicherung, Entwurfswiederherstellung oder Adminfreigabe über Supabase.
- Die zusätzlichen API-Tests verwenden echte Handler und SQL-Regeln, ersetzen aber Clerk-Sitzungen, die externe Verantwortlichenprüfung, den Admin-Audit-Transport und den Supabase-HTTP-Transport. Sie prüfen keine echten Storage-Dateien oder Browser-An-/Abmeldung. Es wurden keine Produktionsdatensätze angelegt oder verändert.
- Der nachfolgende Nachtrag dokumentiert den inzwischen durchgeführten Browserablauf gegen die echte Integration; ein echter Datei-Uploadtest bleibt offen.
- Gesamtsuite: 1098 von 1117 Tests bestanden. 19 Fehler waren bereits im Vergleichslauf vorhanden; überwiegend veraltete Mocks bzw. Annahmen in Footer-, Auth-, Startseiten-, Catering- und Bildtests. Kein vollständiger grüner Gesamtlauf.
- Mehrpersonenverwaltung mit Einladungsoberfläche, beidseitig bestätigte Verknüpfungen, interne Veranstaltungsanmeldung und Organisationsnewsletter gehören zu späteren Phasen.
- Keine bestehenden Nutzerdaten verändert, keine Nachrichten versendet, keine Website-Version veröffentlicht. Die genehmigte Datenbankerweiterung ist bereits aktiv.

## Produktionsmigration und tatsächlicher SQL-Integrationstest

Die genehmigte Migration wurde in `Cinegenius / main / PRODUCTION` erfolgreich ausgeführt. Anschließend wurden ausschließlich eigene synthetische Testdatensätze in einer Transaktion angelegt und vollständig zurückgerollt. Das Ergebnis bestätigte null verbliebene Testorganisationen und null Test-Medieneinträge.

Bestanden: RLS und gesperrter Direktzugriff auf die vier neuen Tabellen; automatische Eigentümerzuordnung und Prüfprotokoll; Entwurf und Einreichung; Freigabe eines Beitrags nur mit freigegebener Organisation; Versionskonflikte; kanonische Medienzuordnung; Eigentümer- und aktive Verwaltungsrechte; Rechteentzug nach beendeter Mitgliedschaft; öffentliche Bildberechtigung erst nach Freigabe; Entzug beim Ausblenden des Elterninhalts oder Entfernen der Bildreferenz.

Dieser SQL-Test hat keine tatsächlichen Dateien hochgeladen und ersetzt keinen angemeldeten Browsertest.

## Browserabgleich am 4. November

- Eine isolierte lokale Anwendung auf `localhost:3137` liefert die öffentliche Newsübersicht erfolgreich aus. Der geschützte Organisationsbereich führt ohne Sitzung zur Anmeldung auf demselben Host mit erhaltenem Rücksprungziel.
- Die Browserkonsole belegt den konkreten Blocker: Clerk verweigert die lokale Initialisierung, weil die vorhandenen Production Keys nur für `cinegenius.co` zugelassen sind. In den geprüften lokalen Konfigurationen liegt kein Clerk-Testschlüssel vor. Es wurden keine Zugangsdaten ausgegeben oder Schutzregeln geändert.
- Der aktuelle Produktions-Build und alle 26 gezielten Tests sind erfolgreich. Build-Log: `/tmp/org-build-current.log`; Test-Log: `/tmp/org-target-current.log`.
- Der vollständige angemeldete Browserablauf einschließlich echter Storage-Dateien bleibt offen und benötigt eine geeignete Testumgebung. Die Anwendung wurde noch nicht live veröffentlicht.


## Nachtrag: echter Freigabeablauf am 4. November

Die anfängliche Clerk-Sperre der lokalen Vorschau wurde mit der vorhandenen Entwicklungsinstanz gelöst. Ein eigenes Entwicklungskonto wurde in Safari verwendet. Die Anwendung auf localhost:3137 war dabei mit der produktiven Supabase-Datenbank verbunden; ausschließlich die synthetische Organisation „CineGenius Integrationstest 20261104“ und ihr Beitrag „Privater News-Integrationstest 20261104“ wurden bearbeitet.

Tatsächlich im Browser bestanden:
- Organisation erstellen, speichern, neu laden und einreichen.
- Newsbeitrag erstellen, speichern, neu laden und einreichen.
- Beide geprüften Einträge über die lokale Adminoberfläche freigeben.
- Als nicht angemeldeter Besucher in einem getrennten Browser die Newsübersicht, den Beitrag und die verknüpfte Organisation öffnen.
- Organisation und Beitrag anschließend wieder ausblenden; beide direkten öffentlichen Detailadressen liefern danach eine 404.
- Die ausdrücklich genehmigte lokale Adminausnahme wurde aus dem Testlauncher entfernt und der Server neu gestartet. Ein erneuter Aufruf der Adminansicht mit demselben angemeldeten Konto führt zur Startseite; die Adminansicht ist nicht mehr zugänglich. Die produktive Adminliste wurde nicht verändert.

Die beiden synthetischen Browserdatensätze bleiben ausgeblendet mit Prüfprotokoll erhalten. Sie sind von den vollständig zurückgerollten SQL-Testdatensätzen zu unterscheiden. Es wurden keine echten Nutzerinhalte geändert und keine Nachrichten verschickt.

Nachweis der zuvor freigegebenen Gastansicht: [Screenshot](/Users/markusmueller/Documents/Codex/2026-10-01/hall/organization-preview/news-approved-guest.png).

Noch nicht als echter Browserablauf nachgewiesen: Upload einer tatsächlichen Bilddatei mit anschließendem Rechtewechsel sowie die vollständige mobile Anmeldung. Medienberechtigungen sind im SQL-Integrationstest geprüft, responsive Layouts mit Testfixtures geprüft. Diese Prüfungen ersetzen keinen echten Datei-Uploadtest. Website-Version weiterhin nicht veröffentlicht.


## Nachtrag: tatsächlicher privater Bildupload am 4. November

Im bestehenden ausgeblendeten synthetischen Newsbeitrag wurde eine eigens erzeugte Testdatei (640 × 360 Pixel) über die Safari-Dateiauswahl hochgeladen. Die private Entwurfsanzeige bestätigte die Speicherung. Nach Neuladen und erneutem Öffnen des Beitrags wurde das Bild wiederhergestellt. Anschließend wurde zusätzlich die ausdrückliche Aktion „Privaten Entwurf speichern“ erfolgreich ausgeführt.

Die authentifizierte direkte Bildansicht lieferte die tatsächliche WebP-Datei unter der stabilen `/api/media/...`-Adresse. Dieselbe Adresse wurde anschließend ohne Sitzung angefragt und lieferte HTTP 404. Damit sind tatsächlicher Upload, Wiederherstellung, ausdrückliches Speichern, Eigentümerzugriff und Gastverweigerung für dieses private Testbild belegt.

Noch offen bleiben die Veröffentlichung und erneute Sperrung derselben tatsächlichen Datei als vollständiger Browserablauf sowie eine vollständige Anmeldung auf einem echten Mobilgerät. Die entsprechenden Medien-Zustandswechsel wurden bisher im SQL-Integrationstest geprüft. Keine erneute Adminausnahme aktiviert; Testinhalte bleiben ausgeblendet. Die Website-Version ist weiterhin nicht live veröffentlicht.


## Abschluss des Bild-Zugriffstests am 4. November

Mit dem synthetischen Entwicklungskonto wurden die Testorganisation und der Testbeitrag ausdrücklich freigegeben. Das tatsächlich hochgeladene Testbild war anschließend ohne Sitzung über seine stabile Medienadresse erreichbar (HTTP 200, image/webp). Nach dem Ausblenden desselben Beitrags lieferte dieselbe Adresse ohne Sitzung HTTP 404. Beide synthetischen Einträge wurden anschließend in der Adminansicht als „Ausgeblendet“ bestätigt. Keine echten Nutzerinhalte wurden geändert.

Die temporäre lokale Admin-ID wurde nach diesem Test aus dem lokalen Launcher entfernt. Die produktive Adminliste wurde nicht verändert. Die reale Bildprüfung ergänzt die früheren Prüfungen; die bekannten 19 Fehlschläge der vollständigen Baseline-Testsuite bleiben ausdrücklich offen.
