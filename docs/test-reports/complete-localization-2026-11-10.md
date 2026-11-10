# Vollständige CineGenius-Lokalisierung – Prüfstand 10. November 2026

## Freigabestand

Die neunsprachige Fassung ist seit `b293c9a` regulär veröffentlicht. Die mobile Ergänzung `ded78f5` wurde zuerst unter eigener geschützter Adresse geprüft und danach regulär neu mit den bestehenden Produktionseinstellungen veröffentlicht. Dieser Abschlussstand entfernt den bisherigen Teilübersetzungshinweis nach den unten belegten kritischen Browser- und Datenflussprüfungen. Die Übersetzungs-, Design- und Release-Prüfungen bleiben verbindlich.

Vor Veröffentlichung wird der aktuelle entfernte Hauptzweig erneut abgeglichen. Zusammenführung, Commit und Push erfolgen nach den Projektregeln über GitHub Desktop. Eine Veröffentlichung verlangt sauberes `main` gleich `origin/main` und die bestätigte CineGenius-Projektverknüpfung.

## Umfang und Bestandsschutz

Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch werden um Niederländisch, Niederländisch für Belgien (Flämisch) und Schwedisch ergänzt. Alle neun Kataloge enthalten jeweils 7.228 passende, nicht leere Schlüssel. Der Quellencheck findet keine offenen UI- oder API-Antwortliterale; Schlüsselparität allein ersetzt die Browserprüfung nicht.

Der Umfang umfasst Verzeichnisse und Detailseiten, Suche, Filter, Registrierung, Profilassistent und Editoren, Konto und Administration, zugängliche Bezeichnungen, Validierung, Systemfehler, Benachrichtigungen und erzeugte Systemmails. Die neu im Hauptzweig ergänzten Inseratserinnerungen und ihre Lesezugriffsdiagnose sind ebenfalls in allen neun Sprachen enthalten.

Die bestehende next-intl-Lösung lädt nur den gewählten Katalog und den definierten deutschen Rückfallkatalog. Persönliche Nachrichten, Namen und Mitgliederbeschreibungen bleiben unverändert. Länder-, Orts-, Berufs-, Kategorie- und Angebots-IDs bleiben stabil. Die Sprachänderungen verwenden die bestehende Gestaltung. Die deutschen Original-Rechtstexte bleiben ausdrücklich maßgeblich; die Übersetzungen werden nicht als juristisch geprüfte Fassungen ausgegeben. Die abgelehnte automatische Bereinigung des Ortszuordnungsprotokolls bleibt deaktiviert.

## Orte und bekannte Varianten

| Bisherige Angabe | Behandlung |
| --- | --- |
| DE, Deutschland, Germany | Ein Länderwert `DE`; in deutscher Auswahl „Deutschland“ |
| Austria, Österreich | Ein Länderwert `AT`; in deutscher Auswahl „Österreich“ |
| Cologne, Köln | Dieselbe Stadt-ID; deutsche Anzeige „Köln“, englischer Name bleibt Suchalias |
| Frankfurt a.M., Frankfurt am Main | Geprüfte Varianten derselben Stadt; andere Frankfurts bleiben getrennt |
| Bayern als Stadt | Als Region behandeln; keine Länder- oder Regions-ID als Stadt ausgeben |
| „düsseldorf“ als Land oder ungeklärte Schreibfehler | Original erhalten und manuell prüfen; kein Land aus einer Vermutung ableiten |

Neue und bestehende Ortsanzeigen verwenden Land, sinnvolle Region und Stadt/Gemeinde getrennt. Auswahl und Filter verwenden dieselben kanonischen Werte. Eindeutige ID-Auswahl erlaubt auch internationale Namen mit Kommas. Unbekannte manuelle Eingaben bleiben erhalten und prüfbedürftig; sie erzeugen keine stillen neuen kanonischen Filtervarianten.

27.956 geprüfte zusätzliche Ortsnamen für NL, NL-BE und SV wurden über identische GeoNames-IDs ergänzt. Länder, Regionen, Städte, ursprüngliche Namen, alte Aliase und die sechs vorhandenen Sprachwerte bleiben erhalten. Die Ortsdaten umfassen unverändert 250 Länderkennzeichen, 3.865 Regionen, 12.896 Bezirke und 31.793 Städte. Der Katalog ist eine Teilmenge; kleinere oder mehrdeutige Orte können manuelle Prüfung erfordern.

110 mehrdeutige Sprach-/Ortsnamensgruppen auf 108 GeoNames-IDs sind in [place-locale-manual-name-review.md](../place-locale-manual-name-review.md) mit öffentlichen Referenz- und AlternateName-IDs aufgeführt. Dies ist keine Liste betroffener Mitgliederprofile. Die bisherigen Anzeigenamen bleiben erhalten. Der dokumentierte frühere Bestandsabgleich umfasste 297 Angaben: 9 sicher zugeordnet, 259 prüfbedürftig, 29 leer. Dieser frühere Livebestand wurde im jetzigen Sprachlauf noch nicht erneut lesend abgeglichen.

## Sprachwechsel, Zustände und E-Mails

Die manuelle Sprachauswahl hat Vorrang vor Browserpräferenzen. Server-Refresh, gespeicherte Auswahl-IDs und unveränderte Sitzungsgrenzen erhalten Formulareingaben und laufende Uploads. Bereits geladene Benachrichtigungen werden sofort neu angefordert; verspätete Antworten dürfen die aktuelle Sprache, Anmeldung oder Lesemarkierungen nicht überschreiben.

Raum-, Berufs-, Projekt- und Vergütungsbezeichnungen verwenden native Anzeigenamen bei unveränderten gespeicherten Werten. `brown` erscheint beispielsweise in der deutschen Oberfläche als „Braun“. Unbekannte alte Mitgliederwerte bleiben erhalten. Der Projekttypfilter liest den tatsächlichen Typ statt eines pauschalen Filmwertes.

Neue Systemmails verwenden die Empfängersprache. Auch neu aufgenommene Inserate lesen nun die Standard-Kontosprache, danach bestehende private/unsafe Sprachmetadaten. Eine ausdrücklich gespeicherte Inseratssprache behält ihren Vorrang. Regionale Schreibweisen werden zentral normalisiert. Bereits eingefrorene Versandnachrichten und Wiederholungsschlüssel bleiben exakt erhalten; keine zweite Identitätsabfrage wird hinzugefügt. Eine angenommene Buchungsanfrage erhält eine Bestätigung ohne unbelegte Zahlungsbehauptung.

## Datenbank und Veröffentlichung

Vor dem abhängigen Release wurden in CineGenius main PRODUCTION angewendet und geprüft:

- `20261110130000_notification_localization.sql`: optionale JSON-Spalte und versionierte Präsentationsdaten in drei bekannten Service-Funktionen; keine Bestandsumschreibung. Die alte, noch unveröffentlichte Versionsnummer 120000 wurde wegen der inzwischen vorhandenen Inseratsmigration freigehalten; SQL-Inhalt unverändert.
- `20261110140000_listing_freshness_locales.sql`: neun erlaubte Sprachwerte für Inseratspräferenzen und zwei bestehende Funktionen. Die ursprüngliche `20261110120000_listing_freshness.sql` bleibt unverändert und ist Voraussetzung.

Beide neuen Schritte sind atomar und erneut ausführbar. Unbekannte Funktionsfassungen brechen ab. Funktionseigentümer, OIDs, Ausführungsrechte, Sicherheitsmodus und Suchpfad bleiben erhalten. Die CHECK-Constraint erhält beim ersten Erweitern regulär eine neue OID. Gespeicherte Profile, Inserate, Nachrichten, Versandstände und Erinnerungseinstellungen werden nicht umgeschrieben. Älterer Anwendungscode kann die bisherigen Benachrichtigungstexte weiter verwenden; eine Rücknahme löscht keine neuen Daten.

Die native Vor-/Nachprüfung bestätigte alle fünf erwarteten Funktionshashes, unveränderte OIDs, Service-Rechte und gesperrte Gast-/Mitgliedrechte. Die neue Benachrichtigungsspalte ist optionales JSONB ohne Standardwert; RLS, Tabellenrechte und die eine Policy bleiben erhalten. Die neun Sprachcodes sind in der geprüften Constraint vorhanden. 167 Profile, 56 Firmen und 51 Inserate bleiben vorhanden. Alle fünf aktivierten Erinnerungsregeln bleiben mit identischem Gesamtfingerabdruck erhalten; Zustand/Outbox/Versand stehen weiterhin bei null und das Ereignisprotokoll bei acht. Zwischen den lesenden Momentaufnahmen stieg die Anzahl Benachrichtigungen von 760 auf 761; die Ursache wurde nicht untersucht. Die Migrationen enthalten keine Benachrichtigungszeilen-DML, und sämtliche vorhandenen Metadatenwerte sind weiterhin SQL-NULL.

Vor-/Nachprüfungen stehen unter `docs/sql/`. Der aktualisierte Release-Guard erlaubt eine vorgelagerte Production-Prüfung ohne Domainzuweisung und mit abgeschaltetem Erinnerungsworker. Danach wird regulär erneut gebaut; dieser Prüfbau wird nicht direkt promotet. Einzelheiten: [production-stage-checks.md](../production-stage-checks.md). Produktionsschlüssel werden weder lokal exportiert noch in Preview freigegeben. Die Admin-Lesezugriffsdiagnose liest nur eigene Testnachrichten und gibt keine Providerdaten aus; ihr vorhandener Sicherheitslimiter aktualisiert seinen technischen Zähler.

## Nachgewiesene Prüfungen

- Vollständiger Regressionstest der bis `991ec48` zusammengeführten Anwendung nach der Sprachkorrektur: 1.989/1.989 erfolgreich, keine übersprungenen oder abgebrochenen Fälle.
- Anschließend 112/112 passende Tests nach Einbeziehung der Diagnoseänderung bis `9271c2e` und des Release-Guards: neunsprachige Diagnoseanzeigen, Fehler, Doppelaktionen, Formularestände, API-Berechtigungen, Datenminimierung und beide Release-Modi.
- 13/13 kleine Offline-Importtests; 25 Ortsauswahltests prüfen zusätzlich 921.997 vollständige, lokalisierte und ungültige Auswahlpfade. Alle bisherigen IDs und Felder sowie erneute Ausführung des Namens-Overlays sind geprüft.
- Neun Kataloge mit 7.228 Schlüsseln, konsistente ICU-Variablen/Rich-Text-Tags und keine offenen sichtbaren Literale. Die Alttext-Ausnahmeliste wurde nicht erweitert. Gemeinsame Designprüfung erfolgreich.
- Separater vollständiger TypeScript-Lauf: 3.222 Dateien, keine Diagnostik, 124,63 Sekunden, 2.242.314 KiB gemeldeter Speicherbedarf vor der letzten kleinen Diagnoseergänzung. Der anschließende vollständige Build prüfte auch diese Ergänzung erfolgreich.
- Vollständiger lokaler Build nach der letzten Integration erfolgreich: Kompilierung, sämtliche Typprüfungen und 153 statische Seiten. Für die lokale Prüfung wurde allein der inkrementelle TypeScript-Cache vorübergehend deaktiviert; dieselben Quelldateien und übrigen Compileroptionen blieben aktiv. Alle drei Konfigurationsdateien wurden danach bytegenau wiederhergestellt. Die bekannten 2 GiB reichten nicht; nur der Prüflauf erhielt 3 GiB. Keine Typfehler wurden ignoriert.
- Ein zusätzlicher PGlite-Regressionstest prüft die Bestandszählung vor und nach Anlage der optionalen Metadatenspalte: fehlendes Feld, SQL-NULL und JSON-null werden nicht als Metadaten gezählt; tatsächliche Werte werden erkannt. Dieser einzelne neue Fall ist erfolgreich.
- Mailanbieter, Identitäten und Datenbanken wurden in den automatisierten Ablaufprüfungen isoliert simuliert beziehungsweise lokal mit PGlite geprüft. Es wurden dabei keine echten E-Mails versendet oder produktiven Datensätze geändert.
- Neun tatsächliche anonyme HTTP-Aufrufe privater Inbox-Routen lieferten erwartete, nicht zwischengespeicherte 401-Antworten ohne Anmeldeweiterleitung. Öffentliche HTML-/Katalogaufrufe mit absichtlich ungültigen Clerk-Platzhaltern liefen in Zeitlimits und werden ausdrücklich nicht als bestanden gezählt. Diese Platzhalter dienen keinem Anmelde- oder Browsernachweis.

## Grenzen der Prüfung

Die tatsächlichen Browserprüfungen erfolgten in Safari auf macOS, einschließlich Responsive-Design-Ansicht bei 320 × 740 und Desktopansicht bei 1366 × 900. Sie sind kein Nachweis einer physischen iOS-/Android-Tastatur. Eine echte neue Kontoanlage, ein neuer öffentlicher Profilspeichervorgang und echte Testmails wurden nicht ausgelöst. Die zugehörigen Erzeugungs-, Validierungs-, Benachrichtigungs- und Mailabläufe sind durch die dokumentierten isolierten Regressionstests geprüft. Der Profil-Editor speicherte beim Öffnen seiner Abschnitte seinen eigenen privaten Wiederherstellungsstand; öffentliche Profilangaben wurden weder bearbeitet noch veröffentlicht und dieser private Stand wurde nicht gelöscht.


## Ergänzter Live-Prüfstand

Der konfigurierte Production-Testbau ohne Domainzuweisung war erfolgreich. Anschließend bestanden 63 anonyme HTTP-Prüfungen über den offiziellen Vercel-Zugang: neun native HTML-Sprachen trotz gegenteiliger Browserpräferenz, international lokalisierte Ortsnamen und Sortierung, gleiche Frankfurt-Alias-IDs, erhaltene prüfbedürftige manuelle Eingabe und private 401-Antworten. Der reguläre Bau wurde danach neu mit den gewöhnlichen Produktionseinstellungen veröffentlicht; der abgeschaltete Testworker wurde nicht promotet.

Im tatsächlichen Safari auf der regulären Domain wurden alle neun Sprachen im Registrierungsformular gewechselt. Eine ausschließlich lokale ungesendete Beispieldateneingabe blieb in jedem Wechsel erhalten. Es wurde kein Konto angelegt und keine Authentifizierungs- oder Testmail versendet. Die schmale Ansicht zeigte eine bestehende Lücke: anonyme Besucher hatten im Handymenü keine Sprachauswahl. Eine beschriftete Auswahl nutzt dort jetzt das vorhandene Bauteil und vorhandene neunsprachige Schlüssel. Farben, Headerabstände und die Mitgliedsansicht bleiben erhalten; die Auslöser bekommen eine 44-Pixel-Trefffläche. Der mobile Zugang und alle neun erreichbaren Optionen wurden im geschützten Testbau bei 320 × 740 tatsächlich sichtbar geprüft. Danach wurde die Ergänzung regulär veröffentlicht. Der Teilübersetzungshinweis entfällt im jetzigen Abschlussstand.

## Abschließende kritische Browserprüfungen

- Live-Registrierung auf der regulären Domain: neun Sprachwechsel mit passender nativer Überschrift und erhaltener ungesendeter Beispieleingabe. Keine Kontoanlage, keine Mail und keine Passwortänderung.
- Bestehende angemeldete Profilbearbeitung: neun Sprachwechsel, vorhandener Name erhalten, Land jeweils sprachgerecht angezeigt, getrennte Felder Land/Bundesland/Stadt und tatsächliche Stadtvorschläge sichtbar. Kein Vorschlag wurde für das bestehende Profil ausgewählt und nichts öffentlich gespeichert. Deutsch und Profilübersicht wurden wiederhergestellt.
- Crewfilter auf dem Handy: Land vor Region vor Stadt, Deutschland nur einmal; Länder alphabetisch Deutschland/Italien/Österreich/Schweiz. Die Stadtliste zeigte Berlin, Frankfurt am Main und Köln mit Regions-/Landkontext; Bayern und Schreibvarianten wurden nicht als zusätzliche Städte ausgegeben. Eigene Filter anschließend zurückgesetzt.
- Tatsächliche datenbankgestützte Marktplatz-/Locationsfilter: 19 anonyme GET-Prüfungen erfolgreich, beide Bereiche mit echten Daten und kanonischen Stadtwerten, neun Sprachen, getrennte und sortierte Projektionen sowie stabile Identitätsmengen. Anonymer Dashboard-Aufruf führt auf die Anmeldeseite derselben www-Domain.
- Locationsuche München: drei reale Ergebnisse; Klick auf die veröffentlichte Bar-Location öffnete ihre vorhandene Galerie, Überschrift, Ausstattung und Anfrageoberfläche. Kein „keine Location vorhanden“-Fehler, keine Anfrage abgesendet.

Unklare alte Ortsangaben bleiben erhalten und prüfbedürftig. Die hier dokumentierten UI-Prüfungen ersetzen keine ungeprüfte automatische Zuordnung zusätzlicher Mitgliederorte.

## Korrektur nach dem abschließenden HTTP-Abgleich

Die tatsächlich veröffentlichte schwedische Projektüberschrift hatte ein zusätzliches „och“. Ursache war die Trennung des vollständigen Titels an „&“ mit anschließender sprachabhängiger Verkettung. Der Abschluss verwendet nun pro Sprache explizite Titel- und Hervorhebungsteile. Der unabhängige vollständige native Titel und die Metadaten bleiben unverändert; Schrift, Farbe, PageHeader und Layout sind identisch. Neun gerenderte Regressionstests verwenden die tatsächliche Projects-Seite und den gemeinsamen PageHeader; die frühere Implementierung scheitert in sieben Sprachen. Die neun Kataloge erhalten genau zwei passende zusätzliche Schlüssel (je 7.228).
