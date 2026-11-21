# CineGenius · Übersicht der gesamten Website

Stand: **21. November 2026 (Europe/Berlin), WEB-Liveverträge und App-Abgleich; übrige Prüfstände je Eintrag**. Zuständig: **WEB CODEX**.
Die getrennte [App-Übersicht](CINEGENIUS-APP-UEBERSICHT.md) beschreibt die native Anwendung.

Dieses Verzeichnis hält die Bereiche, ihre Funktionen, den belegten Stand und offene Arbeit zusammen. Es ist eine interne Arbeitsübersicht, keine neue öffentliche Webseite und kein vollständiger Sicherheits- oder Funktionstest. Bei jeder weiteren Änderung wird der betreffende Eintrag aktualisiert.

**Status lesen:** „Vorhanden“ bedeutet im aktuellen Website-Code vorhanden, nicht in dieser Bestandsaufnahme erneut vollständig getestet. „Entwurf“ bedeutet noch nicht veröffentlicht. „Geplant“ bedeutet beauftragt oder besprochen, aber nicht fertig. „Live bestätigt“ benötigt einen konkreten Veröffentlichungsbeleg. Ältere Einzelberichte beschreiben ihren damaligen Prüfstand; sie ersetzen keinen aktuellen Freigabenachweis.

## Öffentliche Bereiche

| Bereich | Was dazugehört | Aktueller Stand / nächste Arbeit |
| --- | --- | --- |
| **Startseite** | Suche, Entdecken, Die Crew, Aus der Branche, Organisationen, Marktplatz, Jobs, frische Einblicke, Branchenpartner, Locations und Schwarzes Brett | Vorhanden. Regionale Auswahl vor der Begrenzung für Crew, Marktplatz, Locations, Jobs und Firmen veröffentlicht im Website-Stand `4d93523a`. Gestaltung erhalten; Foto-Entdeckung bleibt mangels verlässlicher Ortsprojektion global. |
| **Crew** | Personenprofile, Berufe, Haupt-/Nebentätigkeiten, Fähigkeiten, Orte, Anbieter-Wechsel, Suche, Filter, Kacheln/Liste/Karte | Vorhanden. Gemeinsamer Kartenfix veröffentlicht. Nachgemeldete Ausnahme im Crew-Anbieterfilter korrigiert: Die obere Zahl zählt dieselbe Auswahl wie Karte und Liste; veröffentlicht und live geprüft. Keine privaten oder erfundenen Positionen. |
| **Locations** | Drehorte, Studios, Kategorien, Ortsfilter, Detailseiten, Bilder, Kontakt/Anfragen und Ansichten | Vorhanden. Formular- und Suchqualität weiter prüfen; Karte ersetzt keine vollständige Liste. |
| **Marktplatz** | Equipment, Requisiten, Fahrzeuge, Dienstleistungen, Kategorien, Anbieter, Preise, Angebote und Suche | Vorhanden. 155 Währungen sind seit 21.11. veröffentlicht; keine automatische Umrechnung. Gemeldete Smart-Fälle „Lampe“ und „bayerischer Hut“ bleiben als Suchqualitätsfälle erfasst. |
| **Fahrzeuge** | Fahrzeuge als Angebotsart und eigene Detail-/Einstiegsseiten | Vorhanden; gemeinsames Angebots-, Bild- und Berechtigungsmodell verwenden. |
| **Firmen** | Verzeichnis, Leistungen, Firmenprofil, Logo/Cover, Team, Zugehörigkeiten und Angebote | Vorhanden. Mehrfirmen-/Übertragungsabläufe jeweils anhand ihrer tatsächlichen Berechtigungen prüfen; nicht pauschal als komplett erledigt einstufen. |
| **Jobs** | Stellen und Aufträge, Gewerke, Orte, Kategorien, Erstellen und Details | Vorhanden. Die spanische Gewerk-Auswahl ist im aktuellen Hauptstand korrigiert. |
| **Filmtiere** | Tierprofile, Trainer/Anbieter, Suche, Bilder und Anfragen | Vorhanden. Verbindung zur passenden Registrierung und Smart-Tiersuche als durchgehenden Ablauf weiter prüfen. |
| **Projekte** | Film, Foto, Werbung, Social Media, Musikvideo, Dokumentation, Corporate und Events; Credits/Mitwirkungen | Vorhanden. Private Entwürfe und ausdrückliche Veröffentlichung getrennt; Verifizierung bleibt Admin-Aufgabe. |
| **News / Aus der Branche** | Nachrichten, Technik, Kamera/Licht/Ton, Workshops, Veranstaltungen, Länder/Themen, Artikel und Quellen | Homepage-Fotos in `1aa844cc` live: kompakt 80×64px auch mobil, unbeschnitten, Titelbild/Galeriefallback, ohne leere Bildfläche; Herausgeber als Text und vorhandene Nachweise. WEB bestätigt vier öffentliche Browserfälle und READY-Deployment; Beleg `/srv/cinegenius/handoffs/20261121-home-news-photos/receipt.json`. [Getrennter App-Abgleich](app-home-news-photos-20261121.md), Geräteprüfung offen. Redaktion/Runtime bleiben eigene Arbeitsstränge. |
| **Organisationen** | Verzeichnis, Detailseiten, Beiträge, Verwaltung und Einladungen | Vorhanden. Von Firmen und redaktionellen Automationen unterscheiden. |
| **Branchenpartner** | Firmen-/Studio-Präsentation auf der Startseite und weiterführende Profile | Vorhanden. Keine zusätzliche Werbeinventar-Freigabe. |
| **Schwarzes Brett** | Beiträge suchen, erstellen und verwalten | Vorhanden unter `/community`; Änderungen in gemeinsamer Gestaltung halten. |
| **Frische Einblicke / Fotos** | Öffentliche geeignete Fotos aus Profilen/Angeboten, Fotoansichten, BTS/Portfolio und Merken | Vorhanden. Nur aktuell sichtbare Originalquellen; kein privates Foto durch eine Zweitansicht veröffentlichen. |
| **Foto / Social Media** | Öffentliche thematische Einstiege | Vorhanden; deren genaue redaktionelle Aktualität ist nicht neu geprüft. |

## Konto und Zusammenarbeit

| Bereich | Was dazugehört | Stand / Grenzen |
| --- | --- | --- |
| **Anmelden / Registrieren** | E-Mail/Passwort, gewählte Code-Anmeldung, echte zusätzliche Sicherheitsprüfungen, Rückkehrziel | Vorhanden. Keine zusätzliche Profilauswahl vor der eigentlichen Registrierung. |
| **Profil einrichten** | Wiederaufnehmbarer Assistent, Startziel, passende Angaben, Vorschau und Bearbeitung | Vorhanden; persönliche Daten und Angebotsentwürfe bleiben getrennt. |
| **Mein Bereich** | Eigene Profile, Angebote, Firmen, Buchungen, Merkliste, Analysen und Einstellungen | Vorhanden. Aktuelle persönliche Navigation wiederverwenden, alte Direktlinks erhalten. |
| **Mein Profil / öffentliches Profil** | Tätigkeiten, Pronomen, Ort, Bilder, Cover, Beschreibung, Verknüpfungen und Sichtbarkeit | Vorhanden. Haupttätigkeit + zwei Nebentätigkeiten auf Karten; maximal eine weitere Tätigkeit in Details/Suche. |
| **Avatare und Cover** | Eigene Fotos, gemischte Auswahl, feminin/maskulin/neutral, exklusive Bildzuordnung und Reserve | Vorhandene Auswahl und Regeln. Tatsächlich laufenden Nachschub nur mit Aktivierungs-/Bestandsbeleg bestätigen. Persönliche Foto-Avatare sind separate private Vorschauen. Tauschen/Verschenken bleibt geplant. |
| **Privatsphäre** | Öffentlich, nur Mitglieder, Freunde, Ghost, Karte/Ortsangaben und Feldrechte | Vorhanden. Ghost verbirgt auch persönliche Angebote; Firmen haben eigene Sichtbarkeit. |
| **Meine Angebote / Inserieren** | Gemeinsamer Einstieg, passende Formulare, Bearbeiten, private Wiederherstellung, Status und Veröffentlichung | Vorhanden. Angebotsarten behalten ihre unterschiedlichen Freigaberegeln; fehlende Fotos blockieren keine zulässige Veröffentlichung. |
| **Firma verwalten** | Eigentum, Mitarbeit, Anfragen/Einladungen, Rollen und Firmenangebote | Vorhanden. Firmenübertragung und mehrere Firmen nicht ohne gezielten Ablaufnachweis als vollständig getestet markieren. |
| **Organisation verwalten** | Organisationseinladungen, Profil, eigene Inhalte und Freigaben | Vorhanden; getrennt von allgemeinen Mitglieder- und Firmenrechten. |
| **Nachrichten** | Einzel-/Gruppenchats, Verlauf, Suche, Anhänge und Lesestatus | Vorhanden. Scroll-/Ladeverhalten wurde separat bearbeitet; echte Nachrichten niemals als Test ungefragt versenden. |
| **Mitteilungen** | Systemhinweise, Kontaktanfragen und kontogebundene ungelesene Hinweise | Vorhanden. Öffnen allein bestätigt nichts als gelesen oder angenommen. |
| **Freunde / Homies** | Bestätigte Kontakte, Entfernen/Blockieren und markierte Lieblingskontakte | Kontakte vorhanden; Homies-Vertrag mit App abgestimmt. Native Oberfläche und Website nicht ohne Prüfung gleichsetzen. |
| **Merkliste** | Gespeicherte Profile, Angebote und weitere zulässige Inhalte | Vorhanden. Nicht mit bestätigten Freunden/Homies vermischen; aktuelle Sichtbarkeit gilt auch hier. |
| **Buchungen und Anfragen** | Anfrage, Status, Zusage/Absage, Übersicht und Bestätigung | Preis und Währung werden serverseitig nachgelesen; Abweichungen zur Bestätigung ergeben 409. Buchungs-Währungssnapshot und produktiv geprüfte Migration seit 21.11. vorhanden. Keine Zahlungsaktivierung; native Abnahme separat. |
| **Zahlungen / Rechnungen** | Bestehende Rechnungs- und Abrechnungseinstiege | Bestand vorhanden; tatsächliche Zahlungsaktivierung separat belegen. Keine neue Bezahlfunktion beauftragt. |
| **Einstellungen / Sicherheit** | Konto, Anmeldung, Privatsphäre, Benachrichtigungen, Verifizierung und Abmelden | Vorhanden; Änderungen immer kontogebunden. |

## Suche, Genie und Feedback

| Werkzeug | Zweck | Stand / nächste Arbeit |
| --- | --- | --- |
| **Normale Suche** | Website-Suche sowie bereichseigene Suche und Filter | Vorhanden. Kategorie- und Ortsoptionen sollen tatsächlich vorhandene sichtbare Inhalte abbilden. |
| **Smart** | Mehrere Wünsche und Orte, Bereichsgruppen, Mengen/Anforderungen, Karte und nahe Alternativen | Implementiert, **weiterhin nur für berechtigte Admins**; Mitglieder sehen eine statische Vorschau. Freie Formulierungen sind keine garantiert fehlerfreien Ergebnisse. Kompakte Smart-Kartenvorschau veröffentlicht: inhaltsabhängige Höhe statt gestreckter Leerfläche. |
| **Genie** | Plattformhilfe, Textunterstützung, Sprache und erlaubte Suche | Vorhanden. Smart-Rechte gelten auch über Genie; normale Hilfe bleibt davon getrennt. Kein automatisches Modelltraining durch Unterhaltungen. |
| **Work-Einstieg** | Hinweis bzw. Übergang zu vorgesehenen Arbeitswerkzeugen | Öffentlicher Werkzeug-Hinweis und App-Einstieg vorhanden. Vollständiger nativer Workspace gehört in die App-Übersicht, nicht als fertige Web-Anwendung ausgeben. |
| **Mitgestalten / Länder-Feedback** | Vertreter aus Mexiko, Ungarn und anderen Ländern prüfen CineGenius unabhängig voneinander; KI fragt z. B. „Ist Crew bei euch die richtige Bezeichnung?“ | **Website live seit 21.11.** Login, private Gesprächsentwürfe, freie Eingabe, Länder-/Sprachbezug und bestätigtes Absenden sind isoliert geprüft. Echter KI-Gesprächs-/Versandtest und native Übernahme bleiben offen. Sichtbarerer Einstieg vor Einstellungen in `bb26a335` auf der Website veröffentlicht: `dpl_BWXujHdNNMwaAHAowm2bGAv8EpVQ` READY, www-Alias geprüft. Seit `42b7d1eb` ist außerdem die kurze Frage-Antwort-Folge als Servervorgabe veröffentlicht; echte Modellabnahme fehlt. App-Veröffentlichung und iPhone-Update bleiben angehalten. |
| **Feedback-Koordination** | Markus erhält Originalrückmeldungen und eine geordnete deutsche Zusammenfassung mit Verbesserungsvorschlägen | **Website live seit 21.11.**, mit Admin-Zugriff und Belegstellen. Browserprüfung inklusive Fehler/Wiederholung und Kontowechsel bestanden; echter KI-Test und native Übernahme offen. Keine automatische Umsetzung. Quellstand `ab74924d`. |

## Länder, Sprache und gemeinsame Grundlagen

| Thema | Stand | Nächster Schritt |
| --- | --- | --- |
| **Regionale Inhalte zuerst** | Website veröffentlicht (`4d93523a`): Aufrufland zuerst, eigener Profilort im selben Land zur Verfeinerung oder als Rückfall. Auch für Gäste; Live-Gastabruf geprüft. 162 Tests und 32 Browserfälle bestanden. | [Gemeinsamer Vertrag](country-first-discovery.md). Manuelle Länder-/Ortswahl und „Alle“ bleiben maßgeblich; Auswahl vor Begrenzung/Nachladen. APP-Übernahme und echte Geräte-/Regionsprüfung offen. |
| **Mehrsprachigkeit** | 17 Website-Kataloge: Deutsch, Englisch, Spanisch, Italienisch, Tschechisch, Ungarisch, Niederländisch, Belgisch-Niederländisch, Schwedisch, Französisch, Polnisch, Portugiesisch (Portugal), vereinfachtes Chinesisch, Japanisch, Koreanisch, Russisch, Ukrainisch | Katalogvollständigkeit beweist keine vollständige sprachliche Qualität. Mexikanische Bezeichnungen prüfen; Crew bleibt dort Crew, Equipment wird Equipo. Mitgliedertexte und Rechtsoriginale nicht ungefragt umschreiben. |
| **Währungen / internationale Formulare** | 155 Währungen in den bestehenden Formularen, Anzeigen, Preisfiltern und Buchungsanfragen veröffentlicht (`ab74924d`, 21.11.) | Mexiko, Italien, Spanien, Frankreich, Schweiz, Österreich, Ungarn und bereits vertretene Länder prüfen. Anbieter wählen Währung; keine automatische Umrechnung. |
| **Karten / Ergebniszahlen** | Gemeinsamer Fix `822c27c` sowie Crew-Anbieterzählung und kompakte Vorschau einschließlich Randpin-Fokuskorrektur auf der Website veröffentlicht; abschließender Länder-/Kartenstand `31d3cce2` live geprüft. | Gesamtbestand, Kartentreffer, außerhalb des Ausschnitts und ohne Kartenposition unterscheiden. Beleg: `/srv/cinegenius/handoffs/20261120-country-first-release/receipt.json`. App-Ergänzungen bleiben eigener, unveröffentlichter Stand; [Abgleich und Grenzen](compact-map-preview.md). |
| **Bilder und Dateien** | Gemeinsame geschützte Medienausgabe, optionale Fotos, robuste Vorschauen | Ursprung und aktuelle Rechte erhalten; alte öffentlich verteilte Dateien sind nicht allein durch versteckte Karten zurückgerufen. |
| **Formularentwürfe** | Private kontogebundene Wiederherstellung und Navigationsschutz | Nicht mit Autospeichern öffentlicher Inhalte verwechseln. |
| **E-Mails** | Gemeinsame Gestaltung und lokalisierte Anwendungstexte; Anbieter-Vorlagen separat | Website-Release aktualisiert keine extern verwaltete Vorlage automatisch. |
| **Statistik** | PostHog-Anbindung dokumentiert | Besucherberichte benötigen tatsächliche Daten und Zeitraum; keine Zahlen aus dieser Übersicht ableiten. |
| **Sicherheit / Leistung** | Bestehende Authentifizierung, Rechte, Datenschutz und frühere Prüfberichte | Frühere Prüfungen nicht als heutige Komplettfreigabe ausgeben. Offene Warnungen, Abhängigkeiten und konkrete Maßnahmen separat nachhalten. Täglicher Website-Prüfagent bleibt deaktiviert. |

## Hilfe, Recht und interne Verwaltung

| Bereich | Umfang | Stand |
| --- | --- | --- |
| **Hilfe / FAQ / Support** | Anleitungen, Kontakt, Fehlermeldungen, Moderationsmeldungen und Vertrauensinformationen | Vorhanden; Anleitungen bei geänderten Abläufen nachführen. |
| **Über CineGenius / Kosten** | Community-Zweck, kostenlose Basis/Profile, mögliche künftige optionale Funktionen | Vorhandene Preis-/Support-Dokumentation und aktuelle Betreiberentscheidungen zusammen prüfen; keine alte Provisionsantwort wieder einführen. |
| **Rechtliche Seiten** | Impressum, Datenschutz, AGB, Bildrechte, KI-Transparenz und Uploadhinweise | Vorhanden. Betreiberangaben und tatsächliche Verarbeitung aktuell halten; diese Inventur ist keine neue rechtliche Prüfung. |
| **Newsletter** | Anmeldung, Bestätigung und Abmeldung | Vorhanden. Freiwillige ausdrückliche Einwilligung, keine stillschweigende Newsletter-Anmeldung. |
| **Admin** | Konten, Angebote, Prüfungen, Orte, Aktualität, Support und Verwaltung | Vorhanden; serverseitige Rechte. Feedback-Koordination seit 21.11. veröffentlicht; nur für berechtigte Admins. |
| **Redaktionsbetrieb** | AG DOK / NEWS, Technikrecherche, Quellen, Rechte, Dubletten und Länderzuordnung | Teilweise automatisierte Recherche gemeldet. Recherche, Entwurf, Freigabe und echte Veröffentlichung getrennt belegen; IMCINE-Erweiterung ist kein neuer doppelter Agent. |
| **Aktualität von Profilen/Angeboten** | Bestandsprüfung, Hinweise und geregeltes Ausblenden veralteter Inhalte | Dokumentiert; tatsächliche Zeitpläne/Aktivierung brauchen Betriebsbeleg, keine unbestätigte automatische Löschung zusagen. |
| **Werbung** | Bestehender historischer Pfad `/werben` | Kein freigegebenes aktives Werbeinventar; keine Banner oder Buchungsplätze reaktivieren. |

## Aktuell offene Arbeit

1. Veröffentlichte Länderpriorisierung mit den aktuellen nativen Quellen und tatsächlichen Geräten abgleichen.
2. Mitgestalten und Feedback-Koordination sind veröffentlicht; echte angemeldete KI-/Versandabnahme und native Übernahme bleiben offen.
3. 155 Währungen und Buchungs-Snapshots sind veröffentlicht; native Editoren/Anzeigen und der dokumentierte Altbestand bleiben abzugleichen. [App-Befunde](app-international-handoff-20261121.md).
4. App-Zählerergänzungen und laufenden App-Server-Release getrennt abgleichen.
5. Gemeldete freie Smart-Suchen und mehrsprachige Fachbegriffe mit echten Suchfällen prüfen; Zugriff bleibt eingeschränkt.
6. Redaktionelle Mexiko-/Technik-Erweiterungen mit AG DOK nach Quelle, Freigabe und tatsächlich veröffentlichtem Ergebnis unterscheiden.

## Pflege und Belege

- Bei einer Änderung: Bereich, Status, Datum, zuständige Arbeit, Prüfung, Grenzen und nächste Schritte aktualisieren. Neue Bereiche ergänzen, abgelöste Funktionen kenntlich machen.
- „Live“ erst nach bestätigtem Deployment; „App installiert“ und „auf echtem Gerät geprüft“ sind eigene Nachweise.
- Gemeinsame Schnittstellen in der [App-Übersicht](CINEGENIUS-APP-UEBERSICHT.md) und bei APP Entwicklung nachführen. Keine Behauptung, dass diese Datei von selbst Hintergrundarbeit ausführt.
- Quellen: aktueller Hauptstand `822c27c`, `app/**/page.tsx`, [Karten-Zähler](map-result-counts.md), [Smart-Zugriff](smart-development-preview.md), [Privatsphäre](profile-privacy.md), [persönlicher Bereich](personal-area.md), [News-Themen](home-news-topics.md), [Dienstleistungen](marketplace-services.md), [Projektabläufe](projects-workflow.md), [Artworks](profile-art-stock.md), [E-Mails](email-branding.md), [Statistik](posthog-analytics.md).
- Veröffentlichungsbeleg Karten: `/srv/cinegenius/handoffs/20261120-map-counts/receipt.json` und `deploy.log`. Die Feedback- und Währungsentwürfe sind nicht Bestandteil dieses Releases.
