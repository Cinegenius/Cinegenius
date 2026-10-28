# Verbindliche Inseratsfreigabe — 28.10.2026

Stand: lokal implementiert und geprüft, **nicht in Produktion angewendet oder veröffentlicht**. In der Produktionsdatenbank wurden ausschließlich SELECT-Abfragen ausgeführt. Die zuvor begonnene private Formularwiederherstellung bleibt erhalten.

## Konkreter Produktionsbefund

Das gesuchte Konto heißt in den gespeicherten Profildaten „Sebastian Eichiner“. Vier persönliche Marktplatzinserate sind öffentlich, jeweils ohne Firmenzuordnung:

| Titel | Erstellt am 28.10.2026 (Europe/Berlin) | ID |
| --- | --- | --- |
| Lumenradio Stardust CRMX | 14:43:04 | 9cc1efe1-cea2-494d-bcef-86ee2d2f2ba5 |
| grandMA3 TourPack | 14:46:05 | 734ef2e0-959c-49f1-8935-c186d1b07b1b |
| DMX nodes 4 Port | 14:47:52 | 41c0c48b-6777-4ba4-9101-e5bc714548bb |
| Installationstester Fluke 1664 FC | 14:49:47 | 0ad11e1a-fb2c-490b-b4fa-e112259fceaa |

Zu diesen vier IDs liefert `admin_audit_log` keine erfolgreiche Adminaktion. `updated_at` ist nicht vorhanden/belegt; ein genauer ursprünglicher Veröffentlichungszeitpunkt und der damalige HTTP-Aufruf sind daher aus diesen Daten nicht rekonstruierbar. Der normale Erstellungsweg erklärt den Befund vollständig; es gibt keinen Nachweis für ein bewusstes Umgehen durch den Nutzer.

Bestätigte Ursachen:

- Der normale POST nach `/api/listings` setzte alle Typen außer Jobs ohne ausdrücklichen Entwurfswunsch sofort auf `published=true`.
- Die bisherige Eigentümeraktion `/api/listings/[id]/publish` veröffentlichte nach einer Vollständigkeitsprüfung selbst, ohne Adminentscheidung.
- Eigentümer konnten bereits öffentliche Texte und Bilder austauschen, ohne die Freigabe zu verlieren.
- `listings.published` und `company_equipment.published` hatten in Produktion den Standardwert `true`.
- Die vorhandenen Listing-Trigger dienten der Medienzuordnung; eine verbindliche Moderationssperre fehlte.
- Die frühere versionsgeprüfte Adminfreigabe sicherte nur den Adminweg. Andere Schreibwege mussten sie nicht durchlaufen.

19 Listing-Datensätze waren beim Abgleich öffentlich. Bei 14 fehlt eine erfolgreiche Aktion `listing_publish` oder `offer_approve`. Fünf haben einen älteren Veröffentlichungseintrag; dieser ist kein Nachweis einer heute identischen geprüften Inhaltsfassung. `company_equipment` enthält derzeit keine Datensätze.

## Bestandsfälle zur individuellen Entscheidung

Diese 14 öffentlichen Inserate haben keinen gefundenen Freigabenachweis. Keine davon wurde verändert, entfernt oder ausgeblendet:

| Titel | Typ | ID |
| --- | --- | --- |
| Installationstester Fluke 1664 FC | prop | 0ad11e1a-fb2c-490b-b4fa-e112259fceaa |
| DMX nodes 4 Port | prop | 41c0c48b-6777-4ba4-9101-e5bc714548bb |
| grandMA3 TourPack | prop | 734ef2e0-959c-49f1-8935-c186d1b07b1b |
| Lumenradio Stardust CRMX | prop | 9cc1efe1-cea2-494d-bcef-86ee2d2f2ba5 |
| Steadicam | prop | b821c122-51b3-4173-9744-1b9637e4a1d5 |
| Set Al Equipment Verkauf | prop | 879c86a6-2cd5-4a82-8794-a7b1913dddf9 |
| Arri | animal | 44001060-bf02-4988-8ef2-747d0d2c954a |
| Zusatzbeleuchter*in | job | c70d9940-1d4d-47f5-a6f0-c307492e86dc |
| Lichtassistent*in | job | 2f543c0f-9990-4146-ab2b-b2e292980f00 |
| ARRI M18 | prop | e81b177c-5573-4783-884e-6a13516ac52c |
| APC MINI | prop | 4e81abfb-6bcd-43d6-92ef-b3a5452e60c8 |
| Aputure Sidus One | prop | 3e7ad16c-9472-451b-88fc-b73b183bcd60 |
| Schule | location | b0846578-bbc8-4c66-b29e-f42d051dc311 |
| Flitze | vehicle | 072738c9-c816-4a06-80bf-0a37ff9a4b81 |

Die vorbereitete Migration kennzeichnet alle 19 bisherigen öffentlichen Datensätze als `legacy_review_required`, ohne `published` zu ändern und ohne rückwirkend eine Freigabe zu erfinden. Die Adminprüfliste kann diese Bestandsfälle gezielt anzeigen. Erst eine individuelle neue Entscheidung erzeugt einen belastbaren Nachweis der geprüften Revision.

## Umsetzung

### Datenbank und Schreibwege

`20261028200000_offer_moderation.sql` ergänzt kompatible Status-, Revisions- und Zeitfelder an `listings` und `company_equipment`. Neue Datensätze sind standardmäßig privat. Der Datenbanktrigger verhindert direkte Selbstveröffentlichung und setzt wesentliche Inhaltsänderungen unabhängig vom jeweiligen API-Schreibweg wieder auf privat. Einreichen, Freigeben, Nachbesserung, Ablehnen und Ausblenden werden protokolliert.

Die servicegeschützte Funktion `offer_review_transition` sperrt und vergleicht den vollständigen zu prüfenden Datensatz und die aktuelle Anbieterzuordnung. Nur der serverseitig geprüfte Adminweg kann genehmigen. Inhaltsrevision, Status, Adminprotokoll und Entscheidungsmeldung werden in derselben Transaktion gespeichert; bei einem Fehler wird die gesamte Entscheidung zurückgerollt. Ein Wiederholungsversuch erzeugt keine zweite Entscheidung für denselben alten Stand.

Direkte Lese- und Schreibzugriffe der Datenbankrollen `anon`, `authenticated` und `PUBLIC` auf die Angebotstabellen bleiben entsprechend der bestehenden Serverarchitektur gesperrt, einschließlich alter Spaltenrechte. Unerwartete geerbte Spaltenrechte brechen die Migration ab. Es werden keine privaten Entwürfe über eine alte großzügige RLS-Leseregel geöffnet. Bestehende serverseitige Konten- und Firmenberechtigungen gelten weiterhin; ein ehemaliger technischer Firmenersteller behält ohne aktuelle Berechtigung keinen Zugriff.

Der bisherige Eigentümer-Endpunkt `publish` reicht nun ausschließlich zur Prüfung ein. Reguläre Erstellung sowie Firmen-Equipment setzen `published=false`. Manipulierte Freigabe-/Revisionsfelder werden abgelehnt. Titel, Beschreibung, Fotos, Preis, Anbieterzuordnung und weitere wesentliche Angebotsdaten lösen eine neue Prüfung aus.

Eine parallele alte öffentliche und neue private Inhaltsversion existiert im bestehenden Datenmodell nicht sicher. Deshalb wird eine wesentlich geänderte Fassung bis zur erneuten Freigabe ausgeblendet; der Anbieter erhält vor der Bearbeitung einen entsprechenden Hinweis. Ablehnungen können nachgebessert und erneut eingereicht werden. Ein dauerhaftes Kontoverbot ist nicht Teil dieser Funktion.

### Öffentlichkeit, Vorschau und Verwaltung

Die gemeinsamen öffentlichen Abfragen verwenden weiterhin `published=true`; dessen Bedeutung wird nun in der Datenbank erzwungen. Geprüft wurden die Abfragestellen für Startseite, Verzeichnisse, Suche, öffentliche Anbieterangebote, Sitemap, Angebotsdetailseiten und Buchungs-/Bewerbungszugriffe. Gespeicherte Favoriten werden gegen die aktuelle öffentliche Zuordnung aufgelöst; ein privates Angebot bleibt nicht über veraltete Favoritendaten sichtbar. Eigentümer dürfen ihre geschützte Locationvorschau weiterhin öffnen.

Die vorhandene vollständige Adminprüfansicht bleibt erhalten: zugeordnete Fotos, vollständige Angaben, tatsächlicher Anbieter, verantwortliche Person und technische Erstellung. Hinzu kommen Statusauswahl, Begründung, Revisionsverlauf und die Entscheidungen Freigeben/Nachbesserung/Ablehnen/Ausblenden. Die Entscheidung betrifft exakt die geprüfte Fassung. Die Prüfliste ist nach Status filterbar, auch für Firmen-Equipment. Die Startseitenhinweise für neue und alte Listing-Einträge führen zur passenden Listing-Prüfliste; Firmen-Equipment ist als eigene Quelle wählbar.

Eigene Angebote und eigene Jobs zeigen den aktuellen Status und eine Begründung. Erstellung und Einreichung versprechen keine sofortige öffentliche Sichtbarkeit. Neue Texte liegen in Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch vor. Firmenprofile selbst behalten ihre bisherige gesonderte Veröffentlichung; diese Änderung gilt ihren Inseraten, nicht einer neuen pauschalen Firmenfreigabe.

### Betroffene Dateien dieser Korrektur

- Zentrale Regeln: `lib/offer-moderation.ts`, `components/OfferModerationStatus.tsx`, neue Migration `supabase/migrations/20261028200000_offer_moderation.sql`.
- Anbieter-Schreibwege: `app/api/listings/route.ts`, `app/api/listings/[id]/route.ts`, `app/api/listings/[id]/publish/route.ts`, `app/api/company-equipment/route.ts`, `app/api/company-equipment/[id]/submit/route.ts`, `lib/listing-access.ts`.
- Adminprüfung: `lib/admin-review.ts`, `lib/admin-review-server.ts`, `lib/admin-review-release.ts`, `app/api/admin/reviews/route.ts`, `app/api/admin/reviews/[kind]/[id]/route.ts`, `app/api/admin/listings/route.ts`, `app/api/admin/overview/route.ts`, `components/admin/AdminReviewDetail.tsx`, `components/admin/AdminReviewQueue.tsx`, `app/admin/page.tsx`.
- Anbieteroberfläche: `app/inserat/page.tsx`, `components/GuidedListingWizard.tsx`, `app/dashboard/page.tsx`, `app/company-dashboard/DashboardClient.tsx`.
- Sichtbarkeit: `app/api/favorites/route.ts`, `app/locations/[slug]/page.tsx`.
- Übersetzungen: alle sechs `messages/*.json`-Kataloge.
- Tests: neue `lib/offer-moderation{,-db,-media-db}.test.mjs`; bestehende Admin-/Preis-/Anbieteridentitäts-Testfixtures für die neuen Importe und privaten Standardwerte aktualisiert. Bestehende Aussagen nicht entfernt.
- Dauerhafte Projektregel und Veröffentlichungshinweise: `AGENTS.md`, `docs/design-and-release.md`.

Weitere Änderungen im Arbeitsverzeichnis gehören zur zuvor begonnenen privaten Formularwiederherstellung. Sie wurden nicht zurückgesetzt und sind ebenfalls noch nicht veröffentlicht.

## Tatsächlich bestandene Prüfungen

### Automatisiert

- Vollständige Testsuite: **741 bestanden, 0 fehlgeschlagen**. Ein anschließender gezielter Datenbanklauf ergänzt echte `SET ROLE`-Versuche für Gast und Mitglied innerhalb desselben Tests.
- Produktionsbuild erfolgreich, einschließlich TypeScript.
- Übersetzungsprüfung: sechs Kataloge, 1491 Schlüssel, gleiche Platzhalter, keine neu fest eingebauten UI-Texte. Vorhandene allgemeine Übersetzungslücken außerhalb dieser Änderung bestehen weiter.
- Gemeinsame Designprüfung und `git diff --check` erfolgreich.
- Tatsächliche neue SQL-Migration in isoliertem PGlite/PostgreSQL ausgeführt: private Standardwerte, Bildzuordnung vor Freigabe, Einreichen, ausdrückliche Freigabe, Versionsvergleich, erneute Prüfung bei Titel/Text/Fotos/Preis, Ablehnung/Nachbesserung/erneute Einreichung, Rücknahme einer öffentlichen Freigabe durch Ausblenden, atomarer Audit-/Meldungsfehler und nicht übertragbarer Freigabekontext.
- Gate für Locations, Marktplatz, Fahrzeuge, Jobs, Creator-/Tier-Inserate sowie Firmen-Equipment geprüft. Das Gate ist typübergreifend; es fügt keine neuen Inseratstypen hinzu.
- Tatsächliche API-Handler mit kontrollierten Abhängigkeiten: Eigentümeraufruf kann nur einreichen, gefälschter Aktions-/Adminwert wird nicht übernommen, Gäste/fremde Mitglieder werden abgewiesen, bereits eingereichte Datensätze erzeugen keine zweite Einreichung, normaler Nutzer kann den Adminweg nicht aufrufen, ehemaliger Firmen-Ersteller verliert Zugriff.
- Datenbankrollenprüfung: Gäste und Mitglieder können Angebotstabellen weder direkt lesen noch `published=true` setzen oder die Freigabe-RPC ausführen. Auch alte Tabellen-/Spalten-/PUBLIC-Rechte werden entfernt.
- Tatsächliche bestehende Medienmigrationen zusammen mit dem neuen Gate getestet: Original und Thumbnail prüfen den kanonischen Elternstatus. Privates Listing bleibt auch bei einer Profilspiegelung privat; Freigabe erlaubt den Zugriff, Änderung und Ausblenden sperren ihn wieder. Ein alter URL-Wert umgeht diese neue Prüfung nicht.

### Browser mit eigenen Testdaten

Lokale Prüfvorschau aus der tatsächlichen `AdminReviewDetail`-Komponente und dem tatsächlichen Freigabehandler, verbunden mit der tatsächlichen neuen SQL-Funktion in einer isolierten Datenbank. Authentifizierung, Quelldatenadapter und Bilddateiauslieferung sind kontrollierte Testadapter. Keine echten Mitglieder wurden angeschrieben, keine Produktionsangebote verändert.

Durchlaufen:

1. Eigenes eingereichtes Testinserat: öffentlicher Zugriff nicht gefunden, Status `pending`.
2. Begründung und Prüfbestätigung → Freigabe: öffentlich, ein Protokollereignis und genau eine Entscheidungsmeldung.
3. Inhaltsänderung → `pending`, nicht mehr öffentlich.
4. Nachbesserung verlangen → Begründung gespeichert, nicht öffentlich.
5. Korrigieren → privater Entwurf; erneut einreichen → `pending`.
6. Inserat ändern, während die alte Adminfassung noch offen ist → Freigabe verweigert mit Aufforderung, den aktuellen Stand zu laden.
7. Ablehnen → erneut einreichen → korrigierte Fassung freigeben.
8. Neuladen erhält Freigabestatus und vollständigen Verlauf. Vier erfolgreiche Testentscheidungen erzeugten vier Meldungen, die gescheiterte veraltete Entscheidung keine zusätzliche.
9. Sechs Prüffotos öffnen, weiterblättern und per Tastatur navigieren/schließen.
10. Komponentenbreiten 320/390/820 und Desktop geprüft; gemessene Dokumentbreite entspricht jeweils der verfügbaren Breite. Neue Status-/Aktionsbeschriftungen in allen sechs Sprachen geprüft, Nutzereingaben bleiben unverändert.

Dies waren **Browsersimulationen**, keine echten iPhone-/Android-/Tablet-Gerätetests. Die Vorschau verwendet synthetische Fotos; sie beweist keinen echten Supabase-Datei-Upload. Anmeldung/erneuter Login, Upload über das echte Storage-System, reale Benachrichtigungszustellung und der komplette Weg durch das produktive Erstellungsformular müssen vor der Veröffentlichung mit eigenen Live-Testkonten geprüft werden.

## Noch vor der Live-Veröffentlichung

1. Die vorbereitete Datenbankänderung und den passenden App-Release koordiniert ausführen. Ein alter App-Stand, der weiterhin direkt veröffentlichen möchte, scheitert nach der Migration bewusst geschlossen. Die ebenfalls offene Formularentwurfs-Migration berücksichtigen.
2. Produktionsrechte, neue Spalten/Trigger/RPC, PostgREST-Schema und ein eigenes vollständiges Testangebot mit Anmeldung, Fotos, Einreichung, Adminvorschau und Freigabe prüfen.
3. Echte Geräte und reale Eigentümer-/Firmen-/Admin-Sitzungen ergänzen. Keine fremden Inserate für Tests verwenden.
4. Die 19 Bestandsfälle individuell entscheiden. Aus einem fehlenden alten Protokolleintrag folgt kein Fehlverhalten eines Mitglieds.
5. Bereits früher öffentlich gespeicherte Originaldateien werden durch einen privaten Datenbankstatus nicht rückwirkend geheim. Geschützte `/api/media/...`-Dateien beachten die aktuelle Freigabe; ältere öffentliche Storage-Kopien benötigen gegebenenfalls eine gesonderte, geprüfte Umstellung. Bereits heruntergeladene Dateien lassen sich nicht zurückholen.

Keine Produktionsmigration, kein Commit/Push und kein Deployment wurden für diese Korrektur ausgeführt.
