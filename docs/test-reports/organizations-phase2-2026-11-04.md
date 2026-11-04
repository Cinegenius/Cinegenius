# Organisationen: Zusammenarbeit – 4. November 2026

Status: Anwendung lokal implementiert, noch nicht veröffentlicht. Die genehmigte Migration 20261104150000_organization_collaboration.sql wurde in Produktion ausgeführt.

## Änderungen
- Organisationsinhaber können zeitlich begrenzte, an eine bestätigte Konto-E-Mail gebundene Einladungslinks erstellen und zurückziehen. Kein automatischer E-Mail-Versand.
- Annahme erteilt Organisationsverwaltung; Ablehnung, Austritt und Entfernen sind berücksichtigt. Die Inhaberschaft ist geschützt.
- Eine Verknüpfung mit einer veröffentlichten Firma benötigt deren Bestätigung und vergibt keine zusätzlichen Firmenrechte.
- Verwaltung im Organisationsdashboard, Anfragen im Firmendashboard, bestätigte öffentliche Firmenverknüpfung auf der Organisationsseite.
- Serverseitige Rechteprüfung, private Antworten, gehashte Einladungstoken, Ablaufzeit, atomare Zustandsänderungen und Aktionsprotokoll.
- Neue Texte in de/en/es/it/cs/hu.

Betroffene Dateien: app/api/organizations/access/route.ts; app/organization-invitations/[token]/page.tsx; app/company-dashboard/page.tsx; app/organizations/[slug]/page.tsx; components/organizations/OrganizationDashboardClient.tsx; OrganizationAccessPanel.tsx; OrganizationInvitation.tsx; messages/*.json; lib/organization-collaboration.test.mjs; oben genannte Migration.

## Tatsächlich geprüft
- 23 gezielte Organisationstests erfolgreich, darunter sechs Tests der neuen SQL-Zustandsübergänge: falscher Empfänger/Token, Annahme und Wiederholung, Austritt, geschützter Inhaber, doppelte/abgelaufene/zurückgezogene/abgelehnte Einladungen, Firmenrechte, fehlender Firmeninhaber, private Firmen, Duplikate und Audit-Rollback.
- TypeScript-Prüfung erfolgreich.
- Übersetzungsprüfung für sechs Kataloge erfolgreich; dies bestätigt keine vollständige Übersetzung der gesamten Plattform.
- Produktions-Build einschließlich der Umbruchkorrektur erfolgreich; der abschließende Build erfolgt zusätzlich im geschützten Veröffentlichungsablauf.
- Nach dem Austritt entfernt die Oberfläche Organisation und Beiträge unmittelbar aus dem lokalen Zustand. Die abschließende Änderung bestand erneut 23 Organisationstests, TypeScript und die Übersetzungsprüfung.
- Vorübergehende lokale Adminfreigabe entfernt; kein Testkonto in die Live-Adminliste aufgenommen.
- Produktionsdatenbank: Rechte für anonyme und normale Datenbankrollen gesperrt, Ausführung nur für die Serverrolle geprüft. Transaktionaler Test mit synthetischer Organisation bestanden: Empfängerbindung, Annahme, Wiederholungsschutz, Inhaberrechte, Austritt, Rücknahme und fünf Protokolleinträge. Alle Testschreibvorgänge anschließend zurückgerollt.
- Lokale Browserdarstellung mit Testdaten: Desktop und auf 390 px begrenzter Inhaltsbereich. Einladungslink-Erstellung gegen simulierte API geprüft. Lange Namen nach Umbruchkorrektur sichtbar vollständig. Dies ist keine echte Smartphone- oder Mehrkonten-Integration.
- Safari mit echter Entwicklungssitzung und Testorganisation: Einladungslink erstellt, nach erneutem Öffnen weiterhin vorhanden; Aufruf mit falschem Konto verweigert; Einladung zurückgezogen und nach Neuladen weiterhin entfernt. Dabei wurde keine E-Mail versendet. Eine zweite Einladung wurde mit dem Yahoo-Entwicklungskonto angenommen. Der Verwaltungszugriff blieb nach Neuladen erhalten. Anschließend trat dieses Konto aus; nach Neuladen waren Organisation und Beitrag nicht mehr zugänglich.

## Grenzen der Prüfung
- Ablehnung und Firmenbestätigung sind auf SQL-Ebene geprüft, aber noch nicht vollständig im Browser durchgespielt. Ein separates Entfernen durch den Inhaber und erneute Anmeldung nach dem Austritt wurden nicht nochmals im Browser geprüft.
- Browserprüfung der übrigen Sprachen und tatsächlicher mobiler Ansicht.
- Keine Nachrichten an echte Mitglieder versendet, keine bestehenden Mitgliedschaften oder Firmen geändert.
