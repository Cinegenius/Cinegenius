# Gemeinsamer Inaktivitätsablauf für Website und App

Entwurf vom 16. November 2026. Nicht veröffentlicht; weder Migration noch Automatik wurden in Produktion aktiviert. Auftrag: Erinnerungen ab zwölf Monaten ohne Anmeldung, gemeinsame Behandlung für App und Website, AGB/Datenschutzhinweise im selben Änderungssatz.

## Verhalten

- Bei Aufnahme in den aktivierten Ablauf erhalten bestehende und neue Konten eine Kontomitteilung. Bestandskonten erhalten einen neuen vollen Zwölfmonatszeitraum, auch wenn historische Anmeldedaten älter sind.
- Anmeldung und bewusste Nutzung einer bestehenden Sitzung zählen gemeinsam. App-Vordergrund, Seitenaufruf mit Session und echte Interaktion werden gedrosselt gemeldet. Hintergrund-Pings, E-Mail-Öffnungen und anonyme Aufrufe zählen nicht.
- 12 Kalendermonate: erste Erinnerung. 15 Monate: zweite Erinnerung, mindestens 30 Tage nach zugestellter erster Erinnerung. 18 Monate: persönliche Profile und persönliche Angebote ausblenden, mindestens 30 Tage nach bestätigter Zustellung der zweiten Warnung. 24 Monate: Löschvormerkung mit letzter Mitteilung. Frühestens 30 Tage nach deren bestätigter Zustellung: Betreiberprüfung.
- Inaktivität ist keine Feststellung eines unechten Kontos. Es gibt **keine automatische endgültige Kontolöschung**. Vorher müssen Nachrichten, gemeinsame Firmen-/Projektinhalte, offene Vorgänge, Zahlungs-/Vertragsunterlagen und erforderliche Moderationsnachweise gesondert geprüft werden. Der vorhandene allgemeine DELETE-Endpunkt wird für diesen Ablauf nicht verwendet.
- Firmenangebote bleiben unabhängig vom technischen Ersteller bestehen. Die Inaktivitätsblende ist von `ghost_mode` getrennt; Veröffentlichung, Moderationsstatus, private Einstellungen und Originalmedien bleiben unverändert. Wiederkehr hebt ausschließlich die Inaktivitätsblende auf. Öffentliche Profilverweise, persönliche Angebotslisten und geschützte Bildrechte berücksichtigen die Blende sofort.
- Bestätigte Zustellung bedeutet Annahme durch den Mailserver des Empfängers, keine Lesebestätigung. Unbekannte, fehlgeschlagene oder widersprüchliche Zustellung hält Konsequenzen an. Betreiberkonten aus der bestehenden Admin-Allowlist sind ausgenommen.

## Schnittstellen

`GET /api/account/activity`: authentifiziert, nur eigenes Konto, keine Mutation. `POST` auf derselben Route: ohne Body; Konto und Zeit ausschließlich aus geprüfter Session und Server. Native Requests verwenden den vorhandenen Session-/Origin-Vertrag, nicht eine neu erfundene Authentifizierung. Kein User-ID-/Zeitstempel-Parameter. Antworten private/no-store:

```ts
{
  enabled: boolean,
  state: null | {
    stage: 'active'|'reminder'|'warning'|'paused'|'deletion_pending'|'review',
    lastActivityAt: string, reminderAt: string, warningAt: string,
    pauseAt: string, deletionNoticeAt: string, reviewAfter: string|null,
    exempt: boolean
  },
  reactivated?: boolean
}
```

Datumsangaben sind ISO UTC; 12/15/18/24-Monatsdaten sind früheste Schwellen. Verzögerte Zustellung kann Konsequenzen verschieben. 401 fehlende Session, 403 falsche Herkunft, 503 vorübergehend nicht verfügbar. `enabled:false` ist kein Aktivitätsnachweis. Bei Account-/Sessionwechsel Antworten verwerfen und Drossel neu beginnen. Fehler nie als bestätigte Speicherung behandeln. Rückkehr/Vordergrund/Online erlauben Wiederholung; keine künstlichen History-Einträge.

Benachrichtigungstyp `account_inactivity`, Ziel `/dashboard?tab=settings`. Nachrichten werden zentral über vorhandenes Resend erzeugt, zusätzlich kontogebunden im bestehenden Postfach abgelegt. Übersetzungen `AccountActivity` und `NotificationCopy` für alle neun Sprachen. Deutsche Rechts-Ergänzungen in `LegalAuditOriginal` bleiben bis zu geprüften Übersetzungen Originaltext.

`GET /api/admin/account-inactivity` liefert nur Administratoren eine paginierte Liste mit Verfahrensstand und Zustellproblemen. Im vorhandenen Bereich „Konten“ kann ein Fall zur bestehenden Kontoansicht geöffnet werden. Ein Ablauf nach 24 Monaten plus Nachfrist landet dort zur Prüfung; beide konfigurierten Betreiber erhalten dazu eine deduplizierte Postfachbenachrichtigung.

## Betriebsaufnahme und Reihenfolge

1. Änderung inklusive nativer Integration prüfen; aktuellen Main-Abgleich und tatsächliche Veröffentlichung dokumentieren.
2. Rechtstexte und Information bestehender Mitglieder einschließlich wirksamer Einbeziehung geänderter Nutzungsbedingungen prüfen. Eine technische E-Mail ersetzt keine erforderliche Zustimmung. Betreiberfreigabe zur Veröffentlichung bleibt erforderlich.
3. Migration `20261116151505_account_inactivity.sql` vor abhängiger Anwendung einspielen und private Tabellen-/RPC-Rechte, neue Sichtbarkeitsprojektionen und übrige RLS/Medienregeln prüfen. Migration allein nimmt keine Konten auf, blendet nichts aus und löscht nichts.
4. Erst nach erfolgreicher Vorbereitung `ACCOUNT_INACTIVITY_ENABLED=true` in Produktion setzen. Zusätzlich erforderlich: `VERCEL_ENV=production`, vorhandenes `CRON_SECRET`, Resend-Sende- und Leseberechtigung sowie Clerk-Serverzugriff. Previews bleiben inaktiv. Fehlender E-Mail-Schlüssel stoppt den Worker. Für eine vorübergehende Betriebspause den Cron pausieren; die Aktivitätserfassung aktiv lassen, damit zurückkehrende Mitglieder bestehende Inaktivitätsblenden aufheben können. Das Entfernen des gesamten Funktionsschalters ist keine Wiederherstellung bereits ausgeblendeter Inhalte.
5. Bestehenden signierten Clerk-Webhook um `session.created` und erforderliche `user.created`/`user.updated`/`user.deleted`-Ereignisse ergänzen/prüfen. Signaturprüfung bleibt bestehen. Verzögerte Ereignisse behalten ihren ursprünglichen Zeitpunkt. Vordergrundmeldungen und täglicher Clerk-Abgleich dienen als weitere Erfassungspfade.
6. Veröffentlichungsauftrag ausschließlich aus sauberem `main == origin/main` über `npm run deploy:production`, korrektes Projekt prüfen. Vercel-Kostenregeln aus dem kanonischen Serverdokument beachten. Kein zusätzlicher Website-Prüfagent.
7. Der Cron `/api/cron/account-inactivity` läuft um 08:30 UTC täglich und ist secret-geschützt; HEAD mutiert nicht. Ein DB-Lease verhindert parallele Läufe. Laufzeitbudget 42 Sekunden, 100 Clerk-Konten pro Abgleichseite und 40 fällige Vorgänge pro Aufruf; Cursor/Nächstprüfung verhindern dauerhaftes Wiederholen derselben Seite. Ein größerer Rückstand wird über Folgeläufe abgearbeitet, ohne Fristen zu verkürzen.
8. Aktivierung mit kontrolliertem Betreiber-Testkonto über beobachtete Zeitpunkte und separate Testzustände prüfen, niemals reale Konten künstlich altern lassen. Produktionszustellung, App-Gerätetest und vollständiger Release-Build sind getrennte Nachweise.

## Daten und Fehler

Privat gespeichert: Konto-ID, letzter Nutzungszeitpunkt, Zyklus, Stufe, erforderliche Zustellzeitpunkte, Nachfrist und technische Fehlerkategorie. Keine besuchten URLs, Bewegungsdaten oder öffentlichen Aktivitätsverläufe. Gleiche Kontosperre serialisiert Aktivität und Zustandswechsel; alte Versandrückmeldungen können neue Zyklen nicht verändern. Ein unveränderter Versandtext mit stabiler Idempotenz-ID verhindert Duplikate; nach 23 Stunden mit unklarem Versandstatus erfolgt keine blinde Wiederholung.

Nicht mehr benötigte Empfänger/gerenderte Mails werden nach Zustellung nicht fristtragender Mitteilungen, beim Abschluss einer Warnstufe oder bei Rückkehr entfernt. Technische Versanddatensätze ohne Payload werden nach spätestens 90 Tagen bereinigt. Die aktuellen Verfahrens- und erforderlichen Zustellnachweise bleiben bis Abschluss/Prüfung erhalten. Betreiber müssen liegengebliebene Zustellfehler und Löschprüfungen bearbeiten; dies ist kein unbegrenzter Aufbewahrungsgrund.

Eine verifizierte Clerk-Kontolöschung entfernt die privaten Inaktivitätsdaten einschließlich Versand-Payloads unabhängig vom Aktivierungsschalter. Fehlgeschlagene Bereinigung fordert eine Webhook-Wiederholung an. Beim täglichen Abgleich bereinigt ausschließlich ein bestätigtes Clerk-404 den verwaisten Inaktivitätsdatensatz; Berechtigungs-, Netzwerk- oder Anbieterfehler rechtfertigen keine Löschung.
