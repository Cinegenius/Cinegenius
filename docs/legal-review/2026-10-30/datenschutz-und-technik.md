# Datenschutz und technische Anpassungen zur Prüfung

Die folgenden Änderungen sind zur Abstimmung vorbereitet, nicht aktiviert. Bestehende Datenschutzhinweise werden nicht ohne die dazugehörige technische und vertragliche Prüfung ersetzt. Rechtsgrundlagen richten sich nach dem jeweiligen Zweck; die AGB-Zustimmung ist keine universelle Datenschutz-Einwilligung.

## Vor einer Veröffentlichung klären

| Bereich | Beobachteter Stand | Notwendige Änderung oder Nachweis |
| --- | --- | --- |
| Sitzungsaufzeichnung | Client-Sentry konfiguriert Fehler-Replay mit Textmaskierung, ohne globale Mediensperre und ohne Zustimmungssteuerung. Ob in Produktion aufgezeichnet wird, hängt auch von DSN und Providerbetrieb ab. | Vorschlag zur einfachen Bedienung: Replay entfernen/deaktivieren, nicht durch einen umfangreicheren Pflichtbanner ersetzen. Fehlerdaten und Traces getrennt minimieren und Rechtsgrundlage prüfen. Wenn Replay gewünscht wird, erst nach einer nötigen freiwilligen Einwilligung starten; Ablehnung gleichwertig und dauerhaft respektieren. |
| Cookiehinweis | `cg_cookies_ok` quittiert nur den Hinweis. | Nicht als Erlaubnis für Replay oder sonstige optionale Zugriffe auswerten. Den notwendigen Speicherzugriff je Zweck prüfen, nicht allein nach „Cookie oder kein Cookie“. |
| Kontolöschung | Fehler der parallelen Löschaufrufe werden nicht ausgewertet; vollständige Tabellen-, Datei- und Abhängigkeitserfassung ist nicht belegt. | Ein Inventar mit Konto, Profilen, Angeboten, Firmenrollen, Nachrichten, Support, Projekten, privaten Entwürfen, Medien und Dienstleistern erstellen. Ergebnisse prüfen, Fehlversuche wiederholbar bearbeiten, Erfolg erst korrekt melden. Die technische Kontolöschung nicht vor ungesichertem Folgeauftrag als vollständige Datenlöschung ausgeben. |
| Löschfristen | AGB versprechen pauschal 30 Tage und nennen pauschal bis zu 10 Jahre Steueraufbewahrung. | Je Datenklasse Zweck, Rechtsgrundlage, Frist/Endkriterium und Verantwortlichen festlegen; gesetzliche Belege nicht mit sämtlichen Mitgliederdaten gleichsetzen. Backups, Wiederherstellungen und externe Anbieter einbeziehen. Keine ungetestete Komplettlöschung versprechen. |
| Suchverlauf | Suchhistorie lokal; eine ausgeführte Suche verarbeitet den Suchbegriff serverseitig. | Lokale Historie und tatsächliche Suchanfrage sprachlich trennen. Nicht behaupten, Suchbegriffe würden nie an einen Server übertragen. |
| Sprachauswahl | Vorhandener `cg_locale`-Präferenzcookie. | Zweck und Laufzeit konkret prüfen; keine allgemeine Aussage „enthält keinerlei personenbezogene Daten“ für alle Verarbeitungszusammenhänge. |
| Webanalyse | Analytics und Speed Insights eingebunden; Text verspricht vollständige Anonymität und technisch unmögliche Rückverfolgung. | Produktkonfiguration, übermittelte Felder, Speicherdauer, Endgerätezugriffe und Auftragsverarbeitung nachweisen. Beschreibung auf tatsächlich belegte Eigenschaften beschränken. |
| E-Mail und Support | Resend, Systemnachrichten und manuelle Supporterinnerungen. | Sicherheits-/Vertragsnachricht von Werbung nach Inhalt und Zweck unterscheiden. Profil-Erinnerung nicht pauschal als zwingende Vertragserfüllung einstufen. Benachrichtigungspräferenzen und gegebenenfalls Werbeeinwilligung beachten. |
| Private Entwürfe | Onboardingfortschritt in Clerk; weitere kontogebundene private Wiederherstellungs- und Projektentwürfe. | Je Speicherort Zugriff, Aufbewahrung, Verwerfen, Kontowechsel und Löschung zutreffend beschreiben. Keine lokalen Dateien oder Uploadvorschauen als dauerhaft gespeichert darstellen. |
| Anbieter und Übermittlungen | Clerk, Supabase, Vercel, Sentry, Resend; Stripe für vorbereitete Zahlungsfunktionen. | Tatsächliche Regionen, Vertragspartner, Auftragsverarbeitung und Drittlandgrundlagen aus den aktiven Verträgen prüfen. Eine im Text genannte EU-Region ist allein kein technischer Nachweis. Stripe nicht als allgemeine laufende Zahlung oder Treuhand darstellen. |
| Profilaufrufe und Onlinestatus | Ereignisse, Zeitpunkte, Interaktionen und Reaktionen werden verarbeitet. | Daten, Zweck, Sichtbarkeit und tatsächliche Aufbewahrung ausdrücklich behandeln; keine Beschreibung als ausschließlich anonyme Summen, wenn Personenbezug möglich ist. |

Rechtliche Grundlagen für Einwilligung, Transparenz, Löschung und technische Gestaltung: [DSGVO bei der Berliner Datenschutzaufsicht](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/gesetzestexte/2025-BlnBDI_DSGVO.pdf), insbesondere Art. 5–7, 12–13, 17, 21, 25, 28 und 44 ff. Endgerätezugriffe sind zusätzlich nach [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html) zu prüfen. Der vorhandene Browserhinweis allein schafft diese Voraussetzungen nicht.

## Berechtigungen und Medien

Die neue Textfassung darf keine öffentliche Lizenz für private Inhalte suggerieren. Neue Uploads verwenden bereits private Speicherung mit stabiler, berechtigungsgeprüfter Medienadresse. Entscheidend bleiben der tatsächliche Ursprung, aktueller Status und erlaubte Betrachter, auch vor Auslieferung einer Vorschau. Die vorhandene Erlaubnisliste für „Frische Einblicke“ bleibt auf Profile und Firmen beschränkt.

Bei älteren öffentlichen Speicheradressen können öffentliche Originalkopien fortbestehen, auch wenn die Website ihre Karte nicht mehr zeigt. Solche Fälle benötigen einzeln geprüfte Umstellung mit Erhalt des Originals und Bereinigung alter öffentlicher Cachevarianten. Diese Rechtsprüfung führt keinen pauschalen Dateiumzug und keine Löschung von Nutzerbildern aus.

## Kleine technische Arbeitspakete nach Freigabe

1. **Anfragebestätigung:** `app/booking/checkout/page.tsx` darf bei nicht erfolgreicher API-Antwort keine Ersatzreferenz erzeugen. Eingaben erhalten und Fehler zeigen. Zahlungsschritt und Nachricht „hat gebucht“ auf den tatsächlichen Anfragevorgang abstimmen. Mit abgelehntem, langsamem und erfolgreichem Speicheraufruf testen.
2. **Löschung:** Ein explizites Löschinventar und nachweisbare Ergebnisse statt ignorierter `allSettled`-Resultate. Besitzwechsel/weitere Firmenverantwortliche, Rechte anderer Gesprächsbeteiligter und gesetzliche Aufbewahrung getrennt behandeln. Erst Dry Run und eigene Konten; keine pauschale Sofortlöschung fremder Daten.
3. **Sentry:** Optionales Replay zunächst ausgeschaltet vorbereiten; technische Fehlerdiagnose davon trennen. Eine gewünschte Aufnahme erst nach geprüfter Grundlage und, soweit nötig, wirksamer Zustimmung. Produktionskonfiguration und Netzwerk mit synthetischen Eingaben kontrollieren.
4. **Rechtehinweis:** Vorbereitete `ContentUsageNotice` in vorhandene Uploadabschnitte integrieren. Status und Herkunft ausdrücklich vom Aufrufer übergeben. Kein Eingriff in Validierung, Bildpflicht oder Veröffentlichungsrechte. Keine zusätzliche Bestätigung bei gewöhnlichen Fotos.
5. **Rechtstextfassung:** Eine unveränderbare, veröffentlichte Fassung samt Versionskennung archivieren. Nur wenn eine Zustimmung erforderlich ist, authentifiziert und serverseitig die konkret angezeigte Fassung und Zeit erfassen. Clientangaben nicht als frei setzbaren Nachweis übernehmen.
6. **Meldungen:** Vorhandene Moderation um einen ohne Mitgliederkonto nutzbaren elektronischen Weg für alle Inhaltstypen ergänzen. Präzise Quelle, Grund, Kontakt und Erklärung nach bestem Wissen ermöglichen; Empfang, Entscheidung, Begründung und Überprüfungsweg nachvollziehbar machen. Missbrauchsschutz darf berechtigte Meldungen nicht unzumutbar erschweren.

## Keine neue Komplexität für normale Mitglieder

Keine Marketingabfrage im Onboarding. Keine wiederholten Bildrechtehäkchen bei jedem Foto. Keine neue Fotopflicht. Der unverbindliche Uploadhinweis ist keine zusätzliche Einwilligung und löst keinen Speicheraufruf aus. Rechtlich erforderliche, einmalige Vertragszustimmungen und konkrete Rechteklärung bei begründeten Zweifeln sind davon zu unterscheiden.
