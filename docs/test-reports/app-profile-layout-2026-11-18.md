# Profilwahl im App-Projekt – 18. November 2026

## Übernahme

Einzelner geprüfter Web-Commit `7299baeaa03c889fabdf06e03e70415e4c63b0e5`,
Basis `717b944`, übernommen auf App-Ausgangspunkt
`e8d6bc2b73c191e016bb44358475d6a8f1f4f3c7`.
Der abschließende App-Commit und Prüfausgänge stehen unter
`/srv/cinegenius/handoffs/20261118-app-profile-layout/receipt.json`.
Alle 39 Quellhashes wurden vor der Übernahme mit dem Web-Beleg abgeglichen.

Die persönliche Profilwahl **Kompakt / Großes Bild** gilt unabhängig vom Beruf.
Bei „Großes Bild“ sitzt die Identitätskarte über dem unteren Bildrand. Vorhandene
Berufs-/Castingdaten, Bildausschnitte, Galerien und Showreels bleiben erhalten.
Fehlende oder gescheiterte große Bilder führen zur kompakten Ansicht, ohne die
Medien oder die gespeicherte Wahl umzuschreiben.

Die 123 erfassten mobilen Dateien und sämtliche bisherigen Sprachwerte bleiben
unverändert. Die sieben neuen Texte sind als `ProfileLayout` in allen 17 Katalogen
ergänzt. App-eigene Smart- und Kontofunktionen sind erhalten. Die bestehenden
HTTPS-Flags der Profil-Cookies bleiben in GET und POST erhalten; sie sind ein
bewusster Unterschied zur gelieferten Web-Datei.

Zusätzlich wurden 73 erfasste Smart-/Genie-/Suchdateien mit dem App-Ausgangspunkt
verglichen: keine Unterschiede. Die bereits geprüften Suchverbesserungen aus
`dcf06be` und `37b6f5a` bleiben erhalten; diese Profilprüfung ist keine erneute
Abnahme des Sprachverständnisses oder einer echten angemeldeten Smart-Suche.

Eine kleine App-Nachbesserung übersetzt den Namen der Darstellungswahl auch in
der allgemeinen Meldung über derzeit nicht verfügbare Profilfelder. Statt des
technischen Feldnamens wird der vorhandene `ProfileLayout.title` verwendet.
Dafür ist keine weitere Sprachzeichenfolge nötig.

## Schnittstelle und Freigabegrenze

Der vollständige gemeinsame Vertrag steht in `docs/profile-layout-choice.md`.
`profile_layout` akzeptiert `compact` oder `large-photo`; fehlende Werte alter
Clients behalten die Wahl. Legacy-NULL behält die bisherige Darstellung.
Neue Verbraucher und diese API-Fassung gemeinsam übernehmen; einen unabhängig
gebündelten neuen App-Editor nicht vor der passenden Serverfassung ausliefern.
Private Wiederherstellung verwendet `quickStart.profileLayout` bzw.
`profileEditorDraft.profileLayout`. Erst explizites Speichern schreibt das Profil.

GET meldet die fehlende Datenbankfähigkeit über `unavailableFields`, auch vor
Anlage eines Profils. Eine ausdrückliche Schreibanfrage ohne diese Fähigkeit
endet mit 503 / `PROFILE_LAYOUT_UNAVAILABLE`, nie mit einer erfundenen
Speicherbestätigung. Ungültige Werte und fremde/veraltete Kontozuordnung bleiben
abgewiesen. Kontogrenzen, Ghost, Blockierungen und Medienrechte bleiben wirksam.

`20261118002930_profile_layout_choice.sql` ist nur als Quellmigration übernommen.
Sie ist vor einem später ausdrücklich freigegebenen Release anzuwenden und zu
prüfen. In diesem Auftrag gab es keine Produktionsmigration, Veröffentlichung,
bezahlte Modellnutzung oder iPhone-Installation. Die lokale PGlite-Prüfung ist
keine Aktivierung im Zielsystem. Auch die ältere Zufallsmigration bleibt separat
unveröffentlicht.

## Eigene Prüfung des App-Stands

- 189 gezielte Funktionstests bestehen: Profil-API, Auswahl/Erhalt alter Werte,
  Migration in isolierter Datenbank, Kontowechsel, privater Entwurf, verwandte
  Profil-/Medienabläufe, Authentifizierung und sichere Cookies. Nach der kleinen
  Meldungsanpassung wurde der betroffene Profil-Client gezielt erneut geprüft;
  wiederholte Fälle werden nicht nochmals zur Gesamtzahl addiert.
- 37 mobile Quell-/Vertragstests bestanden. Sie sind keine native Laufzeitprüfung.
- Sprachprüfung: 17 Kataloge, 11.269 Schlüssel, keine neuen unübersetzten
  Quelltexte. Gemeinsame Designprüfung bestanden.
- 127 eigene Browserfälle bestanden: 109 für Auswahl/Darstellung sowie 18
  für erlaubte und blockierte Kontakte. Es gab keine öffentlichen Schreibzugriffe.
  Die neue Funktion wurde im App-Checkout mit tatsächlichen Komponenten,
  frisch erzeugtem Projekt-CSS, den App-Anpassungen für Ansichten sowie den
  tatsächlichen Schriften gerendert. Konten, Daten und Bilder sind synthetisch;
  externe Videos und Framework-/Auth-Wrapper sind isoliert. Die Wahl in dieser
  Vorschau löst keinen öffentlichen Schreibzugriff aus.

Die Browserprotokolle unter `browser/font-browser-results.json` und
`browser/visitors/font-browser-results.json` erfassen beide Darstellungen,
Legacy-Ansichten, alle 32 persönlichen Profiltypen und alle 17 Sprachen,
Breiten 320/390/834/1440, Tastaturauswahl, Foto-Dialoge, fehlende/fehlerhafte
Medien, erhaltene Fachinhalte sowie erlaubte und blockierte Kontaktaktionen.
Chromium und WebKit laufen auf Linux; das ist kein iOS-WebKit-Gerätetest.

## Grenzen

Die aktuelle App-Vorschau lädt veröffentlichte Web-Inhalte. Ein neuer App-Quellstand
allein aktiviert diese Funktion deshalb nicht auf dem iPhone. Eine reale
angemeldete Einrichtung und ein vollständiger Speichervorgang über die Website,
Softwaretastatur, tatsächliche Safe Areas, Vordergrundwechsel und iPhone-/iPad-
Bedienung bleiben offen. Noch nicht zurückgegebene Mac-Änderungen sind weder
überschrieben noch durch diese Serverprüfung abgenommen.

Der abschließende vollständige Build (`build-verified.log`) besteht Kompilierung,
TypeScript-Prüfung und die Erzeugung aller 159 Seiten. Er endet anschließend mit
Exitcode 1 und dem bereits bekannten `SecurityFatalError` der installierten
Next.js-Version. Es gibt keinen erfolgreichen vollständigen Produktionsbuild;
die Sicherheitsgrenze wurde nicht umgangen und keine Abhängigkeit geändert.
Ein erster Typfehler in der kleinen Meldungsanpassung ist durch die explizite
String-Typangabe behoben. Der Zwischenlauf mit Exitcode 143 wird nicht als
bestandener Build gewertet. Alle ursprünglichen Logs bleiben erhalten.
Die drei alten Editor-Lintfehler, dessen drei Warnungen und die zwei vorhandenen
Wizard-Warnungen sind unverändert; der Vergleich zeigt keine neue Diagnose.

Firmenmotive, exklusive persönliche Bildvergabe und Nachfüllen bleiben separate
Pakete. Die Jobkarten behalten ihren bereits abgeglichenen Amber-Stil.
