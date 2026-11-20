# Aktuelle Aufträge · 20. November 2026

Reihenfolge nach Dringlichkeit und Abhängigkeiten, nicht allein nach Eingang.
Diese Liste ist eine Arbeitsübersicht, kein gestarteter Hintergrundagent.

**Aktuelle Freigabe:** Markus hat den geprüften Website-Stand `f490b47c` mit „stell live“ ausdrücklich zur Veröffentlichung beauftragt. Der separate native App-Halt bleibt bestehen. Die nachfolgenden „noch nicht live“-Angaben sind der Stand vor diesem Livegang; Abschlussbeleg: `/srv/cinegenius/handoffs/20261120-country-first-release/receipt.json`.

| Reihenfolge | Aufgabe | Stand / Abhängigkeit |
| --- | --- | --- |
| 1 · WEB | Widersprüchliche Crew-/Kartenanzahl | Aktiver Fehler. Alte Anbieterfilter-Ausnahme gefunden: oben alle Personen, unten gefilterte Personen. Korrektur fertig geprüft: 10 Browserfälle und 10 gezielte Tests, Typen/Sprachen/Design bestanden. Noch nicht veröffentlicht; App-Release-Halt erhalten. |
| 1 · WEB anschließend | Überdimensionierte Smart-Kartenvorschau | Korrigiert und geprüft: inhaltsabhängige Vorschau, 26 Browserfälle und 41 bestehende Kartentests bestanden. Noch nicht veröffentlicht. Zählkorrektur wurde davor fertig geprüft und gesichert. |
| 1 · APP separat | Hänger in Smart/Work und Wechsel Work → Community | APP diagnostiziert; Release bleibt angehalten. Unfertige native Änderungen nicht durch WEB veröffentlichen; das geprüfte Websitepaket ist separat freigegeben. |
| 2 | Homepage „Die Crew“: neue Mitglieder einen Tag priorisieren, danach mischen | Fertig geprüft (48 Tests), gesichert in `f6b45be5`, Zweig `codex/home-crew-rotation-20261120`. Noch nicht live. Kein neues Design. |
| 3 | Mexiko und weitere Länder | Regionale Vorauswahl für Gäste, Reisende, Startseite und Verzeichnisse umgesetzt: 162 Tests und 32 Browserfälle, 17 Sprachen, Designprüfung und vollständiger Build bestanden. Noch nicht live. Vertrag in `country-first-discovery.md`, APP-Übernahme/Gerätetest offen. Mehrwährungen bleiben separater unvollständiger Entwurf. |
| 4 · WEB / Redaktion | News-Zusammenführung und Technik-/Mexiko-News | Bestehende Themen-/Länderansicht vorhanden. AG DOK hat acht eigene Redaktionsprofile und 17 öffentliche Beiträge inventarisiert; vollständige Rechte-/Bestandsprüfung und sichere Zusammenführung fehlen. Redaktion bleibt eigener abgestimmter Arbeitsstrang. |
| 5 | Mitgestalten / Ländervertreter-Feedback | Entwurf mit Prüfungen vorhanden; Abschluss von Bedienprüfung, KI-Prüfung und App-Abgleich offen. Nicht veröffentlicht. |
| 6 · APP | Hintergrundfarbe und weitere App-Gestaltung | Vier Vorschauen bei APP vorgesehen, noch keine Farbauswahl. Nach Funktionsfehlern weiterführen. |
| fortlaufend | Gesamte Website-/App-Übersichten | `CINEGENIUS-WEBSITE-UEBERSICHT.md` und `CINEGENIUS-APP-UEBERSICHT.md` enthalten weitere Bereiche und offene Grenzen. Neue Aufträge dort und hier zuordnen; nichts als erledigt oder live markieren ohne Beleg. |

Bei akuter Sicherheits- oder Datenverlustgefahr wird diese vorgezogen. Neue
Gestaltungswünsche verdrängen keine laufende Fehlerkorrektur. Ein gesicherter,
geprüfter Entwurf ist keine Veröffentlichung. Explizite Betreiberprioritäten
und Veröffentlichungsfreigaben haben Vorrang.
