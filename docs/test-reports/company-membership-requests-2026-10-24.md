# Firmenzugehörigkeit und Team-Anfragen – 24.10.2026

## Änderungen

- Der dauerhaft sichtbare Beitrittsblock auf öffentlichen Firmenprofilen wurde durch „Weitere Aktionen“ ersetzt. Erst dort öffnet sich ein Dialog mit auswählbaren Funktionen, eigenen Berufsbezeichnungen und optionaler Nachricht. Firmenzugehörigkeit wird ausdrücklich von einer Jobbewerbung unterschieden.
- Beitrittsanfragen bleiben `pending`. Öffentliche Firmenprofile, persönliche Profile und Teamzähler berücksichtigen ausschließlich bestätigte Mitgliedschaften. Die angefragte Funktion vergibt keine CineGenius-Verwaltungsrechte.
- Firmenverantwortliche sehen offene Beitritts- und Funktionsänderungsanfragen im Dashboard unter Team → Anfragen. Sie können Funktionen vor der Freigabe anpassen, annehmen oder ablehnen. Benachrichtigungen öffnen diesen Bereich direkt.
- Bestätigte Mitglieder können Funktionsänderungen anfragen und zurückziehen. Die bisherige öffentliche Funktion bleibt bis zur Firmenentscheidung aktiv. Firmenverantwortliche werden über Änderungen informiert.
- Rückzug und Annahme sind gegen konkurrierende Änderungen abgesichert. Abgelehnte oder zurückgezogene Beitrittsanfragen können erneut gestellt werden.
- Neue Datenbankmigration: `supabase/migrations/company_membership_approval_requests.sql`. Sie ergänzt private Anfragetexte und eine zugriffsgeschützte Tabelle mit atomarer Freigabe von Funktionsänderungen.

## Automatisierte Prüfungen

- `npm test`: **485 bestanden, 0 fehlgeschlagen**.
- Gezielter ESLint-Lauf über geänderte Anwendungsdateien: **0 Fehler**; 1 Hinweis auf ein bestehendes `<img>` in `CompanyDetail.tsx`.
- `npm run check:design`: bestanden.
- `git diff --check`: bestanden.
- `npm run build`: erfolgreich, einschließlich TypeScript-Prüfung und Erstellung aller App-Routen.

## Noch nicht verifiziert

- Keine Anfrage wurde mit realen Konten oder gegen die Live-Datenbank angelegt, angenommen, abgelehnt oder zurückgezogen. Es stand kein isoliertes Testprojekt mit Testkonten zur Verfügung; Produktionsdaten wurden nicht verändert.
- Smartphone-, Tablet- und Desktop-Browserabläufe wurden nicht visuell end-to-end geprüft.
- Die Migration wurde noch nicht auf Supabase Production angewendet oder dort verifiziert. Die passende Website-Version darf laut Releasevorgabe erst nach erfolgreicher Migration veröffentlicht werden. Diese Dokumentation bestätigt daher keinen Live-Stand.
