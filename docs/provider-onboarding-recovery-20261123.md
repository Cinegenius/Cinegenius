# Anbieter-Einrichtung: Wiederaufnahme und klare Abschlüsse

Stand: 23. November 2026, **veröffentlicht und um 15:29 Uhr Berlin geprüft**.
Markus hat „Ja, Anbieter-Korrekturen live stellen“ ausdrücklich bestätigt.
`3fba2f9693fd827769b0469d648d51988f3b11ec` wurde von sauberem `main == origin/main`
über den geschützten Releaseweg veröffentlicht; `dpl_552yw4ges7E1xMRMAmkWq98ym1cL`
ist READY und `www.cinegenius.co` zeigt genau diese Fassung. Die vorherige
Profil-/Verifizierungs-/Avatar-Korrektur bleibt enthalten.

## Bestehende Konten und Profile

- Marktplatz und Locations legen in der Ersteinrichtung ein Anbieterprofil mit
  `equipment` beziehungsweise `location` an. Tätigkeiten, Foto und erstes Angebot
  sind dafür keine Pflicht. Ein Profil kann beide Anbieterbereiche enthalten.
- Firmen erhalten ein Firmenprofil und eine kontogebundene verantwortliche
  Person. Dafür wird kein öffentliches persönliches Crewprofil erzwungen.
- Dasselbe Konto kann später unter `/profile` ein persönliches Profil anlegen
  oder das bestehende Anbieterprofil um Crew-Bereiche und Tätigkeiten erweitern.
  Anbieterarten sind kombinierbar; Firmen und Angebote bleiben eigene Datensätze
  mit ihren bisherigen Zuordnungen und Rechten. Es wird kein zweites Konto
  benötigt und durch diesen Korrekturkandidaten kein Profil automatisch ergänzt.

## Behobene Fälle

| Einstieg | Befund und Korrektur |
| --- | --- |
| Gemeinsame Ersteinrichtung | Eine fehlgeschlagene Namensspeicherung verließ den Wechsel ohne sichtbare Fehlerbehandlung. Fehler bleiben nun sichtbar, Eingaben erhalten und „Weiter“ wieder bedienbar. |
| Lesen und Zwischenspeichern | Netzwerk und Antwortkörper erhalten eine Frist; nicht lesbare Erfolgsantworten zählen nicht als gespeicherte Daten. Ein gescheiterter Wiederaufnahmelesezugriff öffnet einen Wiederholweg, ohne einen leeren Ersatz zu speichern. |
| Firmenassistent | Im echten Browser löste der Wechsel von Schritt 2 zur Übersicht durch den wiederverwendeten Submit-Knopf bereits einen POST aus. Getrennte Knöpfe und unterdrückte Standardaktion halten die Übersicht ohne Schreibzugriff. Erst der bewusste Abschluss speichert. |
| Firma speichern | Sofortiger Schutz gegen Doppelklick, bestätigte private Sicherung samt stabilem Erstellungsschlüssel vor POST; derselbe Schlüssel bleibt bei Wiederholung erhalten. Fehlende Basisangaben führen zum passenden Feld. |
| Marktplatz/Locations geführt | Bestehende Wiederaufnahmeschlüssel und private Entwürfe bleiben erhalten. Nur bestätigte Speicher-/Veröffentlichungsantworten zeigen Erfolg; eine unklare Antwort lässt Wiederholen zu. |
| Allgemeines Inserat | Hängende Erstellung gibt die Bedienung wieder frei, unlesbare Antworten löschen keinen Entwurf. Ein bereits gespeicherter Drehort wird sofort gezeigt; spätere Entwurfsbereinigung blockiert den Abschluss nicht. |
| Optionaler Grundriss | Netzwerk-/Uploadfehler beenden den Ladezustand und geben die Auswahl wieder frei. |

Normale JSON-Anfragen sind auf 20 Sekunden begrenzt, große Uploads auf 90
Sekunden. Keine automatische Wiederholung von Schreibzugriffen. Ein Timeout ist
kein Beleg, dass der Server nicht gespeichert hat. Der Firmen-/geführte
Angebotsweg nutzt vorhandene serverseitige Wiederholungsschlüssel. Der allgemeine
Inseratweg erhält in diesem Paket keinen neuen serverseitigen Idempotenzvertrag;
sein Schutz verhindert gleichzeitige Klicks, nicht sämtliche möglichen Duplikate
nach einem verlorenen Ergebnis. Auch ein nachträglich geänderter Firmenname kann
die bestehende namensabhängige Zuordnung des Firmenschlüssels verändern.

Pflichtangaben, Konto-/Eigentumsrechte, Bildprüfung, Freigabe und Datenschutzregeln
bleiben bestehen. Keine SQL-Migration, Anbieteraktivierung oder Nutzerdatenkorrektur.

## Prüfungen und Grenzen

- 208 gezielte automatisierte Fälle bestanden; zwei zusätzliche Fälle prüfen den
  fehlgeschlagenen optionalen Grundriss-Upload (zusammen 210 verschiedene Fälle).
- TypeScript und Sprachprüfung: 17 Kataloge, 11.623 Schlüssel, keine neuen
  ungeprüften Oberflächentexte. 17 verpflichtende Design-/Geometrieprüfungen plus
  gemeinsame Designregeln bestanden.
- 36 Browserfälle in allen 17 Sprachen bestanden, bei 320/393 Pixeln und zusätzlich
  Deutsch/Spanisch bei 1440 Pixeln, ohne horizontales Überlaufen oder Seitenfehler.
  Sie verwenden die tatsächliche Firmen-Seite und CSS, aber isolierte
  Konto-/Speicherantworten und vereinfachte Kindeditoren. Geprüft werden Laden,
  Wiederholen, Stadtfokus, Übersicht ohne POST und erfolgreicher Abschluss nach
  einem fehlgeschlagenen Speicherversuch. Die genauen Sprach-/Breitenfälle
  stehen im Browserbeleg.
- Produktiver Gesamtbuild einschließlich TypeScript, Sprach- und Designprüfungen
  bestanden. 13 öffentliche/abgemeldete HTTP-Prüfungen und zwei Live-Browserfälle
  (Deutsch 393px, Spanisch 1440px) bestanden: Anmeldeformulare laden, geschützte
  Einstiege führen zur Anmeldung auf demselben Host, private APIs liefern 401.
  Im ersten kurzen Logfenster der neuen Fassung keine Fehler-/Fatal-Einträge.
- Kein echter Kundenabschluss und kein physischer iPhone-Test; keine Migration,
  Kundendatenänderung oder neue native Installation.
- ESLint hat im unveränderten Grundbestand des allgemeinen Inseratformulars drei
  `react-hooks/set-state-in-effect`-Fehler. Diese sind vor und nach dem Paket
  vorhanden; kein pauschaler grüner Lint behauptet.

Belege: `/srv/cinegenius/handoffs/20261123-provider-onboarding-check/`, insbesondere
`release-receipt.json`, `live-check.json`, `verified-suite.log`, `upload-tests.log`, `browser-report.json`, die
TypeScript-/i18n-Ergebnisdateien und der ESLint-Basisvergleich. Frühere
fehlgeschlagene Prüfläufe sind dort erhalten, darunter veraltete Testfixtures
und ein Aufruf ohne den erforderlichen Testimport-Resolver.

Der separat angefragte Supportfall wurde nur gelesen: bestätigte E-Mail,
erfolgreiche Anmeldung, keine Sperre, noch kein Name/Einrichtungsschritt und kein
Profil/Firma/Inserat gespeichert. Das belegt keinen konkreten Fehler oder
Abbruchgrund. Personenbezogene Belege liegen ausschließlich im privaten Handoff;
kein Kontaktversand und keine Kontomutation.
