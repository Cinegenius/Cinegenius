# Organisationen im Personenprofil – Datenbankaktivierung

Die ausdrücklich genehmigte Migration `20261104190000_organization_public_membership.sql` wurde am 4. November 2026 in Supabase Produktion ausgeführt und geprüft.

## Bestätigte Ergebnisse

- Bestehende öffentlich freigegebene Mitgliedschaften unmittelbar nach der Migration: 0.
- Direkter Funktionszugriff für `anon` und `authenticated`: verweigert; für `service_role`: erlaubt.
- Mit synthetischen Daten in einer anschließend vollständig zurückgerollten Transaktion geprüft: standardmäßig private Zugehörigkeit, Zustimmung der aktiven Person, Rücknahme, Ablehnung eines fremden Akteurs, Zurücksetzen beim Beenden, weiterhin private Darstellung nach Reaktivierung und drei passende Protokolleinträge.
- Keine realen Mitgliedschaften oder Inhalte wurden durch die Tests veröffentlicht oder verändert.

## Abgrenzung

Diese Ergebnisse bestätigen die Datenbankregeln. Sie ersetzen nicht den noch ausstehenden abschließenden Browsertest der neuen Oberflächen. Die Aktivierung der Migration allein bedeutet keinen Livegang der vorbereiteten Startseiten- und Profilkomponenten.

Lokaler Sichtnachweis der SQL-Prüfung: `/tmp/organization-visibility-check.png`.
