# Aktuelle Aufträge · 20. November 2026

Reihenfolge nach Dringlichkeit und Abhängigkeiten, nicht allein nach Eingang.
Diese Liste ist eine Arbeitsübersicht, kein gestarteter Hintergrundagent.

| Reihenfolge | Aufgabe | Stand / Abhängigkeit |
| --- | --- | --- |
| 1 · WEB | Widersprüchliche Crew-/Kartenanzahl | Aktiver Fehler. Alte Anbieterfilter-Ausnahme gefunden: oben alle Personen, unten gefilterte Personen. WEB-Korrektur fertig geprüft: 10 Browserfälle und 10 gezielte Tests, Typen/Sprachen/Design bestanden. APP-Port `a40a2bc6` separat: 29 Tests, zehn native Browserfälle, Typen, 17 Kataloge und Design bestanden; endgültiger Beleg unter `/srv/cinegenius/handoffs/20261120-app-crew-filter-count/receipt.json`. Noch nicht veröffentlicht; App-Release-Halt erhalten. |
| 1 · APP separat | Hänger in Smart/Work und Wechsel Work → Community | Lokale Mac-APP-Aufgabe diagnostiziert laut Abstimmung; Release bleibt angehalten. Diese Server-Folgearbeit prüft die gemeinsamen Zähler. Keine parallele Veröffentlichung durch WEB. |
| 2 | Homepage „Die Crew“: neue Mitglieder einen Tag priorisieren, danach mischen | Fertig geprüft (48 Tests), gesichert in `f6b45be5`, Zweig `codex/home-crew-rotation-20261120`. Noch nicht live. In APP separat als `0c5e63fd` gesichert (61 Tests, vollständiger Build). Kein neues Design. |
| 3 | Mexiko und weitere Länder | Übersetzungsänderungen vorhanden; durchgängige Länderpriorisierung ist offen. Mehrwährungen separat als unvollständiger Entwurf. Zuerst gemeinsamer Länder-/Preisvertrag, dann Web-/App-Abnahme. |
| 4 · WEB / Redaktion | News-Zusammenführung und Technik-/Mexiko-News | Bestehende Themen-/Länderansicht vorhanden. AG DOK hat acht eigene Redaktionsprofile und 17 öffentliche Beiträge inventarisiert; vollständige Rechte-/Bestandsprüfung und sichere Zusammenführung fehlen. Redaktion bleibt eigener abgestimmter Arbeitsstrang. |
| 5 | Mitgestalten / Ländervertreter-Feedback | Entwurf mit Prüfungen vorhanden; Abschluss von Bedienprüfung, KI-Prüfung und App-Abgleich offen. Nicht veröffentlicht. |
| 6 · APP | Hintergrundfarbe und weitere App-Gestaltung | Vier Vorschauen bei der lokalen Mac-APP-Aufgabe vorgesehen, noch keine Farbauswahl. Nach Funktionsfehlern weiterführen. |
| fortlaufend | Gesamte Website-/App-Übersichten | `CINEGENIUS-WEBSITE-UEBERSICHT.md` und `CINEGENIUS-APP-UEBERSICHT.md` enthalten weitere Bereiche und offene Grenzen. Neue Aufträge dort und hier zuordnen; nichts als erledigt oder live markieren ohne Beleg. |

Bei akuter Sicherheits- oder Datenverlustgefahr wird diese vorgezogen. Neue
Gestaltungswünsche verdrängen keine laufende Fehlerkorrektur. Ein gesicherter,
geprüfter Entwurf ist keine Veröffentlichung. Explizite Betreiberprioritäten
und Veröffentlichungsfreigaben haben Vorrang.
