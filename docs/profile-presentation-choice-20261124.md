# Freie Profildarstellung · 24. November 2026

Markus möchte die Fotodarstellung unabhängig von der Profilart wählen können und bereits bei der Profilerstellung danach gefragt werden. Die freiwillige Auswahl steht im vorhandenen Fotoschritt und später unter Profil bearbeiten → Fotos. Der zusätzliche ältere geführte Einstieg bietet dieselbe Auswahl, ohne einen weiteren Pflichtschritt einzuführen.

- **Automatisch:** bestehende Darstellung entsprechend der Profilart; voreingestellt für Bestands- und neue Profile.
- **Kleines Profilbild:** kompakte Darstellung ohne Cover.
- **Großes Porträt:** große vollständige Portraitansicht ohne Cover.
- **Cover + Profilbild:** vorhandenes Cover mit kleinem Profilbild. Auch bei Talentprofilen wählbar. Ohne Cover bleibt der Kopf kompakt.

Die Auswahl betrifft den öffentlichen Profilkopf von Personen- und Anbieterprofilen, nicht die einheitlichen Verzeichniskarten oder Firmen-/Inseratlayouts. Schauspiel-/Modelangaben, Tätigkeiten, Galerien, Medienoriginale, Ausschnitte, Coverhelligkeit, Kontaktrechte und Sichtbarkeit bleiben unabhängig davon erhalten. Fehlende Bilder verhindern den Abschluss nicht. Bei bewusst großem Bild ohne vorhandenes Porträt erscheint der kleine bisherige Platzhalter.

## Speicherung und Kompatibilität

Die begrenzte Auswahl liegt in `profiles.crew.profilePresentation`; der bestehende JSON-Bereich speichert bereits profilübergreifende Darstellungspräferenzen. Keine Migration und keine Bestandsänderung nötig. Fehlender Wert bedeutet `auto`. POST/PATCH validieren ausdrücklich gelieferte Werte vor privaten Abfragen. Ältere Schreiber ohne Schlüssel oder mit `crew: null` erhalten die gewählte Darstellung. Ein ausdrückliches `auto` entfernt den Vorrang. Bestehende Konto-, Medien- und Veröffentlichungsschutzregeln bleiben wirksam.

Private Einrichtungsentwürfe speichern die Auswahl im bisherigen Verfahren. Ein Wechsel setzt ausschließlich die abgeschlossene Profilspeicherung zurück; bereits gespeicherte Firmen und Angebote bleiben erhalten. Bestehende Profilwünsche werden beim Fortsetzen übernommen, eine ausdrückliche Entwurfswahl hat Vorrang. Im Bearbeitungsformular wird die Auswahl mit den übrigen Feldern geladen und wiederhergestellt.

## Prüfstand

Lokal implementiert; neue Veröffentlichung noch nicht freigegeben oder ausgeführt. TypeScript, 17 Sprachkataloge (11.726 Schlüssel), 20 verbindliche Designprüfungen und 193 unterschiedliche gezielte Tests bestanden. Darunter tatsächliche API-/Einrichtungs-/Bearbeitungsfunktionen mit kontrollierten Speicheradaptern: Kontowechsel, ungültige Werte, alte Schreiber, explizites Zurücksetzen, private Entwurfswiederaufnahme, erneutes Laden und fehlende Fotos. Mehrere bestehende isolierte Prüfadapter benötigten ihre bereits vorhandenen Währungs-/Medienabhängigkeiten; bestehende Aussagen wurden nicht abgeschwächt.

88 kontrollierte Browserfälle bestanden: die tatsächliche Auswahl und Fotoschritt-Funktion in allen 17 Sprachen bei 320/393px; die tatsächlichen öffentlichen Crew-, Schauspiel-, Model- und Anbieteransichten mit allen vier Optionen bei 320/393/1440px sowie fehlende/defekte Bilder. Tastaturwahl, mindestens44px Bedienziele, kein horizontaler Überlauf, große Fotoansicht und Schließen per Escape geprüft. Talentangaben und Filmografie bleiben beim Umschalten sichtbar. Keine zusätzlichen API-Aufrufe durch die Auswahl. Screenshots visuell geprüft.

Belege und reproduzierbare Browserfixture: `/srv/cinegenius/handoffs/20261124-profile-presentation/`. `browser-report.json` benennt die kontrollierten Identitäts-/Bild-/Nebenkomponentenadapter; `targeted-followup.log` und `onboarding-followup.log` ergänzen den Haupttestlauf. Der vereinheitlichte Nachweis steht in `validation-receipt.json`. Browserplugin war in dieser Sitzung nicht verfügbar; verwendet wurde der bestehende lokale Playwright-/Chrome-Zugang. Ein vollständiger Produktionsbuild erfolgt erst in der autorisierten Veröffentlichung. Eine native Installation oder echte Geräteabnahme wird durch diesen gemeinsamen Webkandidaten nicht behauptet. Keine echten Nutzerkonten geändert, keine Bilder erzeugt und keine Nachrichten versandt.
