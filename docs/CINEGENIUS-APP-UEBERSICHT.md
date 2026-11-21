# CineGenius · Übersicht der gesamten App

Stand: **21. November 2026 (Europe/Berlin)**. Zuständig: **APP Entwicklung / Xcode**, gemeinsame Schnittstellen in Abstimmung mit **WEB CODEX**.
Die getrennte [Website-Übersicht](CINEGENIUS-WEBSITE-UEBERSICHT.md) enthält die öffentliche Website und deren Unterseiten.

Diese Übersicht trennt die installierte App, ihre serverseitigen Ansichten, native Werkzeuge und geplante Funktionen. Eine Website-Prüfung bestätigt keinen iPhone-Ablauf. „Vorhanden“ bezeichnet belegten Code oder einen gemeldeten Entwicklungsstand; tatsächliche Aktivierung und Geräteprüfung werden separat genannt.

**Aktueller Release-Abgleich (21. November, 13:10 Uhr Berlin):** Der gemeinsame
Serverstand `91a508d5` ist live und enthält das vollständige freigegebene App-Paket
`68930dd9` sowie die Korrektur der Firmen-Abschlusslinks. Die erneute Freigabe in
`68930dd9:AGENTS.md` ersetzt den früheren Stopp für dieses konkrete Paket.
Die neue iPhone-Installation und die tatsächliche Geräteabnahme bleiben offen.
Frühere Stopphinweise in den datierten Berichten unten beschreiben den damaligen
Stand. Push und produktive Shots sind dadurch weiterhin nicht aktiviert.
Release-Beleg: `/srv/cinegenius/handoffs/20261121-company-onboarding-link/receipt.json`;
App-Abgleich: `/srv/cinegenius/handoffs/20261121-app-company-onboarding-handoff/receipt.json`.

## Installation und aktueller Rahmen

**Neue Website-Abstimmung, native Übernahme offen (21.11.):** Homepage „Crew“ ohne
Neuregistrierungs-Vorrang; eigene Teilnahmeauswahl schon bei der Profileinrichtung
und später unter Privatsphäre. Gemeinsames Feld `show_in_home_crew` in
`/api/user-settings`; bestätigte Speicherung vor Profilveröffentlichung nötig.
Website/API und Migration sind seit 21.11., 16:12 Uhr Berlin, live (`5cafc814`).
Native Übernahme und echte Geräteprüfung bleiben offen.
Siehe [Vertrag und genaue Reichweite](home-crew-discretion.md).

| Thema | Belegter Stand |
| --- | --- |
| **iPhone-App** | Zuletzt nachgewiesen installiert: **2026112007**. Das neue gemeinsame Paket wird nach ausdrücklichem Geräteauftrag vorbereitet. Work-Fußnavigation, Einbettung und Dispo-Bezeichnung sind korrigiert und gebaut; die sieben Hintergrundfarben werden in Community und Work ergänzt. Neue Installation und vollständige echte Smart-/Work-/Community-Geräteabnahme separat nachweisen. WEB hat keine eigene Geräteprüfung durchgeführt. |
| **App-Server** | **Veröffentlicht:** `91a508d5` seit 21.11., 13:10 Uhr Berlin, einschließlich App `68930dd9` und Firmenlink-Fix. Git-Abstammung geprüft; Deployment `dpl_CPk147S9NmEePK3DEgYhmP9MSzsx` READY mit Produktionsdomains. Das App-Paket bestand 572 gezielte Tests, i18n/Design/ESLint und vollständigen Produktions-/TypeScript-Build. Die neue native Palette-Fähigkeit und Geräteprüfung bleiben separat. |
| **Native Navigation** | Ziel gemäß aktuellem App-Vertrag: **Shots · News · Smart · Projekte · Work**. Die gewöhnliche Website behält ihre eigene Navigation. |
| **Obere Aktionen** | Profil, Nachrichten, Suche und Menü; App-eigene Abstände und sichere Bedienung über Kopf-/Fußbereich. |
| **Erscheinungsbild** | Gewählt sind sieben dunkle Optionen: Graphit, Nachtblau, Rauchgrün, Rosé, Warmer Sand, Terrakotta, Reinschwarz. Gemeinsamer Picker für Community/Work wird im Folgepaket geprüft; ältere Apps blenden ihn aus. Heller Stein und schneller Hell-/Dunkelwechsel bleiben erhalten. Ohne ausdrückliche Farbwahl bleibt der bisherige Mauve-Hintergrund bestehen. |
| **Weitere Plattformen / Veröffentlichung** | Kein aktueller Beleg für eine veröffentlichte Android-App, einen App-Store-Release oder eine eigenständige Desktop-App in dieser Bestandsaufnahme. iPad-/Mac-Kompatibilität je konkretem Build prüfen. |

## Entdecken und Community

| Bereich | Funktionen | Stand / Grenzen |
| --- | --- | --- |
| **Smart / Entdecken** | Crew, Marktplatz, Locations und Firmen gemeinsam auswählen; Kacheln, Liste und Karte/Liste | Zählerergänzung `b1d767a`: ausdrücklich geladene eindeutige Treffer, getrennte Kartenhinweise und „Alle anzeigen“. Aktueller App-Serverstand siehe Release-Abgleich oben; native Installation und Geräteprüfung separat belegen. Gemeinsame serverseitige **Admin-Beschränkung bleibt bestehen**; eine App-Navigation erteilt keine Suchrechte. WEB hat die kompakte gemeinsame Kartenvorschau veröffentlicht (keine gestreckten Leerflächen). |
| **Crew / Profile** | Personen, Tätigkeiten, Fähigkeiten, Ortsangaben, Bilder und Kontakt | Gemeinsame Website-Daten und aktuelle Sichtbarkeitsrechte; native Darstellung separat prüfen. WEB hat die bisher konstante Gesamtzahl bei Anbieterfiltern korrigiert und veröffentlicht: aktuelle gefilterte Auswahl, identisch zum Karten-Datensatz. Neue native Installation und Geräteabnahme bleiben offen. |
| **Marktplatz / Dienstleistungen / Fahrzeuge** | Angebote, Anbieter, Bilder, Anfragen und Filter | Gemeinsame Angebotsregeln; Website/API unterstützt seit 21.11. 155 Währungen (`ab74924d`), ohne Umrechnung. Native Anzeigen und Editoren separat abgleichen und auf dem Gerät prüfen. |
| **Locations** | Drehorte/Studios, Suche, Details und Karten | Gemeinsamer Zählerfix `822c27c` übernommen: gefilterte Gesamtzahl bleibt beim Kartenziehen stabil; fehlende Kartenpunkte über die Liste erreichbar. App-Beschriftung „gesamt“ in `b1d767a` vorbereitet. |
| **Firmen** | Profile, Leistungen, Teams und Angebote | Gemeinsame Firmen-/Personenrechte; versteckte persönliche Identitäten nicht über Firmen offenlegen. |
| **Filmtiere / Jobs / Schwarzes Brett** | Weitere bestehende CineGenius-Bereiche | Website-Bestand vorhanden; vollständige native Erreichbarkeit und Bedienung pro App-Build verifizieren. Keine zusätzliche fertige native Spezialanwendung behauptet. |
| **News** | Artikel, Themen, Technik, Länder, Veranstaltungen und Organisationen | Gemeinsame redaktionelle Daten: zentrale CineGenius Redaktion und drei Mexiko-/IMCINE-Beiträge sind auf der Website live. Eintrags-IDs erhalten; neue eigene News unter demselben Herausgeber. Native Anzeige/Navigation gesondert prüfen; kein Veröffentlichungsschlüssel in der App. |
| **Organisationen / Branchenpartner** | Verzeichnisse, Profile und Beiträge | Frühere Zählerergänzungen aus `b1d767a` mit künstlichen Daten geprüft; Geräteabnahme separat. WEB-Stand `34373818` seit 21.11. veröffentlicht und zusätzlich in vier echten Live-Browserkonfigurationen geprüft: öffentliche Beitragsfilter nach Land/Thema/Art/Originalquelle, Suche und Seiten, keine internen Daten. APP-Abgleich dokumentiert; native Umsetzung/Installation und echte Geräteprüfung nicht enthalten. [Vertrag](public-newsroom-browser.md). |
| **Projekte** | Öffentliche Projekte, Credits und eigene Mitwirkung | Gemeinsame Rechte und Daten. Öffentliche Projektprofile vom privaten Work-Projektarchiv unterscheiden. |
| **Shots** | Vorgesehene kurze Posts, 24 Stunden sichtbar, eigene Originale anschließend privat | Oberfläche und geschützter Servercode vorbereitet; **Veröffentlichung nicht aktiviert**. Kein laufender echter Posting-Dienst allein durch sichtbaren Tab. |
| **Karten** | Antippbare Einträge, Cluster, Karten-/Listenwechsel, fehlende Positionen erreichbar halten | Web-Zählerfix `822c27c` übernommen als `d7abae6` in separater App-Arbeit. Native Smart-/Organisationen-Ergänzungen `b1d767a` umgesetzt: 76 gezielte Tests und 36 Chromium-/WebKit-Fälle bestanden, 17 Sprachen. Noch nicht durch den Web-Livegang veröffentlicht; kein echter Geräte-/Kacheltest. |

## Konto, Kommunikation und Inhalte

| Bereich | Umfang | Stand / nächste Prüfung |
| --- | --- | --- |
| **Anmeldung / Einrichtung** | Gemeinsames Konto, wiederaufnehmbares Setup und passende Profilschritte | Gemeinsame Anmeldung und Rückkehrwege; echte Geräteabläufe beim aktuellen Build prüfen. Web-/Serverkorrektur Firmen-Abschlusslink am 21.11. als `91a508d5` veröffentlicht: `data.slug` zur Navigation, `data.id` bleibt Abschlusskennung; optionale private Wiederherstellung `completed.companySlug`. Alter ID-Link live geprüft. Siehe `company-onboarding-links.md`; native Prüfung separat. |
| **Profil / Einstellungen** | Identität, Haupt-/Nebentätigkeiten, Pronomen, Bilder, Sprache und Benachrichtigungen | Gemeinsame Verträge; native Felder und gespeicherte Werte synchron halten. |
| **Avatare / Cover** | Frei wählbare Darstellung, eigene Fotos, exklusive Motive und Besitzregeln | Web-Vertrag vorhanden. Native Auswahl und Bildnachschub nicht ohne konkreten Test als aktiviert melden; Tauschen bleibt geplant. |
| **Privatsphäre** | Öffentlich, Mitglieder, Freunde, Ghost und Orts-/Kartenrechte | Serverrechte gelten unverändert in der App. Geräte-/Zwischenspeicher dürfen frühere private Inhalte nicht wieder sichtbar machen. |
| **Nachrichten** | Einzel-/Gruppenchats, Bilder/Dokumente, Verlauf und Lesestatus | Gemeinsamer Nachrichtendienst; Gerätescrollen, Tastatur, große Anhänge und Rückkehr separat testen. |
| **Mitteilungen / Freunde / Homies** | Hinweise, Anfragen, bestätigte Kontakte und markierte Lieblingskontakte | Bestehender Kontaktvertrag; Homies sind Lieblingskontakte, keine zweite allgemeine Merkliste. |
| **Merkliste** | Gespeicherte Angebote und Profile | Gemeinsame aktuelle Berechtigungen; keine privaten Altvorschauen. |
| **Inserieren / Verwalten** | Eigene Angebote, Firmen, Organisationen, Bearbeiten und Status | Dieselben Freigaben wie im Web; App-eigene Formulare/Wege pro Build prüfen. |
| **Buchungen / Anfragen / Rechnungen** | Bestehende Vorgänge und Status | Gemeinsame Kontodaten; kein automatischer Zahlungsdienst als aktiv bestätigt. |
| **Hilfe / Support / Recht** | FAQ, Kontakt, Meldungen, Impressum, Datenschutz, AGB und Bildrechte | Gemeinsame Inhalte erreichbar halten; Konto- und externe Link-Rückkehr prüfen. |
| **Mitgestalten / Feedback** | Ländervertreter beantworten kurze Fragen und geben eigene Rückmeldungen; Markus bekommt gesammelte Ergebnisse | Website und gemeinsame Schnittstellen **seit 21.11. live** (`ab74924d`); isolierte Bedienprüfung bestanden. Native Einbindung beauftragt/abzustimmen, nicht als fertige App-Funktion behaupten. Gleiche privaten Gespräche und Zusammenfassungen verwenden. |

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
| **Länderpriorisierung** | WEB veröffentlicht (`4d93523a`): Aufrufland vor Profil-Land, Gäste eingeschlossen; manuelle Auswahl bleibt maßgeblich. [Vertrag](country-first-discovery.md), 162 Tests und 32 simulierte Browserfälle. APP dokumentiert den Vertrag in `63867e4`, Funktionsübernahme und echte Geräteprüfung offen. `country=all` bei Organisationen/Brett nicht entfernen. Native Funktionsübernahme noch nicht veröffentlicht. |
| **Sprachen / Währungen** | 17 Web-Sprachkataloge vorhanden; native Texte separat vollständig halten. Währung und Sprache sind nicht automatisch das Land. 155 Währungen auf der veröffentlichten Website; `metadata.price_currency`, `crew.price_currency` und Buchungs-Snapshot übernehmen. Keine Umrechnung; native Anzeigen/Editoren noch abzugleichen. |
| **Push** | Code/Verträge vorbereitet, **nicht aktiviert**. Apple-Konfiguration, Dienstbetrieb und echter Empfang/Antippen/Abmelden-Test fehlen als Aktivierungsbeleg. |
| **Hintergrunddienste** | Kein laufender Dienst allein durch vorhandenen Worker-Code. Zeitplan, Rechte, Aktivierungsstatus und tatsächliche Verarbeitung gesondert belegen. |
| **Fotos / Dokumente / Datenschutz** | Aktuelle Rechte, kanonische Medienquelle, private Wiederherstellung, lokale Daten und Kontowechsel gemeinsam absichern. |
| **Geräteprüfung** | 320px-Browserprüfung ist kein iPhone-Test. iPhone, iPad, große Schrift, Tastatur, sichere Bildschirmränder, Zurück und unterbrochene Aktionen separat dokumentieren. |

## Nächste Schritte und Pflege

1. Den veröffentlichten gemeinsamen Serverstand `91a508d5` einschließlich App `68930dd9` erhalten. Die erneute Freigabe gilt für dieses geprüfte Paket; Installation und echte Bedienungsnachweise separat mit APP nachführen.
2. Installierten Build 2026112007 mit dem tatsächlichen Serverstand auf dem Gerät prüfen, insbesondere Smart, Work und den Wechsel zur Community; Ergebnisse von Browserprüfungen unterscheiden. Vier Farbvorlagen in APP abstimmen, erst nach Auswahl umsetzen.
3. Geprüfte native Zählerergänzungen `b1d767a` und `38d87bb` separat mit dem aktuellen App-Release abstimmen; Veröffentlichung und echte Geräteprüfung bleiben offen.
4. Länderpriorisierung sowie Feedback-/Währungsfunktionen aus [dem gemeinsamen Vertrag](international-currency-feedback.md) mit dem aktuellen App-Stand abgleichen. Echte Geräteprüfung bleibt offen.
5. Work-Funktionsstand mit APP konkretisieren; unbelegte Teilfunktionen als offen führen.
6. Die veröffentlichte CineGenius Redaktion auf dem tatsächlichen App-Build prüfen: bisherige Eintrags-IDs/Bilder/Länder erhalten, alte Links funktionieren, zentrale Organisation und Quellenverweise prüfen. 17 Bestandsbeiträge plus ein echter maschinell geprüfter Artikel sind live. Native News-Verträge bleiben erhalten; kein neuer App-Release, keine Maschinenrechte im Client. Details und Grenzen im Redaktionsabgleich der Website-Übersicht.

**Zähler-Prüfbeleg (20.11.):** `/srv/cinegenius/handoffs/20261120-app-map-counts/receipt.json`, Stand `38d87bb437dec53d0fa4d0c01eded451ebd39d8d`: 76 Regressionen, 36 Browserfälle, 17 Sprachen, TypeScript und vollständiger Build bestanden. Browserprüfungen nutzen künstliche Daten und Kartenereignisse; kein echter Geräte-/Anmeldungs-/Kartenkacheltest. Native Ergänzungen noch nicht veröffentlicht.

**Pflege:** APP Entwicklung ergänzt bei jeder App-Änderung den betroffenen Bereich mit Datum, Build/Commit, Prüfbeleg, Aktivierung und offenen Grenzen. WEB CODEX hält gemeinsame Schnittstellen in beiden Übersichten gleich. Änderungen an einer App-Oberfläche gelten nicht automatisch für die Website. Keine automatische Hintergrundprüfung wird durch diese Dokumentation eingerichtet.

**Belege:** [aktueller App-Vertrag](design/app-current-20261119.md), [App-Server](app-server-release-20261119.md), [native Smart-Ansicht](native-smart-discovery.md), [Freunde/Homies](native-friends-contract.md), [Push](native-push.md), [Shots](shots-ephemeral.md), [Hintergrunddienste](app-background-workers.md), [App-Produktvorgaben](app-product-flows.md). Ältere Navigations- und Smart-Freigaben in diesen Berichten sind durch neuere Betreiberentscheidungen ersetzt. Aktuelle Installations-/Release-Angaben stammen aus der APP-Abstimmung vom 20.11.2026; ein eigener Gerätezugriff dieses Website-Auftrags fand nicht statt.

**Homepage-Crew-Rotation:** 24 Stunden Vorrang für neue Profile, danach alle 15 Minuten wechselnde Mischung auch älterer Mitglieder; Website veröffentlicht; ursprünglicher Entwurf `f6b45be5`, 48 gezielte Tests bestanden. Native Verzeichnis-Sortierung und Release-Halt unverändert.

**Kompakte Kartenvorschau:** WEB `acd306e3` geprüft und im Websitepaket veröffentlicht. APP meldet Übernahme in `37f234a4`, gesicherter Prüfstand `ff3266c0`: 30 Chromium-/WebKit-Fälle plus zwei lange Listen, 68 Tests. Keine echte Geräteprüfung und keine Veröffentlichung. Release-Halt bleibt bestehen.

**Crew-Zähler-Nachtrag:** APP meldet den gefilterten gemeinsamen Crew-Zähler in `a40a2bc6`, Prüfstand `80726452`: 29 gezielte Tests und zehn Browserfälle. Noch nicht veröffentlicht; kein echter Gerätetest durch WEB.


**Website-Release (20.11.):** Länderpräferenz, gefilterte Zähler, kompakte Smart-Vorschau und 24-Stunden-Crew-Rotation sind als Websitepaket veröffentlicht. Der zusätzliche Randpin-Fokusfix ist Bestandteil der abschließenden Web-Abnahme. Keine Veröffentlichung der zurückgehaltenen nativen Smart/Work-Änderungen; Web-Browsertests sind keine Geräteprüfung. Beleg und APP-Handoff: `/srv/cinegenius/handoffs/20261120-country-first-release/`.

**Redaktionsfreigabe (20.11.):** Website/API unter einem zentralen Herausgeber veröffentlicht; Länderfilter behalten drei Mexiko-Beiträge. Aktive stündliche Recherche mit separatem Publisher; ohne automatische Fotos oder Nutzungslernfeed. Browserprüfungen ersetzen keine native Prüfung. Handoff und tatsächlicher Übermittlungsstatus: `/srv/cinegenius/handoffs/20261120-newsroom-release/`.

**Übergabe Internationalisierung (21.11.):** Website und gemeinsame Schnittstellen veröffentlicht (`ab74924d`), Buchungs-Währungsmigration angewandt und geprüft. Vertrag `international-currency-feedback.md`, aktueller Release-Beleg `/srv/cinegenius/handoffs/20261121-international-release/`. APP Entwicklung wurde über den funktionierenden Chat erreicht. Kein echter App-/KI-Test behauptet.

## News-Erweiterung · 21. November 2026

**Live auf der Website:** Galerien mit bis zu acht geschützten Bildern, sichtbaren
Urheber-/Lizenz-/Archivnachweisen und unveränderten Originalen. Die automatische
Bildauswahl ist nach echtem privaten Upload, geprüftem Derivat und öffentlichem
Artikeltest aktiviert. Der Ablaufdienst prüft eigene Veröffentlichungen; belegte
Altimporte werden nur mit ihrer gesonderten Berechtigung ausgeblendet.

**Datenschutz und Statistik:** Artikelbeobachtungen erfordern die erneuerte
Einwilligung; bestehende Ablehnungen bleiben wirksam. Der private Lernfeed bleibt
ohne PostHog-Lesezugang ausdrücklich unverfügbar. Keine künstlichen Leserzahlen
und kein behauptetes Lernen ohne Daten.

**Geprüft:** Öffentliche Website in vier Browsergrößen (320/390/768/1440 px),
Deutsch/Spanisch und mit drei Mexiko-Artikeln. Echte mobile Bildansicht mit Quelle,
Lizenz und Archivjahr; 17 Sprachen in den isolierten Galerie-/Editor-Prüfungen.
Der zusätzliche Übersetzungsfix `a44cdec2` ist live: 92 Prüfungen, Scrolltest auf
Handy und Laptop sowie echte deutsche/spanische Übersetzungen bestanden.
Festivalname/Archivdatum stimmen, Titel, Kurzfassung, Caption und Volltext werden
übersetzt; Scrollen benötigt nur eine Artikelanfrage. Originale bleiben unverändert.
Das ist keine vollständige menschliche Sprachabnahme aller dynamischen KI-Texte.

**Noch offen:** PostHog-Lesezugang, native Abnahme und Beobachtung des ersten
regulären Bildlaufs. Der iPhone-Simulator erreichte noch keine bedienbare App;
Browserprüfungen ersetzen diese Abnahme nicht. Smart-/Work-App-Halt bleibt erhalten.

Währungen und Ländervertreter-Feedback sind seit 21.11. auf der Website
veröffentlicht (`ab74924d`). Die native Übernahme bleibt getrennt offen.
Der gemeinsame Stand bestand 166 gezielte Prüfungen und den vollständigen Build;
der News-Übersetzungsfix anschließend ebenfalls. Keine Summierung wiederholter Tests.

Verträge: [News-Galerie und Nutzung](news-gallery-readership.md),
[Internationaler Ausbau](international-currency-feedback.md),
[Gemeinsamer Prüfstand](international-news-release.md).
Aktueller Livebeleg: `/srv/cinegenius/handoffs/20261121-news-gallery-release/`.

**App-Stand:** Die genannten Veröffentlichungen betreffen Website und gemeinsame
Schnittstellen. Die native Oberfläche, Installation und Geräteprüfung bleiben
eigenständige APP-Arbeit. Das Handoff enthält geprüfte Commits und offene Grenzen;
die frühere Chat-Störung ist behoben, die aktuelle Übergabe erfolgt an APP Entwicklung.

## Homepage-Newsfotos · Web-Vertrag vom 21. November 2026

Website-Commit `1aa844cc7321218f7313e3a29adc95bc7edccff0` ist veröffentlicht und
in vier öffentlichen Browserkonfigurationen geprüft. Artikelvorschauen verwenden
das vorhandene Titelbild oder das erste gültige Galeriebild, ohne leere Bildfläche
und ohne ein Herausgeberlogo als Ersatz. Bekannte Urheber/Lizenzen und vollständige
Artikelverweise bleiben erhalten. Geschützte Bilder laufen weiterhin durch die
vorhandene Rechteprüfung; keine neue Datenbankmigration oder zusätzliche API.

APP übernimmt dieses Darstellungsprinzip in die eigene Oberfläche und prüft es
auf dem tatsächlichen Gerät. Ein mobiler Website-Browsertest ist kein nativer
App-Nachweis; der bestehende Smart-/Work-Veröffentlichungshalt bleibt erhalten.
Geprüfter Stand und Livebelege:
`/srv/cinegenius/handoffs/20261121-home-news-photos/`.

## Währungen und Mitgestalten veröffentlicht · 21. November 2026

Website-Quellstand `ab74924dd659454d1d0746c535c514c70251e62a` ist über den bewachten
Releaseweg veröffentlicht. Produktionsalias `www.cinegenius.co` zeigt auf
`dpl_BuCRJ3WyFFrfnKjSYfoKP9t1MBz3` (READY). 176 gezielte Tests, TypeScript, Lint,
17 Sprachkataloge und vier kontrollierte WebKit-Bedienkonfigurationen bestanden.
155 Währungen ohne Umrechnung; private, bestätigte Ländervertreter-Berichte unter
`/mitgestalten`, Admin-Sammlung unter `/mitgestalten/koordination`.
Die Buchungs-Währungsmigration ist mit unveränderten Altbeträgen und Rechten geprüft.
Aktueller Abschluss-/Livebeleg: `/srv/cinegenius/handoffs/20261121-international-release/receipt.json`.
Echter angemeldeter KI-/Versandtest und native Umsetzung/Geräteabnahme bleiben offen.
Kein weiterer News-Runtime- oder nativer Smart-/Work-Livegang ist darin enthalten.

**APP-Newsfotos-Abgleich (Rückmeldung APP, 21.11.):** Produktstand `144059cb`,
mit Abschlussdokumentation `77ed339a` gesichert und gepusht. 50 gezielte Tests,
33 Browserfälle, vier Bildfehlerfälle und vollständiger Build bestanden.
Dies ist ein separater geprüfter App-Quellstand, keine neue Installation oder
Veröffentlichung. Aktuelle Website enthält das Homepage-Verhalten bereits seit
`1aa844cc`; ältere App-Dateien/Kataloge nicht darüberkopieren. Echte Geräteprüfung
bleibt separat. Beleg: `/srv/cinegenius/handoffs/20261121-app-home-news-photos/receipt.json`.

**Live-Nachbesserung:** Frühe lokalisierte Ablehnungen bei Anmeldung, Adminrechten,
Herkunftsprüfung und Kontingent sind nun ebenfalls ausdrücklich privat und
nicht zwischenspeicherbar. 52 gezielte Folgeprüfungen und erneuter Produktionsbuild
bestanden; Berechtigungen unverändert. Die ursprüngliche abgewiesene Gastantwort
enthielt nur den Fehlertext, keine privaten Feedbackdaten.

## Internationaler APP-Abgleich bestätigt · 21. November 2026

APP hat den veröffentlichten Web-Vertrag `ab74924d` abgeglichen und den Stand
`b0c1ea5dbe8d55ba12e703847f0c3c05f335820e` sauber auf
`codex/app-international-handoff-20261121` gesichert. Der einzelne Proxy-Fix
`67cc599d` übernimmt die privaten, nicht speicherbaren frühen Fehlerantworten.
37 gezielte Prüfungen über 17 Sprachen sowie Lint bestanden. Native Quellen und
Sprachkataloge unverändert; kein neuer Gesamtbuild, Browser- oder Gerätetest.

Die ältere App-Basis enthält weiterhin feste EUR-Anzeigen und noch keine neuen
Buchungs-Snapshots oder Mitgestalten-Handler. Bei der Integration aktuellen
`main` als gemeinsame Funktionsbasis verwenden und nur geprüfte native Deltas
erhalten. Keine ältere vollständige Proxy- oder Swift-Datei darüberkopieren.
Die Buchungs-Währungsmigration ist bereits angewandt; keine erneute Ausführung.

Offen: native Preisfelder und Editor-Entwürfe, Filter und Währungsanzeige,
409-Neubestätigung mit erhaltenen Terminen/Notizen, private Feedbackwege,
Kontowechsel und echtes Zurück-Navigieren. Angemeldeter KI-/Versandtest und
iPhone-/Mac-Abnahme bleiben separat. Kein App-Livegang und keine Installation;
Smart-/Work-Halt sowie Push-/Shots- und Prüfagent-Status unverändert.
Beleg: `/srv/cinegenius/handoffs/20261121-app-international-handoff/receipt.json`.

**Web-Einstieg Mitgestalten (21.11., Website live):** Im persönlichen Website-Bereich ist
„Mitgestalten“ jetzt eine gleichwertige Menüzeile vor „Einstellungen“. Bestehendes Ziel
und API-/Privatsphäre-Verträge unverändert. Native Übernahme und Geräteabnahme
bleiben APP-Aufgabe; die Website-Menüprüfung ist kein nativer Nachweis.
Beleg: `/srv/cinegenius/handoffs/20261121-feedback-entry/receipt.json`.

**App-Veröffentlichung angehalten:** Markus hat ausdrücklich klargestellt, dass
der Stopp nur die App betrifft. Die Website-Korrektur `bb26a335` ist freigegeben
und veröffentlicht. Neu vorbereitete native Änderungen und eine neue
iPhone-Installation warten weiterhin auf die nächste ausdrückliche Freigabe.

**Mitgestalten-Dialog (21.11.):** Kurze Frage, Antwort des Mitglieds, direkt die
nächste Frage – ohne Dankesfloskeln, Bestätigung oder Zusammenfassung. Die
serverseitige Vorgabe nutzt weiterhin die gewählte Sprache; alte private
Verläufe und Entwürfe bleiben erhalten. Website-Nachweis/Veröffentlichungsstatus:
`/srv/cinegenius/handoffs/20261121-feedback-brief/receipt.json`. App-Veröffentlichung
bleibt angehalten; kein nativer Gerätenachweis.

## Redaktionsverwaltung · Web-Vertrag vom 21. November 2026

Website-Entwurf mit gemeinsamem privaten Beitragsbrowser und zwei geprüften
API-Einstiegen. Land/Thema/Originalquelle/Herausgeber/Status bleiben getrennt,
Zahlen stammen aus derselben berechtigten Menge wie die Liste. 17 Web-Sprachen;
keine Migration und keine neuen Rechte. Web-Schnittstellen aus `69f4be8f` sind seit
21. November veröffentlicht. Native Übernahme, Installation und Geräteabnahme
sind nicht erfolgt; App-Stopp erhalten. Kein echter angemeldeter Live-Gerätetest.
[Web-Vertrag und Prüfgrenzen](organization-entry-browser.md).


### Lokale native Smart-Kartenkorrektur — 21.11.2026

Karte/Liste synchronisiert den Ausschnitt nun nach abgeschlossenem Zoomen und
Verschieben. Ungeclippten berechtigten Kartenpool erhalten, Liste getrennt filtern;
Herauszoomen aus einem leeren Ausschnitt stellt die geladenen Treffer wieder her.
Fehlende/ungültige Kartenpositionen bleiben separat aufklappbar und zählen nicht
als Ausschnittstreffer. Website behält explizites Anwenden. 87 gezielte Tests,
57 isolierte Chromium-/WebKit-Interaktionschecks und ESLint bestanden; große
TypeScriptprüfung nach lokalem Heap-Abbruch im gemeinsamen Releasebuild offen.
Lokaler Quellstand, noch kein zusätzlicher Live-/Installationsnachweis.
Siehe [Smart-Vertrag](smart-discovery.md#native-viewport-synchronization--21-november-2026)
und App-Arbeitsordner `work/native-smart-viewport-fix-20261121/`.


### Folgekorrekturen aus dem iPhone-Durchlauf — 21. November 2026

- Markus hat die ruhigeren Smart-Bereichsflächen aus der Vorschau bestätigt: neutrale Ränder/Flächen/Titel, kleine Kategoriezeichen farbig; Auswahlbuttons und Kartenfarben bleiben erhalten. Lokal zehn Browserfälle (sieben dunkle Paletten, Heller Stein, gewöhnliche Website) geprüft. Release-Nachweis folgt nach Quellenabgleich.
- Native Work-Folgefassung: gleichmäßigerer Übergang, gültiges Projekte-Symbol, gemeinsame Hell-/Dunkeldarstellung der Modals und X zum Schließen, tatsächliches gewähltes Gewerk in der Arbeitsbeginn-Zeile sowie erweiterte Genie-Bewegungsfläche. Quellprüfung ist kein Gerätebeleg; Build2104 ist weiterhin der zuletzt installierte Stand.
- Die Teams-Vorschau wurde ausdrücklich bestätigt: Team öffnen → Mitglieder, Planung und eigene Ordner auf einer Seite; Planung als Liste. Lokale Umsetzung läuft, bestehende Team-/Dokumentdaten bleiben erhalten. Das ist keine aktivierte Online-Zusammenarbeit.
- Die begrenzte private Genie-Teststrecke ist am 21. November um15:59Berlin abgelaufen (fünf verbuchte Anfragen, kein neues Kontingent/keine automatische Verlängerung). Drei echte Phone-Requests dauerten innerhalb der Testverbindung9,834–10,789Sekunden; native Import-/Anzeigezeiten sind darin nicht enthalten. Kein Beleg für eine bestimmte Modellzeit.

- Native Community-Genie kann jetzt im ganzen sicheren Bildschirmbereich bewegt werden; das X wandert am oberen Rand nach unten. Header und untere Navigation bleiben außerhalb des kleinen Symbols bedienbar. Lokal21 Geometrie-/Flug-/Lifecycle-Tests und26 echte Chromium/WebKit-Prüfungen bestanden. Gewöhnliche Website-Abstände bleiben unverändert; iPhone-Nachweis und gemeinsame Buildprüfung folgen.

- Nach Markus’ Konkretisierung lokal umgesetzt: Systemordner und eigene Ordner umbenennen/sortieren, eigene Unterordner auch in Systemordnern, Teilbäume verschieben, Papierkorb und Wiederherstellung. Persönliche Ablage unter „Meins → Meine Dateien“ hat einen getrennten Kontobereich; bestehende Team-v1-Daten und Projektoriginale bleiben erhalten. Persönliche Dateizuordnung umfasst vorhandene projektbezogene Dispos/Pläne; die separate Grundrisssammlung bleibt erreichbar.73 echte Archivprüfungen,9 gezielte Node-Tests, isolierter SDK-Typcheck und PBX-Prüfung bestanden. Der vollständige2105-Build läuft; unabhängiger Review und physische Abnahme sind noch ausstehend. Keine Online-Teamfreigabe oder allgemeiner Dateiupload behauptet.

- Abschließender Karten-Review: kanonische Position gleicher Trefferidentitäten vor dem Ausschnittsfilter; keine Größenmessung/Bounds-Publikation der verborgenen Karte; Reset-Fit erst bei sichtbarer positiver Größe. Ein später Wechsel zur nativen Darstellung tauscht nur die nötige Resize-Instanz, normale Listenwechsel erhalten die Karte. Alte Instanzcallbacks werden verworfen.90 gezielte Tests und80 echte Chromium/WebKit-Prüfungen bestanden. Die gemeinsame vollständige TypeScript-Prüfung erfolgt im kontrollierten Releasebuild.
