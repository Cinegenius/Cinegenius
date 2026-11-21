# Aktuelle Aufträge · ergänzt am 21. November 2026

Reihenfolge nach Dringlichkeit und Abhängigkeiten, nicht allein nach Eingang.
Diese Liste ist eine Arbeitsübersicht, kein gestarteter Hintergrundagent.

| Reihenfolge | Aufgabe | Stand / Abhängigkeit |
| --- | --- | --- |
| 1 · WEB | Widersprüchliche Crew-/Kartenanzahl | Aktiver Fehler. Alte Anbieterfilter-Ausnahme gefunden: oben alle Personen, unten gefilterte Personen. WEB-Korrektur fertig geprüft: 10 Browserfälle und 10 gezielte Tests, Typen/Sprachen/Design bestanden. APP-Port `a40a2bc6` separat: 29 Tests, zehn native Browserfälle, Typen, 17 Kataloge und Design bestanden; endgültiger Beleg unter `/srv/cinegenius/handoffs/20261120-app-crew-filter-count/receipt.json`. Noch nicht veröffentlicht; App-Release-Halt erhalten. |
| 1 · APP separat | Hänger in Smart/Work und Wechsel Work → Community | Lokale Mac-APP-Aufgabe diagnostiziert laut Abstimmung; Release bleibt angehalten. Diese Server-Folgearbeit prüft die gemeinsamen Zähler. Keine parallele Veröffentlichung durch WEB. |
| 1 · WEB/APP Folgearbeit | Kompakte Vorschau nach Antippen eines Kartenpunkts | Nach abgeschlossener Zählerkorrektur aus WEB `acd306e3` in APP `37f234a4` übernommen. 30 Browserfälle, zwei zusätzliche Antipp-/Scrollfälle, 68 Regressionstests, Sprachen/Design/Lint bestanden. [Beleg und Grenzen](compact-map-preview.md). Gesichert, nicht live und nicht auf dem iPhone geprüft; Release-Halt bleibt bestehen. |
| 2 | Homepage „Die Crew“: neue Mitglieder einen Tag priorisieren, danach mischen | Fertig geprüft (48 Tests), gesichert in `f6b45be5`, Zweig `codex/home-crew-rotation-20261120`. Noch nicht live. In APP separat als `0c5e63fd` gesichert (61 Tests, vollständiger Build). Kein neues Design. |
| 3 | Mexiko und weitere Länder | WEB setzt Länderpriorisierung auf `codex/country-first-discovery-20261120` um; Gesamtstand noch ungeprüft, kein App-Port/Livegang. Gast-/Reisevertrag im [App-Länderbericht](app-regionalization-20261120.md) vorgemerkt; geprüften Commit und Nachweise vor Übernahme abwarten. Mehrwährungen separat als unvollständiger Entwurf. Zuerst gemeinsamer Länder-/Preisvertrag, dann Web-/App-Abnahme. |
| 4 · WEB / Redaktion | News-Zusammenführung und Technik-/Mexiko-News | Bestehende Themen-/Länderansicht vorhanden. AG DOK hat acht eigene Redaktionsprofile und 17 öffentliche Beiträge inventarisiert; vollständige Rechte-/Bestandsprüfung und sichere Zusammenführung fehlen. Redaktion bleibt eigener abgestimmter Arbeitsstrang. |
| 4 · APP-Abgleich | Kleine Homepage-Newsfotos | WEB `1aa844cc` veröffentlicht. Auf ältere App-Quellen begrenzt übernommen; [Prüfbeleg und Integrationsabhängigkeiten](app-home-news-photos-20261121.md). Vollständige Galerie-/Artikelregeln des neueren Hauptstands erhalten; echte Geräteprüfung bleibt bei der lokalen Mac-Aufgabe offen. App-Release-Halt besteht weiter. |
| 5 | Mitgestalten / Ländervertreter-Feedback | Entwurf mit Prüfungen vorhanden; Abschluss von Bedienprüfung, KI-Prüfung und App-Abgleich offen. Nicht veröffentlicht. |
| 6 · APP | Hintergrundfarbe und weitere App-Gestaltung | Vier Vorschauen bei der lokalen Mac-APP-Aufgabe vorgesehen, noch keine Farbauswahl. Nach Funktionsfehlern weiterführen. |
| fortlaufend | Gesamte Website-/App-Übersichten | `CINEGENIUS-WEBSITE-UEBERSICHT.md` und `CINEGENIUS-APP-UEBERSICHT.md` enthalten weitere Bereiche und offene Grenzen. Neue Aufträge dort und hier zuordnen; nichts als erledigt oder live markieren ohne Beleg. |

Bei akuter Sicherheits- oder Datenverlustgefahr wird diese vorgezogen. Neue
Gestaltungswünsche verdrängen keine laufende Fehlerkorrektur. Ein gesicherter,
geprüfter Entwurf ist keine Veröffentlichung. Explizite Betreiberprioritäten
und Veröffentlichungsfreigaben haben Vorrang.
