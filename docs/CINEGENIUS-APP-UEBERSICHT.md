# CineGenius · Übersicht der gesamten App

Stand: **21. November 2026 (Europe/Berlin), WEB-Liveverträge und App-Abgleich; übrige Prüfstände je Eintrag**. Zuständig: **APP Entwicklung / Xcode**, gemeinsame Schnittstellen in Abstimmung mit **WEB CODEX**.
Die getrennte [Website-Übersicht](CINEGENIUS-WEBSITE-UEBERSICHT.md) enthält die öffentliche Website und deren Unterseiten.

Diese Übersicht trennt die installierte App, ihre serverseitigen Ansichten, native Werkzeuge und geplante Funktionen. Eine Website-Prüfung bestätigt keinen iPhone-Ablauf. „Vorhanden“ bezeichnet belegten Code oder einen gemeldeten Entwicklungsstand; tatsächliche Aktivierung und Geräteprüfung werden separat genannt.

## Installation und aktueller Rahmen

| Thema | Belegter Stand |
| --- | --- |
| **iPhone-App** | Letzter hier belegter Gerätestand: lokale APP-Aufgabe meldete Build **2026112007** nach Datensicherung installiert. Eine neue Installation oder vollständige Smart-/Work-/Community-Geräteabnahme zum nun veröffentlichten Serverstand `68930dd9` ist in der aktuellen WEB-Übergabe nicht belegt. Keine eigene Geräteprüfung durch diese Server-Aufgabe. |
| **App-Server** | **Veröffentlicht:** Release `91a508d5` seit 21.11., 13:10 Uhr Berlin enthält den vollständigen App-Quellstand `68930dd9` und den Firmenlink-Fix. Abstammung im Git-Verlauf geprüft; Deployment `dpl_CPk147S9NmEePK3DEgYhmP9MSzsx` laut WEB READY. Die erneute Freigabe des geprüften Community-/Work-Pakets ist in `68930dd9:AGENTS.md` dokumentiert und ersetzt dessen früheren Stopp. Installation und tatsächliche Gerätebedienung separat belegen. |
| **Native Navigation** | Ziel gemäß aktuellem App-Vertrag: **Shots · News · Smart · Projekte · Work**. Die gewöhnliche Website behält ihre eigene Navigation. |
| **Obere Aktionen** | Profil, Nachrichten, Suche und Menü; App-eigene Abstände und sichere Bedienung über Kopf-/Fußbereich. |
| **Erscheinungsbild** | Mauve wurde als unpassend zurückgemeldet; die lokale APP-Aufgabe bereitet vier Farbvorlagen vor. Noch keine neue Auswahl oder Themeänderung. Bestehende Farben werden in dieser Server-Folgearbeit nicht geändert. |
| **Weitere Plattformen / Veröffentlichung** | Kein aktueller Beleg für eine veröffentlichte Android-App, einen App-Store-Release oder eine eigenständige Desktop-App in dieser Bestandsaufnahme. iPad-/Mac-Kompatibilität je konkretem Build prüfen. |

## Entdecken und Community

| Bereich | Funktionen | Stand / Grenzen |
| --- | --- | --- |
| **Smart / Entdecken** | Crew, Marktplatz, Locations und Firmen gemeinsam auswählen; Kacheln, Liste und Karte/Liste | Zählerergänzung `b1d767a`: ausdrücklich geladene eindeutige Treffer, getrennte Kartenhinweise und „Alle anzeigen“; vorbereitet, noch nicht veröffentlicht. Gemeinsame serverseitige **Admin-Beschränkung bleibt bestehen**; eine App-Navigation erteilt keine Suchrechte. |
| **Crew / Profile** | Personen, Tätigkeiten, Fähigkeiten, Ortsangaben, Bilder und Kontakt | Neue Crew-Zähldifferenz aus WEB `5ba93dd7` als `a40a2bc6` übernommen: sichtbare und zugängliche Zahl folgt auch bei Anbieterfiltern der aktuellen Auswahl; 29 gezielte Tests und zehn App-Browserfälle bestanden; Details unter [Kartenzähler](map-result-counts.md). Die gemeinsame Website-Korrektur ist inzwischen in `31d3cce2` veröffentlicht; native Ergänzungen bleiben unveröffentlicht und ohne Geräteabnahme. Die Homepage-Rotation ist separat in `0c5e63fd` geprüft und gesichert: 24 Stunden Vorrang, danach serverseitige Mischung; 61 Tests und vollständiger Build bestanden. Native Crew-Reihenfolge unverändert. |
| **Marktplatz / Dienstleistungen / Fahrzeuge** | Angebote, Anbieter, Bilder, Anfragen und Filter | Gemeinsame Website/API unterstützt seit 21.11. 155 Währungen (`ab74924d`); keine Umrechnung. Ältere App-Quellen enthalten noch feste EUR-Anzeigen. [Abgleich und offene native Prüfung](app-international-handoff-20261121.md); kein bestätigter Geräteablauf. |
| **Locations** | Drehorte/Studios, Suche, Details und Karten | Gemeinsamer Zählerfix `822c27c` übernommen: gefilterte Gesamtzahl bleibt beim Kartenziehen stabil; fehlende Kartenpunkte über die Liste erreichbar. App-Beschriftung „gesamt“ in `b1d767a` vorbereitet. |
| **Firmen** | Profile, Leistungen, Teams und Angebote | Gemeinsame Firmen-/Personenrechte; versteckte persönliche Identitäten nicht über Firmen offenlegen. Korrektur des Einrichtungs-Abschlusslinks aus `5103bffd` im gemeinsamen Release `91a508d5` veröffentlicht und öffentlich live geprüft. Firmen-ID für Wiederholung erhalten, zurückgegebenen Slug für Details verwenden. [App-Vertrag und Prüfgrenzen](company-onboarding-links.md); keine native Umsetzung/Installation aus dieser Übergabe. |
| **Filmtiere / Jobs / Schwarzes Brett** | Weitere bestehende CineGenius-Bereiche | Website-Bestand vorhanden; vollständige native Erreichbarkeit und Bedienung pro App-Build verifizieren. Keine zusätzliche fertige native Spezialanwendung behauptet. |
| **News** | Artikel, Themen, Technik, Länder, Veranstaltungen und Organisationen | Kleine Homepage-Artikelfotos sind in WEB `1aa844cc` live. App-Quellen gezielt abgeglichen: 80×64px unbeschnitten, Titelbild vor gültigem Galeriebild, kein leerer Bildplatz oder Herausgeberlogo als Ersatz, vorhandene Urheberangaben. [Abhängigkeiten und Prüfbeleg](app-home-news-photos-20261121.md). Keine neue Geräteinstallation/-abnahme oder App-Veröffentlichung; aktuelle Artikel-Nachweise aus dem veröffentlichten Hauptstand erhalten. |
| **Organisationen / Branchenpartner** | Verzeichnisse, Profile und Beiträge | In `b1d767a` umgesetzt und mit künstlichen Daten geprüft: Gesamtzahl, geladene Seite und Kartenpunkte getrennt; während Filterwechsel keine bestätigte Zahl. Noch nicht veröffentlicht oder auf dem Gerät geprüft. |
| **Projekte** | Öffentliche Projekte, Credits und eigene Mitwirkung | Gemeinsame Rechte und Daten. Öffentliche Projektprofile vom privaten Work-Projektarchiv unterscheiden. |
| **Shots** | Vorgesehene kurze Posts, 24 Stunden sichtbar, eigene Originale anschließend privat | Oberfläche und geschützter Servercode vorbereitet; **Veröffentlichung nicht aktiviert**. Kein laufender echter Posting-Dienst allein durch sichtbaren Tab. |
| **Karten** | Antippbare Einträge, Cluster, Karten-/Listenwechsel, fehlende Positionen erreichbar halten | Web-Zählerfix `822c27c` übernommen als `d7abae6` in separater App-Arbeit. Native Smart-/Organisationen-Ergänzungen `b1d767a` umgesetzt: 76 gezielte Tests und 36 Chromium-/WebKit-Fälle bestanden, 17 Sprachen. Neu: kompakte Smart-Vorschau aus WEB `acd306e3` als APP `37f234a4` übernommen; 30 Browserfälle, zwei zusätzliche Antipp-/Scrollfälle und 68 Regressionstests bestanden. [Prüfung und Grenzen](compact-map-preview.md). App-Ergänzungen nicht veröffentlicht; kein echter Geräte-/Kacheltest. |

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
| **Inserieren / Verwalten** | Eigene Angebote, Firmen, Organisationen, Bearbeiten und Status | Dieselben Freigaben wie im Web; App-eigene Formulare/Wege pro Build prüfen. Redaktionsverwaltung `69f4be8f` auf der Website seit 21.11., 11:48 Uhr Berlin veröffentlicht: Land/Thema/Originalquelle, Herausgeber, Suche/Status/Seitenauswahl. [Schnittstellen und Grenzen](organization-entry-browser.md); keine native Umsetzung oder Installation. |
| **Buchungen / Anfragen / Rechnungen** | Bestehende Vorgänge und Status | Website/API speichert `bookings.currency` als Snapshot und prüft Preis-/Währungsabweichungen vor Bestätigung (409). Migration bereits produktiv angewandt und nachgelesen; nicht erneut ausführen. Native Anzeige, Bestätigung und Erhalt von Notizen/Terminen sind noch abzugleichen. Keine Zahlungsaktivierung. |
| **Hilfe / Support / Recht** | FAQ, Kontakt, Meldungen, Impressum, Datenschutz, AGB und Bildrechte | Gemeinsame Inhalte erreichbar halten; Konto- und externe Link-Rückkehr prüfen. |
| **Mitgestalten / Feedback** | Ländervertreter beantworten kurze Fragen und geben eigene Rückmeldungen; Markus bekommt gesammelte Ergebnisse | Website und gemeinsame Schnittstellen **seit 21.11. live** (`ab74924d`); isolierte Bedienprüfung bestanden. Native Einbindung beauftragt/abzustimmen, nicht als fertige App-Funktion behaupten. Gleiche privaten Gespräche und Zusammenfassungen verwenden. Menüfix `bb26a335`: Mitgestalten direkt vor Einstellungen für alle Mitglieder; auf der Website veröffentlicht und über den Release-Beleg bestätigt. Gesprächsvorgabe seit Website-Commit `42b7d1eb`: nur die nächste einzelne kurze Frage ohne Floskeln. Kein echter Modell-/Gerätenachweis; für den App-Server gilt der oben dokumentierte aktuelle Release. [Abgleich](app-international-handoff-20261121.md). |

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

1. Den veröffentlichten gemeinsamen Serverstand `91a508d5` einschließlich App `68930dd9` erhalten. Die erneute Freigabe gilt für dieses geprüfte Paket; neue Installations-/Bediennachweise getrennt bei der lokalen APP-Aufgabe nachführen. Frühere Stopphinweise unten beschreiben ihren damaligen Stand.
2. Installierten Build 2026112007 mit dem tatsächlichen Serverstand auf dem Gerät prüfen; Server-/Browserbelege nicht als Geräteprüfung ausweisen.
3. Native Zählerergänzungen einschließlich der nachgemeldeten Crew-Filterkorrektur und der kompakten Kartenvorschau separat mit dem lokalen App-Stand abstimmen; danach die separat gesicherte Homepage-Rotation übernehmen. [Gemeinsame Prioritäten](AKTUELLE-AUFTRAEGE.md) erhalten.
4. Die veröffentlichten Länder-/Feedback-/Währungsfunktionen auf Basis des aktuellen Hauptstands mit den nativen Quellen abgleichen. [Befunde, bereits übernommener Cache-Schutz und offene Geräteabnahme](app-international-handoff-20261121.md); die Buchungs-Währungsmigration ist bereits angewandt.
5. Work-Funktionsstand mit APP konkretisieren; unbelegte Teilfunktionen als offen führen.

**Zähler-Prüfbeleg (20.11.):** `/srv/cinegenius/handoffs/20261120-app-map-counts/receipt.json`; [Verhalten und Grenzen](app-map-count-audit-20261120.md). Browserfälle verwenden tatsächliche Bausteine mit künstlichen Daten, Navigation und Kartenereignissen bei 320/393/834px sowie den vorhandenen App-CSS-Kennungen `cinematic`/`pure`. Sie bestätigen nicht das lokale iPhone-Paket 2026112007. TypeScript, 17 Kataloge mit 11211 Schlüsseln, Designprüfung und vollständiger Build (Exitcode 0) sind bestanden; keine neuen Lint-Meldungen, bestehende Abweichungen dokumentiert. Die Kartenhinweise nutzen die vorhandenen App-Text-/Akzentfarben auch auf hellen Flächen. Frühere Buildabbrüche und die genaue abschließende Commit-ID stehen getrennt im Prüfbeleg. Die eingefrorene UI-Folgearbeit `4327fc6` bleibt unverändert.

**Pflege:** APP Entwicklung ergänzt bei jeder App-Änderung den betroffenen Bereich mit Datum, Build/Commit, Prüfbeleg, Aktivierung und offenen Grenzen. WEB CODEX hält gemeinsame Schnittstellen in beiden Übersichten gleich. Änderungen an einer App-Oberfläche gelten nicht automatisch für die Website. Keine automatische Hintergrundprüfung wird durch diese Dokumentation eingerichtet.

**Belege:** [aktueller App-Vertrag](design/app-current-20261119.md), [App-Server](app-server-release-20261119.md), [native Smart-Ansicht](native-smart-discovery.md), [Freunde/Homies](native-friends-contract.md), [Push](native-push.md), [Shots](shots-ephemeral.md), [Hintergrunddienste](app-background-workers.md), [App-Produktvorgaben](app-product-flows.md). Ältere Navigations- und Smart-Freigaben in diesen Berichten sind durch neuere Betreiberentscheidungen ersetzt. Aktuelle Installations-/Release-Angaben stammen aus der APP-Abstimmung vom 20.11.2026; ein eigener Gerätezugriff dieses Website-Auftrags fand nicht statt.

**Redaktionsverwaltung, Dokumentationsabgleich · 21.11.:** Quellcommit
`69f4be8fe3fd33b6cac5784740d37ebfd0a959ce`, Basis `42b7d1eb`. Die neuen privaten
GET-Verträge `/api/organizations/entry-browser` und
`/api/admin/organizations/entry-browser` samt Detail `?id=` sind vorgemerkt.
Der bestehende Workspace-Vertrag bleibt vollständig und nach neuestem Datum
sortiert; `?summary=1` lädt ohne Artikeltexte. Land ohne Stadt bleibt beim
Bearbeiten erhalten. Aktuelle Rechte, private Antworten und Kontowechselschutz
bleiben verpflichtend. 17 Web-Kataloge erweitert; keine native Sprachübernahme.

WEB meldet 34 API-/SQL-Tests mit 1.007 Einträgen/42 Seiten, 21 kontrollierte
Browserfälle und vollständigen Build. Authentifizierung, Router, API und
Entwurfsdienste wurden kontrolliert ersetzt; keine echte Live-Sitzung oder
Geräteprüfung. Diese App-Aufgabe hat Vertrag und ausgewählte Schnittstellen
nachgelesen und nur Dokumentation ergänzt. Keine App-Produktportierung,
Veröffentlichung, Installation oder neue Freigabe; App-Stopp bleibt bestehen.
Prüfbelege: `/srv/cinegenius/handoffs/20261121-newsroom-browser/receipt.json`;
App-Empfang: `/srv/cinegenius/handoffs/20261121-app-newsroom-browser-handoff/receipt.json`.

**Website-Veröffentlichung bestätigt:** Laut aktualisiertem Release-Beleg ist
`69f4be8f` seit 21.11., 11:48 Uhr (Europe/Berlin) live; Deployment
`dpl_EJYCUziu36TTDu89DYBKUEYS3GRb` READY und www-Alias mit Quellenkennung geprüft.
13 Live-HTTP-Prüfungen ohne Anmeldung bestätigen öffentliche Seiten, eigene
Anmeldeweiterleitungen und private/no-store API-Ablehnungen. Keine echte
angemeldete Sitzung oder native Geräteabnahme. Der reine WEB-Dokumentationsstand
`9830263b` ist nachgeführt; diese App-Aufgabe hat nur Belege und Dokumentation
aktualisiert. Keine neue App-Arbeit, Veröffentlichung oder Installation.

**Firmen-Einrichtung, Dokumentationsabgleich · 21.11.:** WEB `5103bffd`
auf Basis `9830263b` korrigiert den Abschlusslink zur bereits gespeicherten Firma.
`quickStart.completed.company` bleibt die ID; optionales `companySlug` erhält
die zurückgegebene Seitenadresse in Navigation und privater Wiederherstellung.
Alte Entwürfe bleiben gültig. Der Browser löst alte ID-Links erst nach der
Firmen-Sichtbarkeitsprüfung auf; native/API-Details verwenden weiterhin Slugs.
Keine Datenmigration, Änderung gespeicherter Firmen oder Rechteausweitung.

WEB-Belege: 58 Tests, 20 kontrollierte WebKit-Fälle in 17 Sprachen, Design,
Kataloge und Build bestanden. Zwei vorhandene Hook-Warnungen; lokale statische
Datenabrufe liefen mangels Supabase-Laufzeitvariablen mit bestehenden Fallbacks.
Kein echter Signup-/Gerätetest. Diese Aufgabe hat Vertrag, drei Produktdatei-
Änderungen und die sechs Build-Eingabehashes nachgelesen; nur Dokumentation
übernommen. Nach eigener ausdrücklicher Freigabe wurde der Firmen-Fix im
gemeinsamen Release `91a508d5` veröffentlicht; der gesamte App-Stand `68930dd9`
ist enthalten. Keine neue native Änderung oder Installation durch diesen
Dokumentationsabgleich; Gerätearbeit bleibt gesondert.
Beleg: `/srv/cinegenius/handoffs/20261121-company-onboarding-link/receipt.json`;
App-Empfang: `/srv/cinegenius/handoffs/20261121-app-company-onboarding-handoff/receipt.json`.

**Release-Abgleich 21.11., 13:10 Uhr Berlin:** Der aktualisierte WEB-Beleg bestätigt
`91a508d5`, Deployment `dpl_CPk147S9NmEePK3DEgYhmP9MSzsx` READY und den www-Alias.
58 Tests bestanden auf dem zusammengeführten Stand. Sechs öffentliche Live-
Navigationsfälle bei 390/768/1366 px in WebKit/Chromium (Deutsch/Spanisch) prüfen
alte ID-Links, kanonischen Slug, Unbekannt-Fall und Anmeldeweiterleitungen.
Stationäre direkte Firmen-/Anmeldeseiten laden Clerk ohne Browserfehler; beim
ID-Redirect wurden bereits gestartete Requests abgebrochen, am Ziel lud Clerk.
Keine echte Registrierung und keine native Geräteprüfung im WEB-Beleg.

Die erneute Freigabe in `68930dd9:AGENTS.md` hebt den damaligen Stopp für das
geprüfte gemeinsame Community-/Work-Paket und dessen Serveransichten auf.
Die Git-Abstammung beider Quellpakete im Release ist hier geprüft; das ersetzt
keine neue Geräteinstallation oder Funktionsabnahme. Ältere Stoppaussagen in
den einzelnen Vorab-Berichten sind historisch. Push, produktive Shots, ein neues
E-Mail-Postfachsystem und allgemeine Online-Teams sind dadurch nicht aktiviert
oder als fertig erklärt. Kein erneuter Deploy aus dieser alten App-Arbeitsbasis.
