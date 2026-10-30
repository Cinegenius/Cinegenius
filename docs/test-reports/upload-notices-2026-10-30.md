# Kurze Uploadhinweise ohne neue Bestätigung

Freigegebener Umfang am 30. Oktober 2026: Die vorbereiteten kurzen Bildrechte- und Sichtbarkeitshinweise in vorhandene Uploadschritte einbinden. Kein neuer AGB-Vertrag, keine Marketingfreigabe, keine Datenbankänderung und kein zusätzliches Pflichtfeld. Der deutsche AGB-Entwurf in `docs/legal-review/2026-10-30/` bleibt eine getrennte, nicht aktivierte Prüffassung.

## Einbindung

`components/ContentUsageNotice.tsx` rendert einen kurzen Satz und native aufklappbare Details mit Informationslink auf `/bildrechte`. Die Hinweise sind in den sechs vorhandenen Katalogen übersetzt. Sie haben keine Netzwerkanfragen, keine Speicherzugriffe und keine Zustimmungseingaben.

Einbindung jeweils einmal pro Fotoabschnitt in:

- `app/profile/page.tsx`: Schritt Fotos/Vorstellung für Profilfoto, direkte Profilgalerie und Cover.
- `app/company-setup/page.tsx`: normaler Foto-/Firmeneditor.
- `app/inserat/page.tsx`: vorhandener Bildabschnitt für die unterstützten Inseratsarten.
- `app/dashboard/page.tsx`: bestehende Inline-Bearbeitung eigener Inserate.
- `components/ProfileSetupWizard.tsx`: passende Quelle im jeweiligen Fotoeingabeschritt.
- `components/GuidedListingWizard.tsx`: vorhandener Fotoschritt.

Diese Bearbeitungsformulare können private und öffentliche Inhalte enthalten. Deshalb verwenden sie die ausdrücklich neutrale Variante `configured`: Veröffentlichung und Einstellungen bestimmen die Sichtbarkeit; ein Upload allein veröffentlicht keinen privaten Entwurf. Anschließend wird die passende Verwendung **öffentlicher** Bilder für die jeweilige Quelle beschrieben. Es wird weder ein unbekannter Status als öffentlich bezeichnet noch ein eigener Statusdienst eingeführt.

Für Profil- und Firmenbilder wird die bestehende interne Community-Verwendung erklärt. Angebotsbilder werden ausdrücklich davon getrennt. Die Erlaubnisliste, private Auslieferung und die gesonderte Rechtebestätigung für eigenständige Projektbilder bleiben unverändert. Der Hinweis ist eine Information und verschafft keine fehlenden Nutzungsrechte.

## Bestandene Prüfungen vor Veröffentlichung

- 18 Tests in `lib/content-usage-notice.test.mjs` und `lib/project-media-rights.test.mjs`. Darin werden 150 Kombinationen aus sechs Sprachen, fünf Quellen und fünf Sichtbarkeitsvarianten gerendert. Keine zusätzliche Bestätigung und kein Publikationsschreibzugriff; private Varianten enthalten keine Zusage öffentlicher Aufnahme. Die sechs Formularstellen verwenden jeweils nur einen Hinweis pro Bildabschnitt.
- `npm run check:i18n`: sechs Kataloge, 1.897 Schlüssel, keine neuen fest eingebauten Oberflächentexte. Bestehender Übersetzungsrückstand unverändert.
- `npm run check:design`: bestanden.
- `npx tsc --noEmit --incremental false`: bestanden.
- `npx eslint components/ContentUsageNotice.tsx lib/content-usage-notice.test.mjs`: bestanden.
- Browserprüfung der tatsächlichen Informationskomponente in einer isolierten Vorschau mit Projektstilen: Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch bei 390 und 1.366 CSS-Pixeln. Aufklappen funktioniert, keine Checkboxen, kein horizontaler Überlauf.
- Quellvergleich: In den sechs vorhandenen Formularen nur Import und Hinweis ergänzt. Uploadhandler, Pflichtfelder, Freigaben, Navigation, Autosave und Speicheraufrufe nicht geändert. Die aktiven AGB-, Datenschutz- und Impressumsseiten sowie Registrierung unverändert.
- Öffentliche Produktionsprüfung vor dem Release: `/inserat` führt ohne Sitzung weiterhin zur Anmeldung mit Rückkehrziel `/inserat`.

## Grenzen

Die Browserprüfung nutzt simulierte Bildschirmbreiten, keine physischen Geräte. Die isolierte Vorschau ersetzt keinen erneuten echten Upload mit angemeldeten Testkonten. Die derzeit verfügbare In-App-Sitzung ist abgemeldet; deshalb wurde kein kompletter angemeldeter Produktionsupload durchgeführt und kein fremdes Profil verändert. Es wurden keine Dateien, Rechtebestätigungen oder Nachrichten an reale Nutzer gesendet.

Der Produktionsbuild wird anschließend durch den vorgeschriebenen Releaseablauf auf Vercel ausgeführt. Dieser Bericht behauptet vor dessen Abschluss weder einen erfolgreichen Build noch ein fertiges Deployment. Deployment-ID, Commit und öffentliche Nachprüfung werden im Abschlussbericht zur Veröffentlichung angegeben.
