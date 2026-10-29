# Manuelle Adminfreigabe – 29.10.2026

Status: umgesetzt und lokal geprüft; Produktionsmigration erfolgreich aktiviert. Der abhängige Website-Release und seine Live-Prüfung folgen über den vorgeschriebenen Releaseweg.

## Ursache

Die vorherige Fotoänderung entfernte die Bildpflicht, aber nicht die übrigen automatischen Freigabesperren. `loadAdminReview` erlaubte Freigabe nur ohne Vollständigkeitsprobleme und nur bei pending/legacy_review_required. Der Freigabehandler prüfte zusätzlich dieselbe Vollständigkeit wie eine Anbietereinreichung und blockierte unlesbare Bilder. Datenbankfunktion und Trigger verweigerten außerdem die Freigabe eines noch nicht eingereichten, abgelehnten oder ausgeblendeten Entwurfs. Eine getippte Begründung war auch für die ausdrückliche Freigabe erforderlich. Die genaue Ursache des einzelnen Screenshots lässt sich ohne dessen Eintrags-ID nicht abschließend zuordnen; der gezeigte deaktivierte Button hing zusätzlich von canPublish und der Prüfbestätigung ab, nicht vom Begründungstext allein.

## Änderung

- Fehlender Titel, Ort, Kategorie oder Namenszusatz der verantwortlichen Person sind in der Adminprüfung Hinweise und keine automatischen Qualitätssperren. Fehlende oder unlesbare Bilddateien können die ausdrücklich geprüfte Freigabe ebenfalls nicht mehr pauschal blockieren. Tatsächliche Dateifehler werden nach einer Freigabe als Hinweise gemeldet; Dateien werden nicht gelöscht oder ersetzt.
- Eine ausdrückliche Adminentscheidung kann einen Eintrag aus jedem vorhandenen Moderationsstatus freigeben. Ein nicht eingereichter Entwurf erhält einen deutlichen Veröffentlichungshinweis. Es gibt keine Sammelveröffentlichung und keine automatische Freigabe durch die Migration.
- Für Freigabe ist keine zusätzliche Texteingabe nötig. Ohne individuelle Begründung wird wahrheitsgemäß „Freigabe nach manueller Adminprüfung.“ protokolliert. Nachbesserung, Ablehnung und Ausblenden verlangen weiterhin eine verständliche Begründung.
- Technische Sperren bleiben getrennt sichtbar: keine gültige Detailroute, fehlende/privat bleibende Firmenzuordnung oder widersprüchliche Kontozuordnung. Fremde Bildquellen, veraltete Prüffassungen, fehlgeschlagene Rechteprüfung und Nicht-Admins bleiben gesperrt. Es werden keine Anbieteridentitäten erfunden und keine Rechte aus Firmenfunktionen abgeleitet.
- Mitgliedsformulare behalten ihre eigenen Validierungen und Veröffentlichungsregeln. Die bestehende ausdrückliche Eigenveröffentlichung berechtigter Marktplatzanbieter bleibt erhalten.
- Adminhinweise und Bestätigungen wurden in Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch ergänzt. Die neue Regel steht auch in AGENTS.md.

## Tatsächlich geprüfte Abläufe

- Gesamter Testlauf: 807/807 bestanden. Danach zusätzlicher Test gegen unberechtigte direkte Adminfreigabe und erneuter gezielter Lauf: 21/21 bestanden. TypeScript, ESLint für betroffene Komponenten/Module, Übersetzungsprüfung und Produktionsbuild bestanden.
- Tatsächlicher Client und Freigabehandler mit eigener simulierter Authentifizierung und isoliertem PGlite: unvollständigen privaten Locationentwurf ohne Foto und ohne getippte Begründung freigeben, ablehnen, erneut freigeben; Status, Standardbegründung, Verlauf und Benachrichtigungsdatensatz bleiben konsistent. Ablehnung ohne Begründung bleibt im Formular und wird erklärt. Keine Nachricht an echte Mitglieder.
- SQL-Regression: Location, Marktplatzobjekt, Fahrzeug, Tierportfolio, Job und Firmen-Equipment; unterschiedliche Moderationsstatus, exakte freigegebene Revision, erneute Prüfung nach Änderung, veraltete Fassung verweigert, wiederholte Freigabe ohne doppelte Benachrichtigung. Direkte Clientausführung und Tabellenänderungen für anon/authenticated verweigert.
- Browser: deutsche und englische Bedienung; zusätzliche Sprachfassungen sichtbar geprüft. Desktop 1275/1275 CSS-px, mobile Simulation 385/385 und Tablet 815/815: kein Seitenüberlauf laut gerenderter Layoutprüfung. Keine tatsächlichen iOS-/Android-Gerätetests.
- Produktion: geprüfte Migration in Cinegenius · main · PRODUCTION ausgeführt. Ergebnis `admin_decision_applied_verified`, Review-Funktionshash `7afdbd9637fe45a398f14d8fd5dd33b2`. Alle 23 bestehenden Inserate einschließlich 18 öffentlicher Einträge blieben unverändert. Profile, Firmen und Firmen-Equipment wurden zusätzlich per Vorher-/Nachher-Fingerabdruck verglichen. Eigene kurzlebige Testdaten wurden vor Commit zurückgerollt.
- Produktions-SQL-Test: eigenen unvollständigen nicht eingereichten Locationentwurf ausdrücklich freigeben, ablehnen, erneut freigeben; direkte Veröffentlichung außerhalb des Prüfwegs und veraltete Revision verweigert. Funktionsausführung nur für service_role, nicht für anon/authenticated. Die Rolle selbst wird weiterhin am serverseitigen Admin-Endpunkt geprüft.

## Dateien

- `components/admin/AdminReviewDetail.tsx`
- `lib/admin-review.ts`, `lib/admin-review-server.ts`, `lib/admin-review-release.ts`, `lib/admin-review-media.ts`
- `lib/admin-review.test.mjs`, `lib/admin-review-discretion.test.mjs`
- `lib/listing-publication.ts` (nur Kommentar zur Trennung von Anbieter- und Adminprüfung)
- `messages/{de,en,es,it,cs,hu}.json`
- `supabase/migrations/20261029020000_admin_review_discretion.sql`
- `AGENTS.md`, `docs/design-and-release.md`

Browsernachweise im Visualisierungsordner: `admin-discretion-before-approval.png`, `admin-discretion-approved.png` (eigene lokale Testvorschau) und `admin-discretion-production-db.png` (tatsächliche Produktionsmigration). Kein echter Nutzerentwurf wurde zum Test veröffentlicht.
