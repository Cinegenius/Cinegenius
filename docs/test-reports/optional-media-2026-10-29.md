# Optionale Fotos – 29.10.2026

Status: implementiert und lokal geprüft; die Produktionsmigration wurde erfolgreich angewendet und vor der abhängigen Veröffentlichung verifiziert. Der anschließende Website-Release wird separat anhand des Deployment-Status und öffentlicher Aufrufe geprüft.

## Befund und Änderungen

- Die zentrale `validateListingPublication` verlangte für Location, Marktplatz, Fahrzeug und Tierportfolio ein Hauptbild. Fehlende Bilder sind jetzt zulässig; mitgelieferte Bildadressen und Dateien werden weiterhin geprüft.
- Die Adminvorschau behandelte ein fehlendes Hauptbild zusätzlich als blockierenden Fehler. Diese Sperre wurde entfernt. Alle übrigen Prüfungen, Versionsvergleich, Anbieterzuordnung, Begründung und Adminrechte bleiben bestehen. Vorhandene Fotos werden weiterhin vor Freigabe auf Erreichbarkeit geprüft.
- Im regulären Locationformular sperrte eine leere Galerie den Weiterweg. Titel und Ort sind weiter erforderlich, Bilder nicht mehr. Die alte Mindestfoto-Erklärung im geführten Assistenten wurde ersetzt; der Fotoschritt bietet „Ohne Foto weiter“.
- `marketplace_publish_transition` enthält außerdem eine Datenbank-Bildpflicht. Die neue Migration `20261029010000_optional_listing_images.sql` entfernt ausschließlich diese Bedingung. Sie verändert keine Nutzerinhalte und bewahrt Eigentümer-/Firmenrechte, Profilgrunddaten, Revisionsprüfung, Adminsperren und Service-only-Ausführung.
- Shared Upload-Labels sowie Profilbild-, Cover- und Firmen-Uploadbereiche kennzeichnen Bilder als optional. Der Profil-Vollständigkeitshinweis verlangt keine Mindestzahl an Fotos mehr. Ein vorhandener Vollständigkeitswert bleibt eine Empfehlung; die Grundeinrichtungsprüfung verlangt weiterhin kein Foto.
- Leere Angebotsgalerien zeigen einen kompakten Hinweis ohne Foto-/Zoomaktionen. Der leere Projekt-Fotobereich wurde ebenfalls kompakter. Vorhandene Fotos, Galerien, Rechte und Anfragen werden nicht umgeschrieben oder gelöscht.
- Die normale Startseiten-Marktplatzabfrage schließt bildlose Angebote nicht länger aus; bildlose Location-/Marktplatzkarten verwenden vorhandene Typ-Symbole. Die reine Community-Fotosammlung bleibt unverändert auf tatsächlich vorhandene berechtigte Bilder beschränkt.
- Profile, Firmen, Projekte und Schwarzes Brett ließen Speichern ohne Bilder bereits zu; dort wurden keine neuen Speicher-/Veröffentlichungslösungen eingeführt.
- Neue Hinweise in de/en/es/it/cs/hu. Die Regel ist in AGENTS.md für spätere Arbeiten dokumentiert.

## Tatsächlich bestandene Prüfungen

- 802/802 automatisierte Tests; TypeScript, Übersetzungsprüfung (6 Kataloge), gemeinsamer Designcheck und Produktionsbuild bestanden.
- Reale POST/PATCH-Handler mit kontrollierten Auth-/Datenfixtures: bildlose Marktplatz-/Fahrzeugentwürfe, spätere Bildergänzung, Entfernen des letzten Bildes, erneutes Lesen, Weiterbearbeiten älterer Kategorien sowie Ablehnung fremder Bearbeitung.
- Reale Einreichungs-Handler mit kontrollierten Daten: vollständige Location und Tierportfolio ohne Bild werden nur als ausstehend eingereicht, nicht öffentlich freigegeben.
- Reale Adminvorschau und Freigabehandler mit kontrollierten Daten: vollständige bildlose Location kann ausdrücklich freigegeben werden; keine Bilddatei wird fälschlich angefordert. Fremde Zugriffe und defekte tatsächlich angehängte Bilder bleiben gesperrt.
- PGlite führt die bisherigen produktiven Moderationsmigrationen plus die neue Migration aus: Bildloses Eigentümer-Publizieren für prop/vehicle; späteres Hinzufügen und Entfernen des letzten Fotos; manuelle Prüfung für Locations/Tiere; Rechte, Adminsperren, Revisionsschutz. Neue Migration zweimal ausgeführt, vorhandener eigener Datensatz unverändert.
- Tatsächliche Komponenten im Browser, lokaler Testempfänger mit simulierter eigener Identität: Location ohne Foto ausgefüllt und als privaten Entwurf gespeichert. Der empfangene Request enthält image_url=null, extra_images=[] und draft=true.
- Browser-Bildverwaltung mit eigener lokaler JPEG-Testdatei: das letzte Bild bewusst entfernt, 0/10 Bilder, keine img-Elemente oder Vergrößern-Aktionen, kompakter Hinweis und erneuter Upload bleiben erreichbar. Die Originaldatei wurde nicht gelöscht.
- Gemeinsame bildlose Detailgalerie bei 390, 768 und 1440 CSS-px: Höhe 56px, kein horizontales Seitenoverflow, keine img-Elemente und keine Foto-/Zoomschaltflächen. Alle sechs Sprachfassungen im Browser geprüft.
- Gerenderte Startseite: bildlose öffentliche prop/vehicle/location-Einträge bleiben auffindbar und erzeugen keine leeren img-src-Werte.

## Produktionsdatenbank und Grenzen

- Produktionsprüfung in „Cinegenius · main · PRODUCTION“: Ergebnis `optional_media_applied_verified`, Funktionshash `c8f058f1adee1e9663e9f4c0483bf54c`. 22 Inserate (18 veröffentlicht), 87 Profile und 13 Firmen blieben nach vollständigem Vorher-/Nachher-Abgleich unverändert.
- Transaktionaler Produktionstest mit eigener kurzlebiger Testidentität: bildloses Marktplatzangebot veröffentlichen, fremden Akteur und veraltete Fassung verweigern, Änderung erneut veröffentlichen; bildlose Location nur einreichen und ausdrücklich freigeben. Testdaten und ihre Protokolle wurden vor dem Commit über einen Savepoint zurückgerollt. Die neue Funktion blieb gespeichert.
- Funktionsausführung bleibt für anon und authenticated gesperrt und ausschließlich für service_role erlaubt; diese Rechte wurden als Abschlussbedingung serverseitig geprüft. Kein bestehendes Angebot wurde automatisch veröffentlicht.
- Kein vollständiger Produktions-Registrierungs-/Formularlauf mit realer Clerk-Testkontositzung und keine Tests auf echten iOS-/Android-Geräten; Browsergrößen und lokale Auth-/Datenfixtures sind ausdrücklich Simulationen. Der gesonderte transaktionale Datenbanktest oben ist eine tatsächliche Produktionsprüfung.
- Projekt-Poster-/Datei-Uploads sind im vorhandenen privaten Projektentwurf weiterhin vorübergehend deaktiviert. Diese unabhängige bestehende Einschränkung wurde nicht durch eine ungeschützte Uploadlösung umgangen. Ein Projekt ohne Bild ist weiterhin möglich.
- Keine echten Nutzerangebote bearbeitet, keine Nutzerbilder gelöscht und keine Testnachrichten versandt.

## Geänderte Dateien

- `AGENTS.md`
- `app/company-setup/page.tsx`
- `app/inserat/page.tsx`
- `app/page.tsx`
- `app/profile/page.tsx`
- `components/GuidedListingWizard.tsx`
- `components/ListingImageManager.tsx`
- `components/ListingPhotoGallery.tsx`
- `components/ProjectDetail.tsx`
- `docs/design-and-release.md`
- `lib/admin-review-server.ts`
- `lib/admin-review.test.mjs`
- `lib/homepage-avatar.test.mjs`
- `lib/listing-image-gallery.test.mjs`
- `lib/listing-publication.test.mjs`
- `lib/listing-publication.ts`
- `lib/marketplace-offer.test.mjs`
- `lib/marketplace-publication.test.mjs`
- `lib/offer-moderation.test.mjs`
- `messages/cs.json`
- `messages/de.json`
- `messages/en.json`
- `messages/es.json`
- `messages/hu.json`
- `messages/it.json`
- `lib/optional-media.test.mjs`
- `supabase/migrations/20261029010000_optional_listing_images.sql`

## Browsernachweise

- `optional-media-mobile.png`
- `optional-media-browser-checks.json`
- `optional-media-remove-last.png`

Die Dateien liegen im Visualisierungsordner dieses Chats. Die Komponenten-Screenshots zeigen lokale Prüfungen. `optional-media-production-db.png` dokumentiert das erfolgreiche Resultat der tatsächlichen Produktionsdatenbankprüfung.
