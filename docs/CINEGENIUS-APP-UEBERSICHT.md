# CineGenius · Übersicht der gesamten App

Stand: **20. November 2026 (Europe/Berlin)**. Zuständig: **APP Entwicklung / Xcode**, gemeinsame Schnittstellen in Abstimmung mit **WEB CODEX**.
Die getrennte [Website-Übersicht](CINEGENIUS-WEBSITE-UEBERSICHT.md) enthält die öffentliche Website und deren Unterseiten.

Diese Übersicht trennt die installierte App, ihre serverseitigen Ansichten, native Werkzeuge und geplante Funktionen. Eine Website-Prüfung bestätigt keinen iPhone-Ablauf. „Vorhanden“ bezeichnet belegten Code oder einen gemeldeten Entwicklungsstand; tatsächliche Aktivierung und Geräteprüfung werden separat genannt.

## Installation und aktueller Rahmen

| Thema | Belegter Stand |
| --- | --- |
| **iPhone-App** | APP meldet am 20.11.2026 Build **2026112007** nach Datensicherung installiert; Geräteversion bestätigt. Spätere Rückmeldung aus APP: starke Hänger in Smart/Work und Work → Community funktioniert nicht mit aktuellem Web-Stand `822c27c`. Diagnose läuft; keine eigene Geräte-Reproduktion durch WEB und kein abgeschlossener Funktionstest behauptet. |
| **App-Server** | **Veröffentlichung angehalten.** Laut APP ist der gemeinsame Stand `407915184321628834171facb374c0592fe68811` einschließlich `822c27c` nur lokal, noch nicht gepusht oder veröffentlicht. Erst Fehlerdiagnose, Prüfung und neue Freigabe; kein paralleler Deploy. |
| **Native Navigation** | Ziel gemäß aktuellem App-Vertrag: **Shots · News · Smart · Projekte · Work**. Die gewöhnliche Website behält ihre eigene Navigation. |
| **Obere Aktionen** | Profil, Nachrichten, Suche und Menü; App-eigene Abstände und sichere Bedienung über Kopf-/Fußbereich. |
| **Erscheinungsbild** | Mauve wurde von Markus als unpassend zurückgemeldet. APP bereitet **vier reine Farbvorlagen** vor; noch keine neue Farbe gewählt, keine Themeänderung und kein neuer Farb-Picker. Warmes Graphit, Schiefergrau und helles Steingrau sind lediglich WEB-Vorschläge. Keine parallele zweite Vorschauimplementierung. |
| **Weitere Plattformen / Veröffentlichung** | Kein aktueller Beleg für eine veröffentlichte Android-App, einen App-Store-Release oder eine eigenständige Desktop-App in dieser Bestandsaufnahme. iPad-/Mac-Kompatibilität je konkretem Build prüfen. |

## Entdecken und Community

| Bereich | Funktionen | Stand / Grenzen |
| --- | --- | --- |
| **Smart / Entdecken** | Crew, Marktplatz, Locations und Firmen gemeinsam auswählen; Kacheln, Liste und Karte/Liste | Zählerergänzung `b1d767a`: ausdrücklich geladene eindeutige Treffer, getrennte Kartenhinweise und „Alle anzeigen“; vorbereitet, noch nicht veröffentlicht. Gemeinsame serverseitige **Admin-Beschränkung bleibt bestehen**; eine App-Navigation erteilt keine Suchrechte. |
| **Crew / Profile** | Personen, Tätigkeiten, Fähigkeiten, Ortsangaben, Bilder und Kontakt | Gemeinsame Website-Daten und aktuelle Sichtbarkeitsrechte; native Darstellung separat prüfen. |
| **Marktplatz / Dienstleistungen / Fahrzeuge** | Angebote, Anbieter, Bilder, Anfragen und Filter | Gemeinsame Angebotsregeln; Mehrwährungen noch unveröffentlichter Web-/Schnittstellenentwurf. |
| **Locations** | Drehorte/Studios, Suche, Details und Karten | Gemeinsamer Zählerfix `822c27c` übernommen: gefilterte Gesamtzahl bleibt beim Kartenziehen stabil; fehlende Kartenpunkte über die Liste erreichbar. App-Beschriftung „gesamt“ in `b1d767a` vorbereitet. |
| **Firmen** | Profile, Leistungen, Teams und Angebote | Gemeinsame Firmen-/Personenrechte; versteckte persönliche Identitäten nicht über Firmen offenlegen. |
| **Filmtiere / Jobs / Schwarzes Brett** | Weitere bestehende CineGenius-Bereiche | Website-Bestand vorhanden; vollständige native Erreichbarkeit und Bedienung pro App-Build verifizieren. Keine zusätzliche fertige native Spezialanwendung behauptet. |
| **News** | Artikel, Themen, Technik, Länder, Veranstaltungen und Organisationen | Gemeinsame redaktionelle Daten. Mexiko-/IMCINE-Erweiterung und regionale Vorauswahl abstimmen; keine erfundenen Veranstaltungen/Standorte. |
| **Organisationen / Branchenpartner** | Verzeichnisse, Profile und Beiträge | In `b1d767a` umgesetzt und mit künstlichen Daten geprüft: Gesamtzahl, geladene Seite und Kartenpunkte getrennt; während Filterwechsel keine bestätigte Zahl. Noch nicht veröffentlicht oder auf dem Gerät geprüft. |
| **Projekte** | Öffentliche Projekte, Credits und eigene Mitwirkung | Gemeinsame Rechte und Daten. Öffentliche Projektprofile vom privaten Work-Projektarchiv unterscheiden. |
| **Shots** | Vorgesehene kurze Posts, 24 Stunden sichtbar, eigene Originale anschließend privat | Oberfläche und geschützter Servercode vorbereitet; **Veröffentlichung nicht aktiviert**. Kein laufender echter Posting-Dienst allein durch sichtbaren Tab. |
| **Karten** | Antippbare Einträge, Cluster, Karten-/Listenwechsel, fehlende Positionen erreichbar halten | Web-Zählerfix `822c27c` übernommen als `d7abae6` in separater App-Arbeit. Native Smart-/Organisationen-Ergänzungen `b1d767a` umgesetzt: 76 gezielte Tests und 36 Chromium-/WebKit-Fälle bestanden, 17 Sprachen. Noch nicht durch den Web-Livegang veröffentlicht; kein echter Geräte-/Kacheltest. |

## Konto, Kommunikation und Inhalte

| Bereich | Umfang | Stand / nächste Prüfung |
| --- | --- | --- |
| **Anmeldung / Einrichtung** | Gemeinsames Konto, wiederaufnehmbares Setup und passende Profilschritte | Gemeinsame Anmeldung und Rückkehrwege; echte Geräteabläufe beim aktuellen Build prüfen. |
| **Profil / Einstellungen** | Identität, Haupt-/Nebentätigkeiten, Pronomen, Bilder, Sprache und Benachrichtigungen | Gemeinsame Verträge; native Felder und gespeicherte Werte synchron halten. |
| **Avatare / Cover** | Frei wählbare Darstellung, eigene Fotos, exklusive Motive und Besitzregeln | Web-Vertrag vorhanden. Native Auswahl und Bildnachschub nicht ohne konkreten Test als aktiviert melden; Tauschen bleibt geplant. |
| **Privatsphäre** | Öffentlich, Mitglieder, Freunde, Ghost und Orts-/Kartenrechte | Serverrechte gelten unverändert in der App. Geräte-/Zwischenspeicher dürfen frühere private Inhalte nicht wieder sichtbar machen. |
| **Nachrichten** | Einzel-/Gruppenchats, Bilder/Dokumente, Verlauf und Lesestatus | Gemeinsamer Nachrichtendienst; Gerätescrollen, Tastatur, große Anhänge und Rückkehr separat testen. |
| **Mitteilungen / Freunde / Homies** | Hinweise, Anfragen, bestätigte Kontakte und markierte Lieblingskontakte | Bestehender Kontaktvertrag; Homies sind Lieblingskontakte, keine zweite allgemeine Merkliste. |
| **Merkliste** | Gespeicherte Angebote und Profile | Gemeinsame aktuelle Berechtigungen; keine privaten Altvorschauen. |
| **Inserieren / Verwalten** | Eigene Angebote, Firmen, Organisationen, Bearbeiten und Status | Dieselben Freigaben wie im Web; App-eigene Formulare/Wege pro Build prüfen. |
| **Buchungen / Anfragen / Rechnungen** | Bestehende Vorgänge und Status | Gemeinsame Kontodaten; kein automatischer Zahlungsdienst als aktiv bestätigt. |
| **Hilfe / Support / Recht** | FAQ, Kontakt, Meldungen, Impressum, Datenschutz, AGB und Bildrechte | Gemeinsame Inhalte erreichbar halten; Konto- und externe Link-Rückkehr prüfen. |
| **Mitgestalten / Feedback** | Ländervertreter beantworten kurze Fragen und geben eigene Rückmeldungen; Markus bekommt gesammelte Ergebnisse | Web-Entwurf vorhanden, **noch nicht live**. Native Einbindung beauftragt/abzustimmen, nicht als fertige App-Funktion behaupten. Gleiche privaten Gespräche und Zusammenfassungen verwenden. |

## Work / privater Arbeitsplatz

| Werkzeug | Ziel und vorhandene Grundlage | Stand / offene Grenze |
| --- | --- | --- |
| **Workspace** | Bestehende native Werkzeuge und private Projektarchive öffnen | Vorhandener nativer Bereich wird reaktiviert; Kontobindung und geschützte Rückkehr erhalten. |
| **Projekt-/Dokumentenarchiv** | Originale, Versionen und Zuordnungen über stabile IDs | Lokales Archiv ist **kein bestätigter Online-Teamdienst**. Keine alten Vorschauarchive still einem echten Konto zuordnen. |
| **Dispo-/PDF-Analyse** | Dokumente auswerten, Analysemodus auswählen/ändern und Quellenbezug erhalten | Ausbau im App-Auftrag. Aktueller Vertrag beschreibt Fragen zu bestätigten Zeiten/Orten einer ausgewählten analysierten Dispo. Vollständige Qualitätsprüfung und alle Modi nicht in dieser Übersicht neu bestätigt. |
| **Genie im Workspace** | Fragen im erlaubten Projekt-/Dokument-/Tageskontext, Sprache und Navigation | Quellenfragen bleiben flüchtig und ungeprüft; verändern oder verteilen nichts. Allgemeiner Chat über sämtliche Teams/Grundrisse noch nicht fertig. |
| **Sprachaktionen / Dispo ändern** | Etwa Mittagspause verschieben und Änderungen für Berechtigte bereitstellen | Gewünschter Ausbau. Eine tatsächlich an alle verteilte Änderung braucht Rechte, Bestätigung, Versionierung und einen echten Online-Teamdienst; hier nicht als aktiv belegt. |
| **Raumscanner / Grundrisse** | Native Erfassung mit passenden Gerätesensoren, private Projektzuordnung | App-eigener Ausbau; tatsächlicher Funktionsumfang und Geräteunterstützung bei APP prüfen. Kein Web-Scanner-Ersatz oder bestätigtes Messergebnis ohne Gerätetest. |
| **Sonnenplanung** | Location, Datum, Uhrzeit, Zeitzone und Sonnenverlauf | Bestätigte Produktvorgabe; aktueller Implementierungs-/Gerätestand noch zu verifizieren. |
| **Online-Teams / Zusammenarbeit** | Gemeinsame Projektstände und kontrollierte Änderungen | Separater Ausbauschritt, nicht durch lokale Archive oder Teamreferenzen erledigt. |
| **Lernen aus Dokumenten** | Rückmeldungen zur Analysequalität nutzen | Kein pauschales Training mit privaten Dispos/E-Mails freigegeben oder nachgewiesen. Datenverwendung, Einwilligung und Löschung gesondert festlegen. |

## Gemeinsame Grundlagen und deaktivierte Dienste

| Thema | Stand / Regel |
| --- | --- |
| **Länderpriorisierung** | Neuer Auftrag für alle Länder: lokale neue Inhalte zuerst, andere weiterhin erreichbar. WEB entwickelt gemeinsamen Vertrag; APP übernimmt ihn. Bewusste Auswahl einschließlich „Alle“, Kontoänderung, Nachladen und Sprachwechsel beachten. |
| **Sprachen / Währungen** | 17 Web-Sprachkataloge vorhanden; native Texte separat vollständig halten. Währung und Sprache sind nicht automatisch das Land. Neue Währungsauswahl noch Entwurf. |
| **Push** | Code/Verträge vorbereitet, **nicht aktiviert**. Apple-Konfiguration, Dienstbetrieb und echter Empfang/Antippen/Abmelden-Test fehlen als Aktivierungsbeleg. |
| **Hintergrunddienste** | Kein laufender Dienst allein durch vorhandenen Worker-Code. Zeitplan, Rechte, Aktivierungsstatus und tatsächliche Verarbeitung gesondert belegen. |
| **Fotos / Dokumente / Datenschutz** | Aktuelle Rechte, kanonische Medienquelle, private Wiederherstellung, lokale Daten und Kontowechsel gemeinsam absichern. |
| **Geräteprüfung** | 320px-Browserprüfung ist kein iPhone-Test. iPhone, iPad, große Schrift, Tastatur, sichere Bildschirmränder, Zurück und unterbrochene Aktionen separat dokumentieren. |

## Nächste Schritte und Pflege

1. Release angehalten lassen: APP diagnostiziert Smart-/Work-Hänger und den fehlerhaften Wechsel Work → Community. Vor einem Livegang konkrete Korrektur, Prüfbeleg und neue Freigabe abwarten.
2. Installierten Build 2026112007 mit dem tatsächlichen Serverstand auf dem Gerät prüfen, insbesondere Smart, Work und den Wechsel zur Community; Ergebnisse von Browserprüfungen unterscheiden. Vier Farbvorlagen in APP abstimmen, erst nach Auswahl umsetzen.
3. Geprüfte native Zählerergänzungen `b1d767a` und `38d87bb` separat mit dem aktuellen App-Release abstimmen; Veröffentlichung und echte Geräteprüfung bleiben offen.
4. Länderpriorisierung und später Feedback-/Währungsfunktionen aus dem gemeinsamen Vertrag übernehmen.
5. Work-Funktionsstand mit APP konkretisieren; unbelegte Teilfunktionen als offen führen.
6. Gemeldete Zusammenführung eigener Newsrooms unter „CineGenius Redaktion“ mit der Website abstimmen: gemeinsame Eintrags-IDs, alte Links, Quellen-/Bildnachweise und Länder-/Themenmerkmale erhalten. Acht eigene Profile mit 17 öffentlichen Beiträgen sind inventarisiert; private Bestände, Migration und tatsächliche Web-/App-Abnahme stehen noch aus. Redaktionsrecherche und Änderungen an deren Zeitplänen sind kein App-Release. Details stehen im Abschnitt „Redaktionsabgleich“ der Website-Übersicht.

**Zähler-Prüfbeleg (20.11.):** `/srv/cinegenius/handoffs/20261120-app-map-counts/receipt.json`, Stand `38d87bb437dec53d0fa4d0c01eded451ebd39d8d`: 76 Regressionen, 36 Browserfälle, 17 Sprachen, TypeScript und vollständiger Build bestanden. Browserprüfungen nutzen künstliche Daten und Kartenereignisse; kein echter Geräte-/Anmeldungs-/Kartenkacheltest. Native Ergänzungen noch nicht veröffentlicht.

**Pflege:** APP Entwicklung ergänzt bei jeder App-Änderung den betroffenen Bereich mit Datum, Build/Commit, Prüfbeleg, Aktivierung und offenen Grenzen. WEB CODEX hält gemeinsame Schnittstellen in beiden Übersichten gleich. Änderungen an einer App-Oberfläche gelten nicht automatisch für die Website. Keine automatische Hintergrundprüfung wird durch diese Dokumentation eingerichtet.

**Belege:** [aktueller App-Vertrag](design/app-current-20261119.md), [App-Server](app-server-release-20261119.md), [native Smart-Ansicht](native-smart-discovery.md), [Freunde/Homies](native-friends-contract.md), [Push](native-push.md), [Shots](shots-ephemeral.md), [Hintergrunddienste](app-background-workers.md), [App-Produktvorgaben](app-product-flows.md). Ältere Navigations- und Smart-Freigaben in diesen Berichten sind durch neuere Betreiberentscheidungen ersetzt. Aktuelle Installations-/Release-Angaben stammen aus der APP-Abstimmung vom 20.11.2026; ein eigener Gerätezugriff dieses Website-Auftrags fand nicht statt.
