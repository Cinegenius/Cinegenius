# Bestätigte gemeinsame Geschäftsanschrift

Markus hat am 14. November 2026 die konkrete Frage bestätigt, ob die Plinganserstraße 19, 81369 München auch für Mathias Schmidt die gemeinsame Geschäftsanschrift ist, unter der er für CineGenius tatsächlich erreichbar ist.

Der vorbereitete Rechtstextstand nennt nun Markus Müller und Mathias Schmidt zusammen und ordnet die Anschrift ausdrücklich beiden zu – im Impressum, in § 1 der AGB und im ersten Datenschutzabschnitt. Beide vorhandenen E-Mail-Kontakte bleiben erhalten. Es wurden weder eine neue Gesellschaftsform, Register-/Steuernummer noch Mathias' unbekannte Telefonnummer ergänzt. Die Anschrift ist keine offene Rückfrage mehr; die weiteren im README dokumentierten rechtlichen und betrieblichen Punkte werden dadurch nicht als geklärt dargestellt.

Die Arbeitsfassung wurde mit dem Website-Hauptstand `17e14e0c9474271ee751a72d5c1d324fb39f17db` zusammengeführt. In allen neun Sprachkatalogen wurden beide unabhängigen Änderungssätze nach Schlüsseln erhalten. Die drei Betreiberabschnitte bleiben Teil des ausdrücklich deutschen Originaltexts.

Geprüft nach dem Abgleich:

- 82 vorhandene bzw. erweiterte Rechts-/Render-/Kontolöschungsprüfungen bestanden, darunter Betreibername, gemeinsame Anschrift und Kontaktlinks in allen neun Spracheinstellungen.
- Produktionsbuild einschließlich TypeScript und `check:i18n` bestanden.
- ESLint für die geänderte Impressumsseite und `git diff --check` ohne Fehler.
- 12 Chromium-Seitenprüfungen: Impressum, AGB und Datenschutz bei 320, 393, 834 und 1440 CSS px; beide Betreiber, gemeinsame Anschrift, Mathias' E-Mail-Link und kein horizontaler Überlauf. Keine JavaScript-Laufzeitfehler beobachtet. Ein erster Prüfversuch erwartete fälschlich genau einen Kontaktlink auf der gesamten Seite; die legitime zusätzliche Kontaktangabe wurde im Prüfskript berücksichtigt.
- Keine echten Konten verändert oder gelöscht; kein nativer Geräte- oder Safari-Test.

Belege: `/srv/cinegenius/audits/20261114-legal-update/address-*` und `/srv/cinegenius/audits/20261114-legal-update/address-confirmation/`.

Veröffentlichungsstatus: vorbereitete Arbeitsfassung auf `codex/legal-update-2026-11-14`, nicht auf Produktion veröffentlicht. Ein technischer Testnachweis ist keine anwaltliche Freigabe der Rechtstexte.
