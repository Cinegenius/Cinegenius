# News: Bildergalerie, aggregierte Nutzung und begrenzte Altimport-Ausblendung

Stand: 21. November 2026. Der separate Website-Code `a58ee77d` ist veröffentlicht;
Migration `20261120230314` angewandt. Bestehende Artikel blieben unverändert,
keine Grants wurden aktiviert. Laufende NEWS-Runtime-Arbeit liegt separat unter
`/srv/cinegenius/news-agent/runtime`. Echter privater Galerie-Upload, bytegenauer
Derivatvergleich und öffentliche Vorschau sind am ungarischen NFI-Artikel geprüft.
NEWS hat die Bildauswahl aktiviert; der nächste reguläre Bildlauf ist noch nicht
von WEB beobachtet. Der private Nutzungsfeed bleibt mangels Lesezugang deaktiviert.
Releasebeleg: `/srv/cinegenius/handoffs/20261121-news-gallery-release/`.

## Bilder und Herkunft

Artikel haben weiterhin `image_url` als Vorschaubild, optional zusätzlich
`image_gallery` mit höchstens acht Bildern insgesamt. Alte Einzelbilder bleiben
erhalten. Weglassen von `imageGallery` in einer Bearbeitung erhält die bestehende
Galerie; ein explizites leeres Array entfernt nur ihre Referenzen. Originaldateien
werden nicht gelöscht oder neu zugeordnet. Bilder bleiben freiwillig.

Jedes neue Galeriebild enthält `url`, `altText`, `creator`, `sourceUrl`,
`licenseName`, `changes`; `licenseUrl` ist optional. Zusätzlich erhalten bleiben
`caption` (800 Zeichen), `imageTitle` (300), `attribution` (1000) und `credit` (500).
Archivkontext und Aufnahmedatum gehören in die sichtbare Bildunterschrift, nicht
nur in einen Alternativtext. Originaltitel, Urheber, Quelle, Lizenz und Änderungen
stehen direkt beim Bild. Persönliche Freigabedokumente gehören nicht in diese
öffentlichen Felder. Öffentliche Bildbeschreibungen und Archivunterschriften verwenden auf Wunsch
denselben bestehenden KI-Übersetzungsweg wie Artikeltexte: Quellprüfung vor/nach
dem Cache, Inhaltsfingerabdruck, aktuelle Originalwerte und Original-Umschalter.
Gespeicherte Originale, Urheber, Bildtitel, Quellen und Lizenzangaben bleiben
unverändert. Echte KI-Ausgaben der neuen Bildfelder sind noch nicht abgenommen.

Neue Bilder verwenden ausschließlich kanonische `/api/media/...`-Referenzen mit
geprüftem Ursprung. API und Datenbank kontrollieren Uploadinhaber bzw. bestehenden
Artikelursprung. Der bestehende geschützte Bildleser prüft die aktuelle Sichtbarkeit
auch für Galerien; Freigaberücknahme und Entfernen eines Bildes wirken ohne einen
öffentlichen Ersatzcache. Bilder-/Creditänderungen an einem veröffentlichten
Artikel erfordern erneute Prüfung. Bestehende private Entwurfswiederherstellung,
Versionsabgleich und Moderationsgrenzen bleiben erhalten.

`/api/organizations/entries` und der Maschinenweg `/api/editorial/entries`
nehmen `imageGallery` an. Für die Maschine bleibt der erste Save privat; ein
fremder oder menschlich überarbeiteter Beitrag kann nicht übernommen werden.
`GET /api/editorial/media?...&imageUrl=...` liest nur ein tatsächlich zum eigenen
Artikel gehörendes geschütztes Bild und liefert den bestehenden SHA256-Nachweis.
Die Galerie unterstützt Wischen, Pfeiltasten, 44px-Punkte, reduzierte Bewegung,
unbeschnittene Bilder und den gemeinsamen begrenzten Bild-Wiederholversuch.

## Nutzung: Beobachtungen, keine Personenstatistik

Zusätzliche News-Messung erfordert eine neue ausdrückliche Zustimmung unter
`cg_analytics_consent_v2`. Eine alte v1-Zustimmung reicht nicht; eine frühere Ablehnung bleibt wirksam. Kein Autocapture,
keine Sitzungsaufzeichnung, kein Konto-/Profilabgleich. Verweigerung bleibt genauso
erreichbar wie Zustimmung. Gespeichert werden nur öffentliche Artikel-ID,
Oberfläche, Messversion und das bereits verwendete flüchtige zufällige SDK-Kennzeichen.
Keine Titel, Suchtexte, tatsächlichen Detail-URLs, Länder oder privaten Inhalte.

`news_impression` zählt eine mindestens zur Hälfte sichtbare Karte nach einer
Sekunde im sichtbaren Browserfenster. `news_view` zählt den sichtbar geöffneten
Artikelkopf. Vorgeladene Karten, schnelle Durchläufe, versteckte Tabs und private
Editoren zählen nicht. Pro Artikel/Ereignis/Oberfläche gilt 30 Minuten lokale
Deduplizierung im Arbeitsspeicher. Widerruf und Navigation stoppen ausstehende
Messungen. Diese Zahlen sind weder eindeutige Menschen noch eine nachgewiesene CTR.

`GET /api/editorial/readership?organizationId=UUID&afterId=UUID` benötigt die
bestehende Maschinenidentität und den aktuellen Publikationsgrant der Redaktion.
Es liefert `news-readership-v1`, 28 vollständig abgeschlossene UTC-Tage und maximal
100 gegenwärtig öffentliche Artikel pro Seite; `nextCursor` führt weiter.
Weniger als 20 Impressionen bzw. fünf Aufrufe bleiben `null`. Lernen ist erst ab
48 Stunden Artikelalter und beiden Schwellen möglich. Veröffentlichung und
Grant werden nach dem externen Abruf erneut geprüft; der 15-Minuten-Cache enthält
nur Aggregate, keine Berechtigungsentscheidungen.

Der Server benötigt **POSTHOG_NEWS_READ_KEY**, ausschließlich für lesende Abfragen
im festen EU-Projekt 346367. Der öffentliche Erfassungsschlüssel genügt nicht.
Dieser Runtime-Lesezugang ist hier noch nicht eingerichtet oder echt getestet.
Fehlende Zugangsdaten, Anbieterfehler, Teilantworten oder ungültige Ergebnisse
liefern `unavailable`/503, niemals erfundene Nullzahlen. Gültige leere Messungen
sind `cold_start`. NEWS verantwortet die vorsichtige Themengewichtung; daraus
folgen keine automatischen Rechteerweiterungen oder Artikel-Löschungen.

## Altimporte: einmal ausblenden, niemals übernehmen

Eine separate Admin-Freigabe bindet genau einen bestehenden Support-Import an
Organisation, Originalautor, Quelle, vollständigen unveränderten Eintragssnapshot,
Versionszeit, privaten Herkunftsbeleg mit SHA256 und sachliches Ablaufdatum. Sie
verfällt nach sieben Tagen, ist widerrufbar und einmal verwendbar. **Kein allgemeiner
Publikationsgrant der Quellorganisation ist erforderlich oder wird dadurch gesetzt.**

`POST /api/admin/organizations/legacy-expiry` verlangt `requireAdmin()`, gleiche
Herkunft der Anfrage sowie `id`, `expectedUpdatedAt`, `enabled`, `reason`. Für
`enabled:true` zusätzlich `reviewed:true`, `organizationId`, `originalAuthorUserId`,
`sourceUrl`, `evidenceSha256`, `evidenceReference`, `contentExpiresAt`.

Maschinen-GET `/api/editorial/legacy-expiry?organizationId=UUID&afterId=UUID`
liefert nur gültige, unbenutzte Einzelfreigaben auf genehmigten Elternprofilen,
maximal 100 mit `nextCursor`. Maschinen-POST verlangt `id`, `expectedUpdatedAt`,
`sourceUrl`, `checkedAt`, `verified:true`, `evidenceSha256`, `reason`.
Frische Quellenprüfung bleibt nötig; der Grant ersetzt sie nicht. Unter Sperren
werden Snapshot, aktueller Parent, Quelle, Ablauf und unverbrauchte Freigabe geprüft.
Die einzige Mutation ist reversibles `hidden` mit ehrlichem Maschinenakteur und
atomarem Audit. Autor, Text, Quelle und Originalbilder bleiben erhalten.

GET mit `organizationId` und `id` liefert bei einer historischen Einzelfreigabe
nur `{entry:{id,currentStatus,currentUpdatedAt,usedAt}}`. Das löst verlorene
Erfolgsantworten auf, auch nach Verbrauch/Widerruf; ein verschobener oder nie
freigegebener Eintrag ist unzugänglich. Keine privaten Inhalte oder Belege werden
an diesen Statusleser ausgegeben. Ein neuer Hide-Versuch braucht weiterhin eine
aktuell gültige Freigabe.

## Einführung und Abnahme

1. Geprüfte Migration `20261120230314_news_gallery_and_legacy_expiry.sql` vor dem
   abhängigen Website-Code anwenden und tatsächliche Funktionen/ACLs prüfen.
   Sie legt keine Grants an, veröffentlicht keine Altbilder und ändert keine Artikel.
2. Nur ausdrücklich freigegebenen, sauberen Hauptstand über den bewachten
   Produktionsweg veröffentlichen. Bestehende Smart-/Work-App-Sperre erhalten.
3. Mit einer autorisierten Redaktion echten privaten Upload, Referenz, Hashleseweg,
   Galerie/Archivnachweis und anschließende Freigabe prüfen. Erst danach NEWS-Medien
   aktivieren. Kein öffentliches Testfoto und keine erfundenen Nachrichten.
4. Den privaten PostHog-Lesezugang sicher konfigurieren, echten Feed testen und
   zunächst ehrlichen Kaltstart erwarten. Kein künstliches Befüllen von Nutzungsdaten.
5. Echte Altimportbelege vom Betreiber/Admin je Eintrag prüfen. Nur die geprüften
   Einzelfreigaben setzen; danach Quelle, Hide-Readback und öffentliche Abwesenheit
   prüfen. NEWS-Herkunftsbelege liegen separat im privaten Handoff.
6. APP übernimmt denselben Vertrag und führt die echten Gerätetests durch. Ein
   Website-Browsertest ist kein Nachweis einer veröffentlichten nativen App.

Der tägliche Website-Prüfagent bleibt deaktiviert. Der bereits separat aktivierte
NEWS-Ablaufworker und seine Belege sind nicht dieser Website-Release.

## Prüfung des Entwurfs

Vollständiger Produktionsbuild am 20. November 2026, 23:28 UTC mit Exit 0;
17 Sprachkataloge / 11.226 Schlüssel und Designprüfung bestanden. Gezielte
PostgreSQL-, API-, Medienursprungs-, Einwilligungs- und Übersetzungstests sowie
61 isolierte Runtime-Tests bestanden. Keine Summe aus wiederholten Testläufen
als Zahl unabhängiger Fälle ausgeben.

Die tatsächlichen Galerie-/Editor-Komponenten wurden isoliert mit WebKit in
17 Sprachen bei 320, 390, 768 und 1366 CSS-Pixeln geprüft: kein horizontaler
Überlauf, Tastatur/Dots, Bildnachweise, Wiederholung fehlgeschlagener Uploads
und erhaltene Eingaben. Eine zusätzliche Prüfung öffnet verborgene Pflichtfelder
bei fehlerhaften Bildnachweisen. Dies ersetzt weder eine vollständige
authentifizierte Browserprüfung noch den echten App-Test; der lokale vollständige
Seitenaufruf scheiterte am Authentifizierungsdienst. Neue KI-Bildübersetzungen und
der echte private PostHog-Feed sind nicht abgenommen. Prüfbelege:
`/srv/cinegenius/handoffs/20261120-news-extensions/`.

## Tatsächlicher Live-Stand

Produktionsdeployment `dpl_2jcKxqE546NduvMxAY4rHpeBxUsi` ist READY. Der
authentifizierte Maschinenleser liefert die Galerie-Felder; Gäste erhalten 401,
fremde Organisationen bzw. nicht freigegebene Einträge 403, jeweils ohne Cache.
Der echte Readership-Aufruf liefert mangels Lesezugang erwartungsgemäß 503 mit
`unavailable`; keine erfundenen Messwerte. Die Sicherheitsberater melden gegenüber
dem Vorherstand keine neuen Warnungen. Die zwei bekannten AG-DOK-Altimporte
wurden separat von NEWS über die reguläre Adminoberfläche verborgen; nicht erneut
freigeben oder ausblenden. Native News-Abnahme und Smart/Work-Release-Halt bleiben
separat offen. Internationalisierung/Feedback sind nicht Teil dieses Releases.

Vier echte öffentliche Browserprüfungen (Chromium/WebKit, 320/390/768/1440 px,
Deutsch/Spanisch) bestanden: drei Mexiko-Artikel, Redaktion, Quellenlink,
Bestandsbild und kein Überlauf. Drei zusätzliche Live-Einwilligungsprüfungen
bestätigen neue Ablehnung, erneute Nachfrage bei alter Zustimmung und Fortgeltung
alter Ablehnung; jeweils keine PostHog-Anfragen. Die anfänglichen WebKit-Probleme
betrafen lokale Bibliotheks-/TLS-Modulpfade und sind in den später bestandenen
Läufen behoben; keine native Geräteprüfung.

Der erste echte private Mediencanary erkannte korrekt einen Digestunterschied:
`validateUpload` normalisiert jedes Bild nach WebP, richtet es aus, verkleinert es
gegebenenfalls innerhalb von 2560 × 2560 und entfernt Metadaten. NEWS berechnet
und prüft dieses erwartete Derivat unabhängig, bewahrt den Originalnachweis und
vergleicht den tatsächlichen geschützten Readback strikt dagegen. Ein beliebiger
Server-Rückgabehash reicht nicht. Diese echte Abnahme ist inzwischen bestanden; keine Änderung am Upload-Guard.

Nachweis: `gallery-acceptance.json` und `runtime-marker-observation.json` im
News-Release-Handoff. Der tatsächliche öffentliche Galerieartikel wurde zusätzlich
bei390px/es-MX in WebKit geprüft: geschütztes Bild geladen, unbeschnitten, Urheber,
Lizenz, Archivjahr2010 und Änderungshinweis sichtbar, richtige Original-/Lizenz-
Links, kein Überlauf und keine ungewollte Messung. Die automatische spanische
Formulierung des Festivalnamens/Datums braucht redaktionellen Feinschliff;
`spanish-news-language-followup.json` hält die konkreten Befunde fest. Keine
vollständige sprachliche Freigabe aller dynamischen KI-Texte oder native Abnahme.

## News-Übersetzung: Live-Nachprüfung 21. November

Website-Stand `a44cdec2` wurde separat über den bewachten Produktionsweg veröffentlicht
(`dpl_CNwbQMBoLfLjDZfxpsg9txSL5rFd`, READY). Der echte Test in WebKit/de/es bestätigt
unveränderte Originale, den geschützten Festivalnamen, korrekt formatierte Archivdaten
und vollständige Übersetzung von Titel, Summary, Caption und Beschreibung.
Die vorher gemeldeten dauerhaft fehlenden Texte waren beim Sichtbarwerden nicht
reproduzierbar; die Namen-/Datumsfehler waren real und sind korrigiert.

`lib/news-translation.ts` führt verifizierte offizielle Veranstaltungsnamen als
Glossar ohne Artikel-ID-Ausnahmen und formatiert eindeutig validierte englische
Redaktionsdaten als ganze unveränderliche Fakten. Ungültige/mehrdeutige Daten
werden nicht geraten. `news-v2` verändert nur News-Fingerprints; keine globale
Cacheleerung, Originaländerung oder zusätzliche Migration. Die Shared-Komponente
behält einmal sichtbare Texte innerhalb von Seite/Konto/Sprache bei. Tatsächlich
eine Übersetzungsanfrage pro Artikel trotz Scrollen.

92 gezielte Prüfungen, vollständiger Build und zwei Komponenten-Browserfälle
bestanden. Echte Modellantworten anschließend in Deutsch und Spanisch geprüft.
Automatische Formulierungen bleiben redaktionell prüfbar, beispielsweise die
deutsche Ordinalform „46te“; keine pauschale sprachliche Abnahme aller Inhalte.
Rechte-/Urhebertexte bleiben absichtlich im Original. Native Abnahme weiterhin offen.
Belege: `translation-correction.json`, `translation-live-after.json` und
`translation-browser/results.json` im aktuellen News-Release-Handoff.
