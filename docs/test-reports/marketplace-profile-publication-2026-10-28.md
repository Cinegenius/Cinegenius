# Marktplatz: vorhandenes Profil wiederverwenden, direkt veröffentlichen

Stand: 28.10.2026. Lokal implementiert und geprüft, nicht produktiv ausgerollt.

## Entscheidung und Umfang

Die ausdrückliche neue Vorgabe ersetzt die bisherige obligatorische Adminprüfung für Marktplatzobjekte (`prop`) und Fahrzeuge (`vehicle`), sofern die handelnde Person ein eingerichtetes Profil besitzt. Locations, Tierportfolios, Jobs und sonstige Angebote behalten ihren bisherigen Prüfablauf. Ein Entwurf wird niemals durch Autosave veröffentlicht. Explizite Administrationssperren bleiben erhalten.

Die parallel begonnene Erweiterung Filmtiere ist eine getrennte, noch nicht abgeschlossene Arbeit. Dieser Bericht behauptet keine vollständige Umsetzung oder Prüfung dieser Erweiterung.

## Ursache

Die Kontaktvorbelegung nutzte zuvor nur getrennte Namensfelder aus Clerk. Ein ausgefülltes internes Profil konnte deshalb gleichzeitig neben einer leeren Pflichtabfrage stehen. Zusätzlich erzwangen API, SQL-Trigger und Statusanzeigen die zuvor gewünschte Adminfreigabe für sämtliche Angebote. Eine reine Änderung der sichtbaren Texte hätte die Veröffentlichung nicht ermöglicht.

## Umsetzung

- `lib/responsible-person-server.ts`: vorhandenes Profil lesen und dessen Namen serverseitig für Marktplatzangebote übernehmen. Keine Aufteilung oder Erfindung von Namen, keine Übernahme von E-Mail-Adressen als Namen. Der Browser kann diese Zuordnung nicht vorgeben. Datenschutz-Auswahl und Verwaltungsrechte bleiben unverändert.
- `components/ResponsiblePersonFields.tsx`: redundante Pflichtbox im Marktplatz auslassen, wenn das eigene Profil den Kontakt liefert. Ohne eingerichtetes Profil bleibt die bisherige Eingabe verfügbar. Kontaktdaten werden nicht automatisch öffentlich gemacht.
- `lib/marketplace-publication*.ts`, Listing-Erstellungs-/Bearbeitungs-/Veröffentlichungsrouten: explizite Veröffentlichung über eine servergeschützte, transaktionale Funktion. Inhalt, tatsächlicher Anbieter, aktuelle Firmenberechtigung, Profil und exakter gespeicherter Stand werden geprüft. Veröffentlichte Marktplatzänderungen benötigen keine neue Adminfreigabe. Fehler behalten die gespeicherte Angebots-ID und ermöglichen den erneuten Versuch statt einer unnötigen Neuanlage.
- `supabase/migrations/20261028210000_marketplace_profile_publication.sql`: eigener Status `owner_published`, kein erfundener Adminentscheid. Kein Bestand wird pauschal veröffentlicht oder neu zugeordnet. Direkter Tabellen-/Funktionszugriff für Gäste und normale Datenbankrollen bleibt gesperrt. Adminentscheidungen werden auch nach Bearbeitung oder erneuter Einreichung ausgewertet.
- `app/inserat/page.tsx`, Dashboard, geführte Angebotserstellung und Profilassistent: vorhandenen Profilkontakt berücksichtigen; tatsächlichen Veröffentlichungsstatus und passende Abschlussaktion anzeigen.
- `components/OfferModerationStatus.tsx`, `lib/offer-moderation.ts`, alle sechs Sprachkataloge: Anbieter-Veröffentlichung von einer Adminfreigabe unterscheiden.
- `AGENTS.md`: neue, auf den Marktplatz begrenzte Regel festhalten.

## Tatsächlich geprüft

1. Vier neue gezielte Tests: Umfang der Ausnahme; vertrauenswürdiger Profilname und abgewiesene Manipulation; echte SQL-Funktionen mit eigener isolierter PGlite-Datenbank; tatsächliche Erstellungs- und Veröffentlichungsrouten mit kontrollierten Abhängigkeiten.
2. SQL-Abläufe: privater Entwurf, explizite Veröffentlichung von Objekt/Fahrzeug, wiederholte Veröffentlichung, veralteter Stand, Bearbeitung und erneute Veröffentlichung, Ausblenden durch den Anbieter, Adminsperre einschließlich Bearbeitung/erneuter Einreichung, anschließende Adminfreigabe, fehlendes Profil, fehlendes Bild, fremdes Konto, Firmen-Editor vor/nach Bestätigung und nach Entzug. Locations/Tiere/Jobs bleiben durch die neue Funktion unveröffentlichbar. Audit-Ereignisse sind vorhanden; es wird kein Admin als Freigeber erfunden.
3. Profilzuordnung: erfundener Browsername wird durch den echten Kontoprofilnamen ersetzt; fremde Konto-ID verweigert; Firmen-/Locationvalidierung vertraut dem Marktplatzmarker nicht; Datenbankfehler ergibt einen wiederholbaren Fehler.
4. Browser: echte Inserat-Komponente in isolierter Testvorschau, Desktop und 390-px-Smartphone-Simulation. Auswahl Marktplatz → Kostüme & Kleidung, entfallene Namensbox, Titel/Ort/VB eingeben, aktiver Button „Veröffentlichen“. Browservorschau verwendet simulierte Speicherung; kein echter Safari/iPhone-Gerätetest und kein produktiver Upload-/Login-Test. Die Anzeige wurde visuell kontrolliert; keine numerische Überlaufmessung behauptet.
5. Gesamte Testsuite: **749/749 bestanden**. Produktionsbuild einschließlich Übersetzungsprüfung erfolgreich. Gemeinsame Designprüfung und `git diff --check` erfolgreich.

## Offen vor Produktion

Die neue Migration muss vor der abhängigen Website-Version in Produktion angewendet werden. Noch keine Produktionseinträge geändert und keine Produktionsveröffentlichung vorgenommen. Bestehende private oder zur Prüfung eingereichte Angebote werden nicht automatisch öffentlich; berechtigte Anbieter können sie nach Einführung ausdrücklich veröffentlichen. Die Filmtiere-Erweiterung wird separat fertiggestellt und geprüft.
