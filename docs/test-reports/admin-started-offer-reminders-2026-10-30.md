# Begonnene Angebote im Adminbereich (30.10.2026)

## Befund und Änderung

Die bisherigen Inserats- und Firmenlisten zeigen gespeicherte Inhaltsdatensätze. Automatisch gesicherte, noch nicht als Inhalt gespeicherte Formulare lagen dagegen ausschließlich in `private_form_drafts` oder im bestehenden privaten Clerk-Onboardingfortschritt. Sie waren deshalb in diesen Listen nicht erreichbar.

Die neue Adminansicht **Begonnene Angebote** liest ausschließlich freigegebene neue Angebotsquellen: `listing:new`, `company:new`, die geführten Angebotsentwürfe sowie aktuelle und ältere Location-/Equipment-/Firmenabschnitte des Onboardings. Profilbearbeitungen, Nachrichten, Board-Kompositionen und Änderungen an bestehenden Angeboten gehören nicht zu dieser neuen Übersicht. Es werden nur Art, Titel, Kontoname/-ID und verfügbarer Sicherungszeitpunkt ausgegeben, niemals rohe Formulardaten, Kontaktdaten, Dateien oder private Clerk-Metadaten.

Die Konten werden in begrenzten Paketen geprüft (maximal 100 je Anfrage, mit Fortsetzung). Die Suche bezieht sich auf das Konto/die Person; der Bereichsfilter wirkt zusätzlich. Keine erfundene Gesamtzahl für Entwürfe. Tombstones und abgeschlossene Einrichtungsabschnitte werden ausgeschlossen; bereits gespeicherte passende Angebote bleiben in den regulären Listen. Bei bestehenden Firmen führt die bestehende Bearbeitung zum vorhandenen Unternehmen; dafür wird keine zusätzliche neue Firmen-Erinnerung angeboten.

**Erinnern** öffnet den vorhandenen manuellen Supportdialog einschließlich editierbarer Vorlage, Vorschau und bisheriger Supportkontakte. Vor Versand werden Konto und aktueller Entwurf erneut aufgelöst. Der Link führt zum tatsächlichen bestehenden Fortsetzungsformular, ohne fremde Bearbeitungsrechte zu verleihen. Die dauerhafte Supportunterhaltung verwendet eine stabile Entwurfskennung; es wird kein Inserat oder öffentliches Personenprofil dafür erfunden. Existierende Supportpersistenz, Idempotenz, Antworten, Lesestatus und optionaler E-Mail-Versand bleiben bestehen. Kein automatischer Versand und keine Änderung des Veröffentlichungsstatus.

## Dateien

- `lib/admin-started-offers.ts`, `lib/admin-started-offers-server.ts`: erlaubte Quellen, minimale Zusammenfassungen, Altformate und gespeicherte Gegenstücke.
- `app/api/admin/started-offers/route.ts`, `components/admin/AdminStartedOffers.tsx`, `app/admin/page.tsx`: servergeschützte, nachladbare Übersicht.
- `lib/admin-support.ts`, `components/admin/SupportMessageAction.tsx`, bestehende Admin-Supportrouten, `lib/support-started-offer-template.ts`: vorhandener manueller Versand mit erneuter Prüfung.
- `lib/support-message-templates.ts`: neutrale Anrede ohne Vornamen auch in den weiteren unterstützten Sprachen.
- Alle sechs bestehenden Sprachkataloge.
- Gezielte Tests in `lib/admin-started-offers.test.mjs`, `lib/admin-accounts.test.mjs`, `lib/support-conversation.test.mjs`.

Zusätzlich kann der bestehende Supportresolver gespeicherte Firmen und Inserate einem verifizierten Clerk-Konto auch ohne separates Personenprofil zuordnen. Bei Firmenangeboten bleibt das tatsächliche Firmeninhaberkonto maßgeblich, nicht der technische Ersteller. Ein fehlendes/deaktiviertes Konto wird nicht erfunden; ein öffentlicher Profillink entsteht dadurch nicht.

Keine Migration, keine Rechteausweitung für Datenbankclients, keine Bestandsänderung erforderlich.

## Tatsächlich geprüft

- 27 gezielte Tests erfolgreich: erlaubte/ausgeschlossene Quellen, fehlende Bilder, Tombstones, moderne/ältere Einrichtung, fertige Abschnitte, minimale Projektion, begrenzte Pagination, Suchfilter, Nichtadmin-Ablehnung vor Datenzugriff, eindeutiger Empfänger, Selbstversandsperre, nachträglich erledigter Entwurf, ungültige Platzhalter/Links, Fehler statt falschem Leerzustand, sechs Sprachfassungen.
- Die realen Support-SQL-Funktionen mit PGlite und eigenen Testdaten geprüft: Erinnerung mit Entwurfskennung, dauerhafte Unterhaltung, Mitgliedsantwort, Antwort des Supports, Idempotenz, Lesestatus, Audit und abgelehnte unberechtigte Zugriffe. Keine Nachricht an echte Mitglieder.
- Isolierte Browservorschau mit **tatsächlichen neuen Komponenten**, synthetischen Empfängern und simulierten Endpunkten: Liste, Locationfilter, Erinnerungsdialog, richtige Linkeinsetzung, bisherige Kontakte, Versandbestätigung; Desktop und 390px-Handyansicht. Dies ist kein echter Gerätetest und kein Versand an Produktionskonten.
- Produktionsbuild und Sprachprüfung erfolgreich. Gezieltes Lint der neuen/geänderten Funktionsdateien erfolgreich. `app/admin/page.tsx` besitzt zwei bereits vorhandene React-Hook-Lintfehler in `ListingProviderControls`, außerhalb dieser Änderung; keine neuen Hook-Probleme in den hinzugefügten Komponenten.

## Grenzen

Nur tatsächlich zum Server gesicherte Eingaben können erscheinen; lokale, nie synchronisierte Eingaben sind für Admins nicht abrufbar. Es gibt keine verbindliche Sicherungszeit für ältere Clerk-Entwürfe; in diesem Fall wird kein Zeitpunkt erfunden. Rohdaten und private Bilder werden nicht durch diese Zusammenfassung allgemein sichtbar gemacht. Die Versandfunktion bleibt eine bewusste Einzelaktion; optionale E-Mails unterliegen den vorhandenen Einstellungen. Die noch bestehenden deutschen Texte des älteren Supportdialogs wurden nicht vollständig neu übersetzt.
