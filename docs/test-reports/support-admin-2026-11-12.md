# Support, Administration und Vorbereitung auf die App – 12.11.2026

Prüfumfang: Mitglied → Support, Support → Mitglied, ungelesene Nachrichten,
Antrag auf Profilverifizierung, Freigabe/Ablehnung, Status beim Mitglied sowie
betroffene Dialoge und Nachrichtenansichten. Keine echten Mitgliedernachrichten,
Verifizierungen oder Veröffentlichungszustände wurden als Test geändert.

## Belegte Fehler und Korrekturen

- Ein Mitglied konnte zuvor nur auf einen administrativ begonnenen Supportchat
  antworten. Der neue Kontaktweg `/support` eröffnet einen allgemeinen Supportchat,
  auch ohne öffentliches Personenprofil. Doppeltippen und wiederholte Anfragen
  nach einer verlorenen Antwort dürfen keine Nachrichten duplizieren.
- Antworten an die gemeinsame Supportidentität erschienen nicht im normalen
  Admin-Nachrichtenzähler. Ein separat autorisierter, sitzungsgebundener Zähler
  zeigt sie im Adminbereich und dessen Navigation an, ohne sie als gelesen zu setzen.
- Die mobile Nachrichtenliste berücksichtigte nur 56 px unten, die persönliche
  Navigation belegt 64 px zuzüglich Sicherheitsrand.
- Der Admin-Supportchat stand auf schmalen Ansichten unter der langen Liste;
  Verlauf und Antwortfeld hatten keine verlässliche Höhenbegrenzung. Separate
  Listen-/Chatansicht, echte Zurücknavigation und Tastaturabstände beheben dies.
- Ein verspätetes Sendeergebnis konnte nach dem Wechsel in einen anderen
  Supportchat wieder den alten Chat öffnen. Entwürfe und Ergebnisse bleiben nun
  dem jeweiligen Gespräch zugeordnet.
- Abgelehnte Verifizierungsanträge erschienen beim Mitglied als ausstehend;
  erledigte Anträge kehrten in die Adminentscheidungsansicht zurück. Explizite
  Statuswerte und erneute Antragstellung nach Ablehnung ersetzen diesen Zustand.
- Verifizierungsentscheidung und Profilstatus wurden getrennt gespeichert.
  Neue transaktionale Funktionen verbinden Status, Profil, Prüfprotokoll und
  Mitgliedsbenachrichtigung; veraltete Prüfansichten dürfen nichts überschreiben.

## Neue verbindliche Projektregel

`AGENTS.md` verlangt ab jetzt bei jeder Änderung und Prüfung auch die Eignung
für die spätere App: schmale Ansichten ab 320 CSS px, mindestens 44 px große
Berührungsziele, Bildschirmtastatur, sichere Bildschirmränder, zugängliche Dialoge,
echtes Zurück, Lade-/Fehler-/Wiederholungszustände und unterbrochene Eingaben.
Das gemeinsame CineGenius-Design bleibt erhalten. Browserprüfungen ersetzen
keinen Test in einer tatsächlichen iOS-/Android-App.

## Veröffentlichungsvoraussetzungen und Grenzen

Vor dem abhängigen App-Code beide Migrationen anwenden und Rechte prüfen:

- `20261112190000_member_support_contact.sql`
- `20261112191000_verification_review_atomic.sql`

Beide Änderungen sind erneut ausführbar. Sie geben keine vorhandenen Inhalte
frei und löschen keine Profile, Anträge oder Nachrichten. Die Verifizierung
schlägt ohne passende Datenbankfunktion geschlossen fehl.

Beide Migrationen am 12.11.2026 auf CineGenius `main PRODUCTION` angewendet.
Die zusätzliche Supabase-Bestätigung für das Ersetzen der Verifizierungstrigger
wurde unmittelbar vor Ausführung ausdrücklich vom Nutzer erteilt.
Vorher/nachher identisch: 174 Profile, 5 Anträge, 192 Unterhaltungen, 379 Nachrichten.
Profilstatus-Prüfsumme `7efc2de6720f46382e6603ad3aed2a74`, Antragsstatus-Prüfsumme
`9a203da467b0986aeb864a5e9b06e0ed`, jeweils unverändert. Alle vier neuen RPCs
vorhanden, ausschließlich Service-Rolle ausführungsberechtigt; Supportjournal
mit RLS und ohne direkte Leseerlaubnis für Gäste/Mitglieder.

Gemeinsamer Abschlusslauf: 113/113 gezielte Nachrichten-, Support-, Verifizierungs-,
Admin- und Wiederherstellungstests bestanden, einschließlich isoliertem PostgreSQL.
TypeScript sowie Übersetzungs-/Designprüfung bestanden. Neun Sprachkataloge
vollständig ergänzt. Die Tests belegen keine tatsächliche E-Mail-Zustellung.

Safari-Prüfung mit tatsächlichen geänderten Komponenten und ausschließlich
künstlichen Daten: Chatverlauf, sichtbares Antwortfeld und Browser-Zurück in
320- und 390-CSS-px-Iframes, deutsche und schwedische Beschriftungen, lange Namen
und Links, Support-Kompositionsdialog, Begründungsdialog und Escape mit
Fokusrückgabe. Dabei wurde ein zusätzliches reales Layoutproblem gefunden:
Der autohohe Kompositionsdialog ließ dem Mittelteil zu wenig Platz. Eine
ausdrückliche viewportbegrenzte Höhe behebt dies; danach erneut visuell bestätigt
und 11/11 zugehörige Regressionen erfolgreich. Die Vorschau nutzt die echten
Komponenten und gemeinsamen Styles, aber simulierte Daten/Anfragen. Keine
physische Softwaretastatur-, VoiceOver- oder native App-Prüfung.

Safari-Bestandsprüfung: Hilfeseite und Nachrichtenliste erreichbar. Die Liste
zeigt einen bereits bestehenden Supportchat. Zunächst verweigerte das normale
Konto den Adminzugang korrekt. Nach der vom Nutzer bereitgestellten Adminanmeldung
waren Übersicht, Verifizierungen und Supportpostfach erreichbar. Der Widerspruch
zwischen null offenen Anträgen und fünf alten Entscheidungszeilen wurde live
bestätigt. 132 Supportunterhaltungen wurden geladen; ein bereits gelesener eigener
Supportthread zeigte Verlauf und Antwortfeld. Kein Text wurde versendet und keine
Verifizierung entschieden. Ein freigegebenes Testmitglied für den abschließenden
Liveaustausch fehlt. Zustellung echter E-Mails und tatsächliche Smartphone-/
WebView-Nutzung bleiben offen.

Veröffentlicht als Commit `cb7b6816605fe674df34d780e91c2d7e2bcf50f9`,
Vercel `dpl_FbLhAaMPuzJ5R8Mqz6C7w5pbLbDL` (READY). Sowohl `www.cinegenius.co`
als auch die übrigen bestehenden Produktionsdomains zeigen auf diesen Stand.
Nachprüfung in der tatsächlichen Adminanmeldung: Standardfilter ohne offene
Anträge; unter „Alle Anfragen“ die fünf bereits bestätigten Anträge mit Status,
ohne neue Genehmigen-/Ablehnenaktionen und ohne rohe Dokumentverweise.
Das neue Supportformular lädt mit beschriftetem Nachrichtenfeld und deaktiviertem
leeren Sendeknopf; kein Liveversand. Öffentliche Hilfeseite enthält den Supportlink,
Gäste werden für `/support` zur Anmeldung derselben Domain geleitet und der
Adminzähler verweigert Gästen den Zugriff.

Erweiterter Profil-/Benachrichtigungs-/Anmeldetest: 131/131 bestanden. Eine veraltete
Testannahme zur festen Anzahl der Benachrichtigungsvorlagen wurde durch den
strengeren Abgleich der tatsächlichen Index- und Katalogschlüssel ersetzt.
