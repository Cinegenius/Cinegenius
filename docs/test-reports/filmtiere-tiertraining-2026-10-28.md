# Filmtiere & Tiertraining – Umsetzung und Prüfung, 28.10.2026

Stand: lokal implementiert und geprüft; **nicht in Produktion veröffentlicht**. Die optionale Firmen-Datenbankergänzung muss vor einem abhängigen Release angewendet und kontrolliert werden.

## Gefundene Ursachen

- Allgemeine Tiertrainer und Tierhandler waren in „Weitere Crew“ untergebracht, Pferdekoordination und Pferdetraining unter Stunts. Ein gemeinsames, auffindbares Gewerk fehlte.
- Firmen hatten nur die ältere Kategorie `tiervermittlung`; Filmhundagenturen und spezialisierte Trainingsanbieter sowie strukturierte Leistungen/Tierarten fehlten.
- Das Angebotsformular las Firmen aus `response.companies`, während die API `response.data` liefert. Die Verknüpfung eines neuen Tierportfolios mit der eigenen Agentur konnte dadurch ausfallen.
- Der Tierbereich nutzte die alte Einzelbild-/Mietdarstellung. Der Detailabruf bot keine kontrollierte private Eigentümervorschau; der Anbieterlink entstand nicht aus der gemeinsamen tatsächlichen Anbieterauflösung.
- Suchoberflächen kannten Tierportfolios nicht als Ergebnistyp. Ein Treffer allein in der Datenantwort hätte dort keine anklickbare Karte ergeben.

## Umsetzung

- Zentrales Gewerk `filmtiere-tiertraining` mit neun Tätigkeiten: Filmtiertrainer/in, Filmhundetrainer/in, Tierhandler/in, Tierkoordination, Set-Tierbetreuung sowie die vorhandenen vier Pferdekoordination/-training/-handling-Rollen. Stuntreiten bleibt getrennt. Bestehende Rollenkennungen und ausdrücklich ausgewählte Nebentätigkeiten bleiben wirksam.
- Firmenkategorien Filmtieragentur (bestehende Kennung `tiervermittlung`), Filmhundagentur und Tiertraining für Film und Medien. Sieben optionale Leistungen und acht Tierartgruppen mit Mehrfachauswahl sowie Freitext für Spezialisierungen.
- Bestehender Assistent, spätere Personen-/Firmenbearbeitung, Crew- und Firmenverzeichnisse, Jobs, Projekt-Rollenauswahl und Suche verwenden die gemeinsame Quelle. Anzeigen übersetzt, gespeicherte Kennungen unverändert.
- Exakte alte Rollenreferenzen werden beim Lesen aufgelöst. Keine fremden Profile geändert, keine pauschale Neuzuordnung anhand von Teilwörtern.
- Tierportfolio aus dem Firmenprofil erreichbar; tatsächliche eigene Firma wird vorausgewählt. Tiername, Tierart, Fotos, Fähigkeiten, Ausbildungsstand als eigene Angabe und verantwortliche Person werden über die vorhandenen Formulare erfasst.
- Vorhandene Galerie für bis zu zehn Bilder auch für Tiere: Hauptbild, Sortierung, Ergänzen/Entfernen, Großansicht. Speicherung über bestehende Galerie-/Medienfunktionen.
- Keine neue Tierverkaufs- oder Mietveröffentlichung. Neue Tierdatensätze erhalten `offer_kind=animal_portfolio`, keine Verkaufsart und keinen öffentlichen Mietpreis. Die frühere Checkout-/Mietvertragsdarstellung entfällt; stattdessen bestehende Projektanfrage an den tatsächlich ermittelten Anbieter. Keine automatische Behauptung geprüfter Qualifikation/Zulassung.
- Tierportfolios behalten Einreichung und Adminprüfung. Die separat veröffentlichte Ausnahme für Marktplatzobjekte/Fahrzeuge wurde nicht auf Tiere erweitert.
- Öffentliche Detailansicht nur für veröffentlichte Datensätze. Private Vorschau nur für einen berechtigten Bearbeiter und ausdrücklich mit `preview=1`. Private Metadaten nicht indexiert; technische Abfragefehler werden nicht als erfundene 404 maskiert.
- Neue `FilmAnimals`-Texte in Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch. Dies ist keine Behauptung einer vollständig übersetzten Gesamtwebsite.

## Tatsächlich bestandene Prüfungen

- Gesamte automatisierte Testsuite: **757 bestanden, 0 fehlgeschlagen**.
- Produktionsbuild, TypeScript, Übersetzungsschlüssel-/Platzhalterprüfung und gemeinsame Designprüfung bestanden. Gezielter Lint der neuen/überarbeiteten Tierkomponenten ohne Meldungen. `git diff --check` sauber.
- Katalogtests: alle neun Tierrollen genau einmal, gültiges Gewerk, alte Referenzen, Mehrfachauswahl, Synonyme, Trennung von Cable/Data Wrangler und Stunt Rider, alle neuen Übersetzungsschlüssel.
- Tatsächliche Erstellungs-/Bearbeitungs-API-Funktionen mit eigener simuliert gespeicherter Datenbasis: Firma mit mehreren Tierarten/Leistungen speichern und bei späterer Änderung ohne neues Tierfeld erhalten; keine fremde Übernahme oder Rechtevergabe über Funktionen.
- Tatsächliche Tier-Erstellungs-/Bearbeitungs-APIs: privater Entwurf bzw. Prüfung ausstehend; zehn Fotos speichern; Hauptbild/Reihenfolge ändern; Bilder reduzieren; Fähigkeiten ändern und dabei vorhandenen Ausbildungsstand und Transportangabe erhalten; Lesen der gespeicherten Werte; elf Fotos, Verkaufsart und fremde Änderungen verweigert.
- Tatsächliche Tier-Detailseitenfunktion: Gast und fremdes Mitglied erhalten keine private Vorschau; berechtigter Eigentümer erhält sie nur ausdrücklich; veröffentlichte Seite enthält richtigen Firmenlink und Fotoabfolge; Rücknahme der Veröffentlichung sperrt erneut; technischer Datenbankfehler bleibt technischer Fehler.
- Firmenmigration mit PGlite ausgeführt und erneut ausgeführt: vorhandene Firma, Status und Namen unverändert; neue Angaben gespeichert; direkte Schreibrechte von anon/authenticated fehlen, service_role darf schreiben.
- Browser mit **eigenen fiktiven Daten und simulierter Anmeldung/API-Speicherung**: sechs Assistentenschritte, Kombination Crew+Agentur, mehrere Tierberufe, Haupttätigkeit, Filmhundagentur, mehrere Leistungen und Tierarten. Nach bestätigtem Speichern und Neuladen dieselben Werte.
- Direkter Einstieg aus der Agentur in das Tierportfolio: eigene Agentur vorausgewählt; Tierart wechselbar; Feldbeschriftungen und Galerie mit 0/10 sichtbar; Einreichen statt automatischer Freigabe.
- Galerie im Browser: zehn eigene Testbilder in gemischten Seitenverhältnissen, begrenzte Vorschau, Bild 10 öffnen, zurück auf 9 und per Tastatur auf 8, schließen, tatsächlicher Anbieterlink vorhanden. Alle angezeigten Testbilder geladen.
- Breiten 390, 820 und 1280 CSS-Pixel ohne horizontalen Seitenüberlauf in den geprüften Ansichten; neue Agenturfelder in allen sechs Sprachen auf 390 Pixel kontrolliert, Auswahl blieb erhalten.

## Offen / Grenzen

- Datenbankmigration `20261028220000_film_animal_company_details.sql` ist **noch nicht in Produktion ausgeführt**; Website-Version ist noch nicht veröffentlicht.
- Keine echte Clerk-Neuregistrierung, keine reale Supabase-Dateiübertragung und keine echte Ab-/Anmeldung für den neuen Tierablauf durchgeführt. Die oben genannten API-Tests verwenden kontrollierte Datenbank-Doubles; Migrationstests verwenden PGlite. Das ist kein vollständiger Produktionsnachweis.
- Kein Test auf echtem iPhone/Safari oder Androidgerät; Browserprüfungen sind responsive Simulationen. Wischbedienung wird von der bestehenden Galerie übernommen; hier wurden Klick und Tastatur tatsächlich bedient.
- Keine Nachricht oder Einladung an echte Mitglieder, kein Konto für Marion angelegt, keine bestehenden Nutzerbilder/-inhalte verändert.
- Bestehende allgemeine Anfrage-/Bewertungskomponenten enthalten weiterhin ältere, teilweise deutsche Texte. Neue Tiertexte sind in sechs Katalogen vorhanden; eine vollständige Gesamtübersetzung wird nicht behauptet.

## Fachliche Einordnung

Trainer, Handler, Koordination und Betreuung sind getrennte Aufgaben; Pferdestunts werden nicht allein wegen der Tierart als Tiertraining umgedeutet. Fachlicher Abgleich: [American Humane – General Guidelines for Filmed Media](https://www.americanhumane.org/publication/general-guidelines-for-filmed-media/). Die Plattformangaben stellen keine behördliche Zulassung oder Zertifizierung fest.

## Geänderte Dateien

- `app/api/companies/[slug]/route.ts`
- `app/api/companies/route.ts`
- `app/api/listings/[id]/route.ts`
- `app/api/listings/route.ts`
- `app/api/search/route.ts`
- `app/companies/CompaniesContent.tsx`
- `app/companies/[slug]/CompanyDetail.tsx`
- `app/companies/[slug]/page.tsx`
- `app/companies/page.tsx`
- `app/company-setup/page.tsx`
- `app/creators/CreatorsContent.tsx`
- `app/dashboard/page.tsx`
- `app/inserat/page.tsx`
- `app/jobs/JobsContent.tsx`
- `app/profile/page.tsx`
- `app/search/page.tsx`
- `app/tiere/TiereContent.tsx`
- `app/tiere/[slug]/page.tsx`
- `app/tiere/page.tsx`
- `components/GlobalSearch.tsx`
- `components/InquiryForm.tsx`
- `components/PrimaryOccupationPicker.tsx`
- `components/ProfileSetupWizard.tsx`
- `components/RoleDropdown.tsx`
- `components/TiereDetail.tsx`
- `lib/companyCategories.ts`
- `lib/departments.ts`
- `lib/filmRoles.ts`
- `lib/guided-occupations.test.mjs`
- `lib/listing-price.test.mjs`
- `lib/listing-publication.ts`
- `lib/primary-occupation.ts`
- `lib/quick-start-flow.ts`
- `lib/responsible-person.test.mjs`
- `messages/cs.json`
- `messages/de.json`
- `messages/en.json`
- `messages/es.json`
- `messages/hu.json`
- `messages/it.json`
- `components/AnimalCompanyFields.tsx`
- `lib/animal-detail-access.test.mjs`
- `lib/animal-taxonomy.test.mjs`
- `lib/animal-taxonomy.ts`
- `supabase/migrations/20261028220000_film_animal_company_details.sql`

## Browserbelege

Die Bilder sind lokale Testansichten mit fiktiven Daten, keine Produktionsprofile.

- Agentur/Handy: `filmtiere-mobile-20261028.jpg`
- Agentur/Tablet/Englisch: `filmtiere-agentur-tablet-20261028.jpg`
- Galerie/Handy: `filmtiere-galerie-mobile-20261028.jpg`
- Portfolio/Desktop: `filmtiere-portfolio-desktop-20261028.jpg`
- Ablaufprotokoll: `filmtiere-browser-tests-20261028.json`

Ablage: `/Users/markusmueller/.codex/visualizations/2026/10/01/01a0f6ab-47e2-72d2-9d2b-c15137c043fd/`.

## Produktions-Datenbankergänzung am 28.10.2026

Migration erfolgreich auf Cinegenius/main/PRODUCTION ausgeführt. Vorher/nachher: 13 Firmen, 21 Inserate, 19 veröffentlichte Inserate. Firmen-Fingerprint ohne das neue optionale Feld identisch: `bd41a50cd7d528f588250d44999cb29a`. Neue Spalte `animal_details` vom Typ JSONB; direkte Updateberechtigung für `anon` und `authenticated` jeweils false, für `service_role` true. Die zuvor als offen benannte Datenbankergänzung ist damit erledigt. Website-Release und Live-Prüfung folgen getrennt; dieser Abschnitt behauptet noch keinen vollständigen Produktionsablauf.
