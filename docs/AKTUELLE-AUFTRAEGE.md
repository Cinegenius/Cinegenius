# Aktuelle Aufträge · 20. November 2026

Reihenfolge nach Dringlichkeit und Abhängigkeiten, nicht allein nach Eingang.
Diese Liste ist eine Arbeitsübersicht, kein gestarteter Hintergrundagent.

**Website-Veröffentlichung:** Karten, Länderpriorisierung und Crew-Rotation sind veröffentlicht und nachgeprüft. Auch die zentrale **CineGenius Redaktion** ist jetzt live: 17 bisherige Beiträge und 25 alte Links erhalten; ein echter neuer Artikel über den geprüften Redaktionsdienst veröffentlicht. Der bestehende stündliche Rechercheablauf hat die separate Veröffentlichung aktiviert. Die native Smart/Work-Veröffentlichung bleibt zurückgehalten. Belege: `/srv/cinegenius/handoffs/20261120-country-first-release/receipt.json` und `/srv/cinegenius/handoffs/20261120-newsroom-release/receipt.json`.

| Reihenfolge | Aufgabe | Stand / Abhängigkeit |
| --- | --- | --- |
| 1 · WEB | Widersprüchliche Crew-/Kartenanzahl | Website veröffentlicht: oben und unten derselbe berechtigte gefilterte Ergebnissatz. Live-Summen aus Kartenpunkten, außerhalb liegenden und nicht verorteten Einträgen stimmen. App-Release-Halt erhalten. |
| 1 · WEB anschließend | Überdimensionierte Smart-Kartenvorschau | Kompakte Smart-Vorschau veröffentlicht. Zusätzlicher Live-Befund: Fokussieren eines Randpins schließt die Verzeichnisvorschau; Korrektur hält sichtbare Einträge offen, 43 Kartentests bestanden. Veröffentlichung/Browser-Abschluss im Release-Beleg. |
| 1 · APP separat | Hänger in Smart/Work und Wechsel Work → Community | APP diagnostiziert; Release bleibt angehalten. Unfertige native Änderungen nicht durch WEB veröffentlichen; das geprüfte Websitepaket ist separat freigegeben. |
| 2 | Homepage „Die Crew“: neue Mitglieder einen Tag priorisieren, danach mischen | Website veröffentlicht; 24 Stunden Vorrang und danach wechselnde Auswahl. 48 Tests, ursprünglicher Entwurf `f6b45be5`. Kein neues Design. |
| 3 | Mexiko und weitere Länder | Regionale Vorauswahl für Gäste, Reisende, Startseite und Verzeichnisse veröffentlicht: 162 Tests und 32 Browserfälle, 17 Sprachen, Designprüfung und vollständiger Build bestanden. Gastzugriff live zusätzlich geprüft. Vertrag in `country-first-discovery.md`, APP-Übernahme/Gerätetest offen. Mehrwährungen jetzt implementiert: 155 Währungen, Formulare, Preisfilter und Buchungs-Snapshots. Abschlussprüfung/Veröffentlichung getrennt; siehe `international-currency-feedback.md`. |
| 4 · WEB / Redaktion | News-Zusammenführung und Technik-/Mexiko-News | Veröffentlicht und live geprüft: acht eigene Redaktionen zusammengeführt, 17 Bestandsartikel/25 alte Links erhalten, drei Mexiko-Artikel weiterhin auffindbar, ein neuer Artikel regulär veröffentlicht. 39 Produkt- und 11 Worker-Prüfungen; vier Live-Browserkonfigurationen bestanden. Stündlicher Dienst aktiviert; automatische Bilder, Ablauf-Ausblendung und Nutzungslernfeed bleiben offen. |
| 5 | Mitgestalten / Ländervertreter-Feedback | Implementiert: private Gespräche, Länder-/Sprachlinks und Admin-Sammlung. Isolierte WebKit-Bedienprüfung bei 320/390/768/1366 px bestanden. Echter KI-Test und native Übernahme offen; direkte APP-Chat-Verbindung derzeit nicht erreichbar. Noch nicht veröffentlicht. |
| 6 · APP | Hintergrundfarbe und weitere App-Gestaltung | Vier Vorschauen bei APP vorgesehen, noch keine Farbauswahl. Nach Funktionsfehlern weiterführen. |
| fortlaufend | Gesamte Website-/App-Übersichten | `CINEGENIUS-WEBSITE-UEBERSICHT.md` und `CINEGENIUS-APP-UEBERSICHT.md` enthalten weitere Bereiche und offene Grenzen. Neue Aufträge dort und hier zuordnen; nichts als erledigt oder live markieren ohne Beleg. |

Bei akuter Sicherheits- oder Datenverlustgefahr wird diese vorgezogen. Neue
Gestaltungswünsche verdrängen keine laufende Fehlerkorrektur. Ein gesicherter,
geprüfter Entwurf ist keine Veröffentlichung. Explizite Betreiberprioritäten
und Veröffentlichungsfreigaben haben Vorrang.
