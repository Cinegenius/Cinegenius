# Firmen, Crew und Mehrfachzugehörigkeiten — Prüfung vom 16. November 2026

## Auftrag und Umfang

Geprüft wurden die vom Betreiber genannten Kombinationen: Crew-Mitglied tritt einer Firma bei; Firmeninhaber ergänzt sein persönliches Crew-Profil; ein Konto besitzt zwei Firmen oder gehört weiteren Firmen an. Bestehendes Design, öffentliche Funktionen, Firmenrechte, Veröffentlichung und Ghost-Regeln bleiben maßgeblich. Es gab keine Änderungen an Kundendaten und keine Veröffentlichung.

## Bestätigte Fehler und Korrekturen

- „Firma eintragen“ lud erneut die erste vorhandene Firma. Ein expliziter Einstieg `/company-setup?new=1` öffnet nun einen separaten neuen Entwurf. Die kontogebundene Wiederherstellung bleibt `company:new`. Vorhandene Firmen verwenden weiterhin `company:<id>`. Die administrativen Wiederaufnahmelinks verwenden ebenfalls den expliziten Neueinstieg.
- Mehrere Links aus Übersicht und Firmenverwaltung verloren die Firma. Alle betroffenen Bearbeiten- und Verwaltungslinks tragen jetzt `company_id`. Im persönlichen Bereich sind beide eigenen Firmen auswählbar; die Firmenverwaltung zeigt zusätzlich akzeptierte Mitgliedschaften. Ein mehrdeutiger alter Bearbeiten-Link führt zur Firmenauswahl.
- Die Verwaltungsseite ignorierte `tab=services` und `tab=equipment`. Alle vier bestehenden Bereiche folgen nun der URL. Der Firmenwechsel behält den Bereich bei, verwirft den Zustand der zuvor geöffneten Firma und verwendet reguläre Navigation statt eines vollständigen Seitenneuladens.
- Ein unbekannter oder nicht mehr zugänglicher Firmenlink öffnete stillschweigend eine andere Firma. Er endet jetzt ohne Ersatzfirma. Datenbankfehler werden nicht als „keine Firma vorhanden“ dargestellt.
- Die Verwaltungsseite übergab bislang den vollständigen Firmendatensatz auch an einfache Mitglieder. Sie liest und serialisiert jetzt ausschließlich die für die Übersicht benötigten Felder. Interne Kontaktangaben und der verantwortliche Kontakt werden nicht mehr an diese Ansicht übergeben. Einfache Mitglieder erhalten dort keine Bearbeiten-Aktionen.
- Firmenformulare prüfen fehlgeschlagene Leseantworten, bieten einen erneuten Versuch und verwerfen verspätete Antworten der zuvor geöffneten Firma. Fehler beim Laden der Teamfunktionen dürfen keine leeren Funktionen zurückspeichern. Die Wiederherstellung beginnt erst nach diesem Ladevorgang.
- Neue Firmen verwenden auch im separaten Formular die bestehende Wiederholungskennung `onboarding_request_key`. Sie bleibt im privaten Entwurf erhalten, damit das erneute Senden derselben Anlage nach einem Verbindungsfehler nicht erneut eine Firma erzeugt.
- Die Firmenauswahl bleibt ab 320 CSS px lesbar und bedienbar. Lange vorhandene Statistikbeschriftungen dürfen umbrechen; Farben, Schriften und grundlegende Gestaltung bleiben unverändert.

## Weiterhin geltende Abläufe

- Ein Beitritt startet als private Anfrage mit `pending` und `member`, auch wenn der Client eine höhere Berechtigung mitschickt. Nur berechtigte Verwalter der betreffenden Firma bestätigen ihn. Bestehende Anfragen werden nicht dupliziert.
- Firmeneigentum, akzeptierte Mitgliedschaften und persönliche Tätigkeiten sind unabhängig. Eine öffentliche Berufsbezeichnung vergibt keine Verwaltungsrechte. Persönliche Crew-Angaben lassen sich über `/profile` ergänzen; die Firmenzugehörigkeiten werden dabei nicht umgeschrieben.
- Das öffentliche persönliche Profil zeigt akzeptierte Zugehörigkeiten zu veröffentlichten Firmen. Verknüpfte private/Ghost-Identitäten bleiben durch die vorhandenen Sichtbarkeitsprüfungen geschützt.
- Locations, Marktplatzangebote und Dienstleistungen behalten ihre bestehende Firmenzuordnung und anbieterspezifischen Detailpfade. Diese Änderung verschiebt keine Angebote, Bilder oder Zuständigkeiten und ändert keine Veröffentlichungsregeln.

## Nachweise und Grenzen

- Abschluss: 88 gezielte Tests bestanden; 15 Browserfälle bestanden; Typprüfung mit 4 GB Prüfspeicher bestanden; Sprach- und Designprüfung bestanden. Die zunächst auf 2 GB begrenzte Typprüfung brach wegen ihres Speicherlimits ab und wurde erfolgreich wiederholt. Lint-Vergleich: 16 bestehende Effect-Fehler vorher, 15 danach; keine neuen Regelverletzungen. Bestehende Hinweise werden nicht als bestandene vollständige Lint-Prüfung ausgegeben.
- Request-Tests führen den tatsächlichen Beitritts- und Bestätigungscode sowie die Firmenzugriffsprüfung mit einer künstlichen Datenbank aus: Eigentümer zweier Firmen, zusätzliche Mitgliedschaft, offene Anfrage, Annahme, Firmenwechsel, entzogene Berechtigung und unberechtigte Firma.
- Die neue Prüfung erkennt im Ausgangsstand sowohl die Weitergabe interner Firmenfelder als auch den stillen Wechsel zu einer anderen Firma. Sie prüft außerdem die kodierten Firmenziele und alle neun Sprachkataloge mit den tatsächlichen Komponenten.
- Ergänzende vorhandene Tests prüfen persönliche Profiländerungen, Provider-Einrichtung, öffentliche Firmen-/Profilverknüpfungen, Ghost, beidseitige Blockierung, Bildrechte, Teamdarstellung und Angebots-Detailpfade.
- Chromium prüft die tatsächlichen Firmenkomponenten in einer lokalen Testoberfläche bei 320, 390, 768 und 1440 CSS px sowie die Firmenauswahl in neun Sprachen. Enthalten sind Wechsel und Browser-Zurück, ein neuer Entwurf, verweigerter Zugriff mit Wiederholung, ein mehrdeutiger Altlink und verspätete Antworten. API, Anmeldung und Routing sind simuliert, Nebenformulare teilweise ersetzt; die private Formularwiederherstellung verwendet ihren echten Hook. Dies ist kein produktiver Konto-, Safari-, iPhone- oder Xcode-Test.
- `check:i18n` und `check:design` prüfen Sprachschlüssel und gemeinsame Layoutverträge. In den bestehenden umfangreichen Dashboard-Komponenten verbleiben bereits vorher vorhandene Lint-Fehler zu synchronen Effect-Zustandsänderungen; der Vergleich wird dokumentiert, nicht durch globale Ausnahmen unterdrückt. Der volle Deep-Security-Scan ist damit weiterhin nicht ersetzt.
- Laufprotokolle und Browserbilder: `/tmp/cinegenius-company-links-20261116/`. Veröffentlichung und native Prüfung brauchen ihre jeweiligen gesonderten Abläufe. Es wird kein täglicher Prüfagent aktiviert.

## Übergabe an APP Entwicklung

Die App soll Firmen-ID und persönliche Profilidentität getrennt halten, beim Wechsel keine alten Firma-Daten oder Berechtigungen übernehmen und neue Firmen ausdrücklich als neuen Entwurf öffnen. Öffentliche Funktion bleibt unabhängig von Bearbeitungsrechten. Es sind keine neuen Datenbankmigrationen, neuen Sprachschlüssel oder Änderungen an Beitritts-/Angebots-Schreibschnittstellen erforderlich. Den geprüften Commit und die tatsächlich erfolgte Übermittlung separat im Übergabeprotokoll festhalten; diese Notiz behauptet keine bereits erfolgte native Übernahme oder Veröffentlichung.
