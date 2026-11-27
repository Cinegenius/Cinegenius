# Saisonale Avatare · 27. November 2026

Quellkandidat, nicht veröffentlicht. Betreiberentscheidungen: Winter bis Jahresende;
Nikolaus weltweit schon ab 4. Dezember; genau ein Nikolaus, drei Rentiere und drei
Helfer; normale Avatare bleiben die Hauptauswahl.

## Auswahl und Termine

- Winter: 27.11.2026 bis einschließlich 31.12.2026.
- Nikolaus: 04.12.2026 bis einschließlich 06.12.2026.
- Gemeinsame verbindliche Uhr: Europe/Berlin, jeweils 00:00; Ende exklusiv.
  Keine jährliche Wiederholung und keine Länder- oder Religionsableitung.
- Von zwölf freien Angeboten höchstens drei saisonal, eingestreut an vierter,
  achter und zwölfter Position. Bei wenig normalem Bestand sinkt der saisonale
  Anteil ebenfalls. Keine reine Winterauswahl, kein saisonaler eigener Pflichtschritt.
- Sieben einzelne exklusive Nikolaus-Motive im Gesamtbestand, nicht sieben pro
  Mitglied: Slot1 Nikolaus, Slots2–4 Rentiere, Slots5–7 Helfer. Keine Nachproduktion.
  Der freie Nikolaus wird im Saisonanteil zuerst berücksichtigt. Weitere Motive
  wechseln kontostabil je Kalendertag; belegte/gesperrte Motive bleiben ausgeschlossen.
- Drei freie neutrale Wintermotive als Reserve. Verbrauch kann den bestehenden
  begrenzten Batchweg nutzen; die 18 normalen Avatarreserven bleiben separat bestehen.
  Öffnen und Reservieren erzeugen keine Bilder. Es bleibt bei 64 Jobs/Tag, 36
  ausstehenden Jobs, sechs Batches und einem verarbeitenden Worker; keine neuen Cronjobs.
- Der Winterprompt ergänzt nur Schal/Mütze/Frost; keine religiösen Figuren oder
  Karikaturen, keine weiteren Nikolaus-/Helfer-/Rentierfiguren. Hersteller und
  Prüfer verwenden dieselbe dauerhaft am Job gespeicherte Editionskennung.
  Normale Prompts und bestehende Batch-Hashes bleiben bytegleich.

## Eigentum und Kompatibilität

Die Datenbank filtert die Auswahl, begrenzt neue Reservierungen auf das Editionsende
und prüft auch alte Profil-Speicherwege. Bereits bestätigte Eigentümer behalten
und verwenden ihr Bild nach Jahresende. Keine automatische Bildänderung oder
Löschung. Ungewählte abgelaufene Bilder gelangen nicht wieder in den normalen
Bestand. Bestehende Löschmarker und Duplikatprüfung gelten weiter.

Website und eingebettete Appansichten benutzen unverändert `/api/profile-art` mit
dem bestehenden Antwortschema. Kein neuer Text, kein neues Pflichtfeld und keine
native Quelldatei. Alte Clients können abgelaufene sichtbare Auswahlkarten bis zum
nächsten Abruf behalten; der Server weist eine neue Reservierung dann kontrolliert
zurück. Eine bereits gespeicherte Auswahl bleibt davon unberührt. Physische
Appprüfung und angemeldeter Produktivdurchlauf stehen gesondert aus.

## Veröffentlichung

1. Nach ausdrücklicher Veröffentlichungsfreigabe die gezielte Migration
   `20261127135242_profile_art_seasonal_mix.sql` anwenden und prüfen. Kein blindes
   `db push`. Sie lädt keine Bilder und aktiviert keine Winterproduktion:
   `refill_enabled` startet false.
2. Den geprüften Website-/Workerstand über den geschützten Releaseweg ausliefern.
   Alte laufende Artwork-Worker vor der folgenden Aktivierung auslaufen lassen.
3. Mit bestehendem Serverzugang den Importer ausführen:
   `node --experimental-strip-types --import ./scripts/register-test-aliases.mjs scripts/profile-art/seasonal-import.mjs --verify-upload`.
   Standard ohne Flag prüft ausschließlich lokal. Das Flag prüft den vollständigen
   aktuellen Katalog, lädt unveränderliche private Objekte hoch, liest sie erneut
   und erzeugt ein geprüftes SQL-Paket. Kein SQL wird automatisch ausgeführt,
   keine Erzeugungs-API aufgerufen und kein Dienstzugang angelegt.
   `--check-catalog` ermöglicht denselben Katalogabgleich ausschließlich lesend,
   ohne Speicherupload, SQL-Paket oder Änderungen am Dienst.
4. Das entstandene `work/seasonal-avatars-20261127/import/reviewed-import.sql`
   als Wartungsrolle prüfen/anwenden: gleicher Katalogstand, zehn Motive über den
   bestehenden Prüf-/Duplikatpfad, atomare Bindung der Edition/Slots, danach
   Winter-Nachfüllung aktiv. Bei geändertem Katalog neu prüfen; keine Schwelle
   lockern. Wiederholte Importe ändern vorhandenes Eigentum nicht.
5. Privaten Readback, Hashes, exakte Bestandsrollen, Auswahl/Reservierung/Speichern,
   normalen Nachfüllweg und tatsächlichen Livezustand im Betreiberbeleg festhalten.

Die zehn vorbereiteten 384px-WebP-Bilder und editierbaren Zeichnungen liegen unter
`design/profile-art-seasonal-20261127`. Lokal gegeneinander geprüft und
visuell angesehen. Am 27.11.2026 um 14:01 UTC bestanden alle zehn Bilder zusätzlich
den rein lesenden vollständigen Livekatalogvergleich: Revision617, 163 Einträge.
Das belegt den bestehenden technischen Ähnlichkeitscheck, keine mathematisch
bewiesene semantische Einzigartigkeit. Vor Import erneut gegen den frischen Bestand
prüfen; kein privater Upload oder Produktivimport ist damit durchgeführt.
Eine Kollision verhindert die Aktivierung dieses Motives und muss separat durch
wirklich neue Zeichnung gelöst werden. Keine öffentliche Assetkopie vor exklusiver
Katalogübernahme.

## Prüfstand

87 gezielte Bestands-/Batch-/Reservierungs-/Speicher-/Reviewerfälle bestanden.
Nach der letzten Änderung auf den 4. Dezember und der getrennten Aktivierung:
18 abschließende Prüfungen, darunter 13 tatsächliche SQL-Fälle in PGlite mit allen
Artworkmigrationen. Geprüft sind Datumsgrenzen, Mischquote bei Bestandsmangel,
fremde Reservierungen, genau sieben Slots, Bestandseigentum nach Saisonende,
Nachfülllimits, verspätete Batchausgaben, Rollenrechte und das tatsächlich gerenderte
Import-SQL samt Wiederholung und Ablehnung eines veralteten Katalogstands.
300 normale Promptfälle bleiben bytegleich zur Basis.

Vollständiges lokales TypeScript, abschließendes ESLint, 22 Designprüfungen und
17 Sprachkataloge mit 11.779 Schlüsseln bestanden. Kein Provideraufruf und keine
Produktivmutation. Geschützter Produktionsbuild, echter angemeldeter Ablauf und
physische Geräteabnahme bleiben dem gesonderten Release vorbehalten.
