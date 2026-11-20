# Aktuelle Aufträge · 20. November 2026

Reihenfolge nach Dringlichkeit und Abhängigkeiten, nicht allein nach Eingang.
Diese Liste ist eine Arbeitsübersicht, kein gestarteter Hintergrundagent.

**Website-Veröffentlichung:** Der freigegebene Produktstand `f490b47c` ist mit der Gastzugriffskorrektur `4d93523a` auf cinegenius.co veröffentlicht. Die Live-Prüfung bestätigt regionale Gastpräferenz und übereinstimmende Gesamtsummen. Ein dabei gefundener Randfall beim Antippen eines Kartenpins wird im selben Auftrag korrigiert. Der separate native App-Halt bleibt bestehen. Verbindlicher Abschlussbeleg: `/srv/cinegenius/handoffs/20261120-country-first-release/receipt.json`.

| Reihenfolge | Aufgabe | Stand / Abhängigkeit |
| --- | --- | --- |
| 1 · WEB | Widersprüchliche Crew-/Kartenanzahl | Website veröffentlicht: oben und unten derselbe berechtigte gefilterte Ergebnissatz. Live-Summen aus Kartenpunkten, außerhalb liegenden und nicht verorteten Einträgen stimmen. App-Release-Halt erhalten. |
| 1 · WEB anschließend | Überdimensionierte Smart-Kartenvorschau | Kompakte Smart-Vorschau veröffentlicht. Zusätzlicher Live-Befund: Fokussieren eines Randpins schließt die Verzeichnisvorschau; Korrektur hält sichtbare Einträge offen, 43 Kartentests bestanden. Veröffentlichung/Browser-Abschluss im Release-Beleg. |
| 1 · APP separat | Hänger in Smart/Work und Wechsel Work → Community | APP diagnostiziert; Release bleibt angehalten. Unfertige native Änderungen nicht durch WEB veröffentlichen; das geprüfte Websitepaket ist separat freigegeben. |
| 2 | Homepage „Die Crew“: neue Mitglieder einen Tag priorisieren, danach mischen | Website veröffentlicht; 24 Stunden Vorrang und danach wechselnde Auswahl. 48 Tests, ursprünglicher Entwurf `f6b45be5`. Kein neues Design. |
| 3 | Mexiko und weitere Länder | Regionale Vorauswahl für Gäste, Reisende, Startseite und Verzeichnisse veröffentlicht: 162 Tests und 32 Browserfälle, 17 Sprachen, Designprüfung und vollständiger Build bestanden. Gastzugriff live zusätzlich geprüft. Vertrag in `country-first-discovery.md`, APP-Übernahme/Gerätetest offen. Mehrwährungen bleiben separater unvollständiger Entwurf. |
| 4 · WEB / Redaktion | News-Zusammenführung und Technik-/Mexiko-News | Nächster separater Arbeitsstrang nach Karten-Abschluss. Themen-/Länderansicht vorhanden; neuer Veröffentlichungsdienst als Entwurf mit 40 bestandenen Tests. Acht eigene Redaktionsprofile und 17 öffentliche Beiträge inventarisiert. Vollständiger privater Bestand, sichere Zusammenführung, Aktivierung und echter Artikeltest offen; automatische Veröffentlichung nicht aktiv. |
| 5 | Mitgestalten / Ländervertreter-Feedback | Entwurf mit Prüfungen vorhanden; Abschluss von Bedienprüfung, KI-Prüfung und App-Abgleich offen. Nicht veröffentlicht. |
| 6 · APP | Hintergrundfarbe und weitere App-Gestaltung | Vier Vorschauen bei APP vorgesehen, noch keine Farbauswahl. Nach Funktionsfehlern weiterführen. |
| fortlaufend | Gesamte Website-/App-Übersichten | `CINEGENIUS-WEBSITE-UEBERSICHT.md` und `CINEGENIUS-APP-UEBERSICHT.md` enthalten weitere Bereiche und offene Grenzen. Neue Aufträge dort und hier zuordnen; nichts als erledigt oder live markieren ohne Beleg. |

Bei akuter Sicherheits- oder Datenverlustgefahr wird diese vorgezogen. Neue
Gestaltungswünsche verdrängen keine laufende Fehlerkorrektur. Ein gesicherter,
geprüfter Entwurf ist keine Veröffentlichung. Explizite Betreiberprioritäten
und Veröffentlichungsfreigaben haben Vorrang.
