# Smart-Suche: Startseite und Arbeitsplatz

Aktueller Status vom 14. November 2026: **geprüfte Smart-Korrektur einschließlich Mitgliedersperre zur App-Integration übergeben**. WEB CODEX liefert `3604ba46de1a3486696121ff6786cca9fd5861e9` auf `origin/codex/genie-search-repair`; dieser Quellstand wurde in den App-Zweig übernommen. WEB hat genau diesen Stand nach Markus’ Freigabe „Ja, gemeinsam live stellen“ inzwischen veröffentlicht: `origin/main` ist `3604ba4`, Vercel `dpl_DspHipL1e9mfkhdLfnS5TV19NkPX` READY. Der geprüfte Veröffentlichungsbeleg steht unter `/srv/cinegenius/audits/20261114-genie-search-repair/production-receipt.json`. Der App-Quellabgleich ist in `e5db2b9e81361c3222e590c4493770e29fd96bd1` gesichert. Die zuvor übermittelten Noch-nicht-live-Hinweise beschreiben den Stand vor dieser WEB-Veröffentlichung. Diese Übernahme beauftragt keine App- oder Website-Veröffentlichung. Andere App-Arbeiten bleiben erhalten; reale native Sprach- und persönliche Modellprüfungen sind davon getrennt.

Der vorherige App-Abgleich des veröffentlichten `ce37ab6` ist in `8eac132ce6c4d6ffba6d58bdff1377cb27d9ca3f` gesichert. 215 gezielte Fälle, Build, Übersetzungs- und Designprüfung sowie Browserprüfungen in neun Sprachen und 16 simulierte native Sprachantworten bestanden; die 123 nativen Dateien blieben unverändert. Der Beleg unter `/srv/cinegenius/handoffs/20261114-app-unified-search/receipt.json` unterscheidet diese Prüfungen von noch offenen echten Geräteprüfungen und bestehenden Lint-Befunden.

## Geprüfte Smart-Korrektur von WEB CODEX

WEB meldet am 14. November 2026 Markus' Bestätigung des kurzen Namens **Smart** statt „Übergreifend“. Dieser Name gilt auch für den geplanten nativen Sucheinstieg. Die Homepage-Auswahl belegt wieder genau eine Reihe und bleibt bei schmalen Breiten oder langen Übersetzungen horizontal bedienbar. Mindestens 44px große Bedienflächen und Lesbarkeit in allen neun Sprachen erhalten. WEB hat die Korrektur auf `codex/genie-search-repair` mit Commit und Prüfbericht übergeben und anschließend ihren freigegebenen Livegang separat belegt.

Der übergebene Gesamtstand `3604ba4` enthält den Treffer-/Tab-Fix `87c3dee` und die zusätzliche Mitgliedersperre. Der aktuelle App-Prüfbeleg liegt unter `/srv/cinegenius/handoffs/20261114-app-smart-member/`; der WEB-Bericht unter `docs/test-reports/genie-unified-search-2026-11-14.md` unterscheidet Komponenten-/Browserprüfungen von echten Konto-/Modell- und Geräteprüfungen.

Die App-Abnahme bestätigt 241 gezielte Fälle: Nach dem ersten Lauf wurden ausschließlich fehlende Klickereignisse in der bestehenden Homepage-Testumgebung ergänzt; alle zwölf Fälle dieser Datei bestanden im Nachlauf. Build, TypeScript, Übersetzungen, gezieltes Lint und Design sind erfolgreich. Tatsächliche Gast-Browserprüfung in neun Sprachen, vollständige Anmelde-/Registrierungs-Rückkehrlinks mit sechs Suchteilen und vier Orten je Teil, 36 Reiter-/Breitenfälle, simulierte Mitglied-/Sitzungswechsel und 16 simulierte native Sprachantworten bestanden. Die 123 nativen Dateien und vorhandenen App-Schutzkorrekturen sind unverändert. Diese Belege ersetzen keinen echten Mitglieder-Login, Hörtest oder Xcode-/iPhone-Test.

Beim Abgleich und bei späteren Änderungen prüfen:

- „Model“ darf nicht zu „Modellbauer“ erweitert werden.
- „Kameramänner“ sowie entsprechende Berufsbezeichnungen und Sprachvarianten müssen zum richtigen Beruf führen.
- Spezielle Fahrzeuge dürfen nicht über eine grobe Oberkategorie mit unpassenden anderen Fahrzeugtypen vermischt werden. Fahrzeug-Untertyp, Marke und Modell müssen durchsuchbar sein.
- Firmenkategorien und angebotene Leistungen müssen bei der Firmensuche berücksichtigt werden.

Nach WEB-Angabe bleiben `POST /api/search/unified` und Plan-Version 1 kompatibel. Kontoregeln bleiben unverändert: 30 Aufrufe pro UTC-Tag für gewöhnliche Konten, die bestehende verifizierte Markus-Ausnahme, kein globales Tageslimit und unveränderte Minutenbegrenzungen. App-Navigation, Sprachwiederholung, Kontotrennung, aktuelle Inhaltsrechte und laufende native Arbeit bei der späteren Übernahme erhalten. Keine zweite native Matching-Logik und keine vorgezogene Übernahme unfertiger WEB-Dateien.

## Smart ausschließlich für angemeldete Mitglieder

Markus' zusätzliche Entscheidung vom 14. November 2026, über WEB CODEX übermittelt: **Smart darf nur von angemeldeten Mitgliedern genutzt werden**, auch beim Öffnen eines geteilten `/search?plan=…`-Links. Diese Regel ersetzt die bisherige anonyme Lesbarkeit von Smart-Ergebnisplänen. Sie ist keine kostenpflichtige Mitgliedschaft oder Bezahlschranke. Gewöhnliche öffentliche Verzeichnisse und die gewöhnliche öffentliche Suche bleiben separat zugänglich.

Der übernommene WEB-Stand setzt folgende gemeinsame Durchsetzung um: Proxy und API-Handler prüfen die Sitzung. `POST /api/search/unified` antwortet Gästen mit `401` und privaten No-store-Headern, bevor Body, Kontingent oder Datenbank bearbeitet werden. Der Client wartet auf die geklärte Sitzung, ruft als Gast weder Interpretation noch Ergebnisse ab und zeigt die Anmeldung. `/api/genie` war bereits angemeldeten Konten vorbehalten. Die App verwendet dieselbe Sitzung und Serverentscheidung; keinen nativen Gastzugang, zweiten Anmeldeablauf oder lokalen Berechtigungsersatz ergänzen.

Zusätzliche Abnahmekriterien für die fertige Übergabe:

- Angemeldete und abgemeldete Direktaufrufe einschließlich geteilter Plan-Links, ablaufender Sitzung und erneuter Anmeldung prüfen. Gast-Anfragen dürfen keine Interpretation, Kontingentbelastung oder Ergebnis-Datenbankabfrage auslösen.
- Das gleichursprüngliche Rückkehrziel erhält den vollständigen validierten Plan mit allen Suchteilen, Orten, Ländern, Kontinenten und Radien. Einen Plan nicht durch seine sichtbare Kurzbeschreibung ersetzen oder nach der Anmeldung erneut kostenpflichtig interpretieren. Auch den maximalen unterstützten Plan prüfen.
- Noch nicht geklärte Anmeldung, Fehler und Kontowechsel dürfen weder kurzzeitig vorherige Ergebnisse anzeigen noch verspätete Antworten oder Sprachausgaben eines vorherigen Kontos übernehmen. Abbruch und ungesendete Eingaben weiter korrekt behandeln.
- Gewöhnliche öffentliche Suche und Verzeichnisse bleiben auch als Gast nutzbar. Anmeldung, Rückkehr, Sprachwechsel und Bedienung in allen neun Sprachen prüfen; echte Browser-Zurück-Navigation erhalten.

Der ältere App-Anwendungsstand `8eac132` enthielt diese Mitgliedersperre noch nicht. Dessen Browserprüfungen mit anonymen, simulierten Smart-Ergebnissen bleiben historische Integrationsbelege. Die aktuelle Übernahme nutzt authentifizierte Testgrenzen für Mitgliederfälle und gesonderte Gast-, Sitzungswechsel- und Anmelde-Rückkehrprüfungen. Authentifizierung und Antwortdaten in Komponentenprüfungen sind simuliert; ein echter Login oder iPhone-Test wird daraus nicht abgeleitet.

## Neuer Startseiteneinstieg mit Locations

WEB hat am 14. November 2026 den geprüften Commit `60f17e76e7f67385c9ec1df13e14433551ad3373` übergeben; er ist im App-Commit `51be5fea0bb3312a39c7a80a790bf84d566a9d77` integriert. Der Abgleich ergänzt ausschließlich den Einstieg und seine Texte; Plan v1, serverseitige Mitgliedersperre, Kontingente und native Quellen bleiben erhalten. Nach Markus’ „Ja, live stellen“ hat WEB genau diesen Stand inzwischen veröffentlicht: `origin/main` ist `60f17e7`, Vercel `dpl_Cpc888oapKCCghiwqV5i839WB52e` READY. Der geprüfte Beleg `/srv/cinegenius/audits/20261114-home-search-member-hint/production-receipt.json` ersetzt die ursprüngliche Noch-nicht-live-Angabe. Kein zusätzlicher Livegang oder Gerätebuild durch den App-Abgleich.

- Beim Betreten der Startseite ist Locations ausgewählt. Smart bleibt ein gewöhnlicher Reiter ohne vorher sichtbares Mitgliederlabel, Schloss oder Hover-/Fokushinweis.
- Erst Klick oder Tastaturaktivierung durch Gäste zeigt am Reiter die kleine Sprechblase „Nur für Mitglieder“. Bei noch ungeklärter Anmeldung steht dort stattdessen der vorhandene Ladehinweis. Keine Navigation zur Suche oder Anmeldung und kein Positionssprung; die vorherige öffentliche Auswahl sowie Suchtext und Stadt bleiben erhalten.
- Erneuter Klick, Klick außerhalb, Fokuswechsel oder Escape schließen den Hinweis. Mitglieder können Smart normal auswählen; beim Absenden nach Sitzungsablauf bleibt die Eingabe erhalten und der Zugriff gesperrt.
- Der neutrale Platzhalter lautet „Was suchst du?“ in allen neun bestehenden Katalogen. Der native Arbeitsplatz verwendet später denselben gemeinsamen Einstieg und keine abweichenden Gastrechte.

Der aktuelle App-Prüfbeleg liegt unter `/srv/cinegenius/handoffs/20261114-app-home-member-hint/`. 13 gezielte Suchziel-/Feldprüfungen, 36 Sprach-/Breitenfälle, ein simulierter Anmelde-/Sitzungswechsel, zusätzliche Enter-/Leertaste-/Fokus-/Escape-Prüfungen bei 320 und 1440 CSS px sowie die tatsächliche gebaute Next-Anwendung als Gast bei vier Breiten sind erfolgreich. Build, TypeScript, i18n mit 8.073 Schlüsseln in neun Katalogen, Lint und Design bestanden. Die 123 nativen Dateien und zehn geprüften App-/Berechtigungsdateien sind unverändert. Browserprüfungen und simulierte Sitzungswechsel sind weiterhin kein Nachweis einer neuen Xcode-/iPhone-Installation oder echter Sprachausgabe.

WEB kündigt anschließend eine separate, von Markus beauftragte Korrektur von Genies Kosteninformation an. Sie ist noch in Arbeit und nicht Bestandteil von `60f17e7`. Erst den geprüften Commit samt Texten, Tests und Veröffentlichungsstatus in die App übernehmen; aus dieser Ankündigung keine geänderten Preise, Kontingente oder bereits korrigierten Antworten ableiten.

## Bestätigter Bedienablauf

- Haupteinstieg auf der **Startseite**, über die bestehende Suche und Genie.
- Smart setzt eine gültige Mitgliedersitzung voraus; ein Anmeldehinweis erhält die vollständige gewünschte Suche als Rückkehrziel, einschließlich geteilter Plan-Links.
- Die gemeinsame Suchlogik und das gemeinsame Ergebnisziel später zusätzlich als Werkzeug **Smart** im nativen Arbeitsplatz nutzen. Website und App erhalten kein zweites, abweichendes Suchsystem.
- Eingabe als freier Text sowie über Genie.
- Mehrere Suchteile gemeinsam verarbeiten: Crew, Marktplatz, Locations, Firmen und weitere tatsächlich unterstützte öffentliche Bereiche.
- Ergebnisse gemeinsam anzeigen und klar nach Bereich gruppieren; das bestehende CineGenius-Design verwenden.
- Stichwörter und Kurzformen wie „OB“, „Fahrer“ und „Kostüm“ berücksichtigen. Unklare Begriffe nicht stillschweigend auf eine erfundene Bedeutung festlegen.
- Jeder Suchteil behält seine eigenen Angaben, insbesondere seinen Ort. „Fahrer in München UND Fahrer in Berlin“ enthält zwei eigenständige Suchteile. Nicht allein nach Beruf zusammenfassen oder einen gemeinsamen Ort über alle Suchteile legen.
- Ein Suchteil kann mehrere Orte umfassen. „Beleuchter in Berlin und Hamburg“ bedeutet Beleuchter in **Berlin ODER Hamburg**; ein einzelner Treffer muss nicht beide Städte erfüllen.
- Vorangestellte Ortsangaben gehören zum jeweiligen Suchteil: „Model in Berlin und in Hamburg Beleuchter“ bedeutet ausschließlich Models in Berlin sowie Beleuchter in Hamburg. Nicht alle Berufe mit allen genannten Orten kombinieren.
- Bereichswechsel und unterschiedliche Gebietsgrößen bleiben möglich: „Model in Berlin und ein Auto in Afrika“ bedeutet Crew/Models in Berlin plus Marktplatz/Fahrzeuge in Afrika. Kontinent-, Länder- und Stadtfilter sind Teil des übergebenen gemeinsamen Suchvertrags; bestehende Sichtbarkeitsrechte gelten vor geografischem Abgleich. Das ist keine Zusage vorhandener Treffer oder eines bereits erfolgten Livegangs.
- Innerhalb der nach Bereichen gruppierten Ergebnisse bleiben Suchteil und zugehörige Orte erkennbar, auch wenn mehrere Suchteile zum selben Bereich gehören. Ein gemeinsamer nachgestellter Ort kann mehreren passenden Suchteilen zugeordnet werden; unklare Zuordnungen verständlich klären.

## Spätere kostenpflichtige Nutzung

Markus möchte die Funktion später zu einem kostenpflichtigen Angebot beziehungsweise einer bezahlten Anwendung ausbauen können. Kostenpflichtiger Umfang, kostenlose Funktionen, Preise, Abrechnung, Zahlungsweg und Einführung sind noch offen. Die jetzige Umsetzungsfreigabe gilt für die Suche und beauftragt weder Zahlungen noch eine aktuelle Bezahlschranke.

Beim späteren Bau gemeinsame Suchlogik, Darstellung und Tarifzugriff trennen. Tarifrechte und etwaige Nutzungsgrenzen serverseitig, kontobezogen und einheitlich für Website und App prüfen. Nutzungszählung darf keine dauerhafte Speicherung von Suchtexten oder Genie-Gesprächen voraussetzen. Privatsphäre und Inhaltsberechtigungen bleiben unabhängig vom Tarif wirksam. Zahlungsanbieter und native Kaufabwicklung erst anhand des tatsächlich beschlossenen Bezahlmodells abstimmen.

## App-Integration und Übergabe

WEB CODEX verantwortet die gemeinsame Suchlogik und die bestehende `/search`-Ergebnisseite. APP Entwicklung integriert den geprüften Web-Stand unter Erhalt der App-Erweiterungen. Der native Arbeitsplatz-Einstieg benötigt weiterhin den Abgleich mit den neueren Mac-Quellen; Quellcodeübernahme nicht als fertigen Xcode-/iPhone-Stand melden.

Der Vertrag steht in `lib/unified-search.ts` und `docs/genie-beta.md`: Version 1, ein bis sechs Suchteile und bis zu vier ODER-Orte pro Teil. `/search?smart=1&q=…` interpretiert eine ausdrücklich gesendete Eingabe; `/search?plan=…` öffnet den streng geprüften Plan direkt. `POST /api/search/unified` liefert lesende, nach Bereich und Suchteil gruppierte Ergebnisse samt expliziter Fortsetzung. Genie behält `{reply,language,links}` und liefert einen validierten Link für alle Suchteile. Keine zusätzlichen nativen Provider-Schlüssel oder parallelen Parser. App-Annahmefälle sind die oben festgehaltenen getrennten Suchteile und Ortsmengen, identische erneute Suchaufträge, reale Zurück-Navigation, unterbrochene Eingaben sowie die gemeinsame Genie-Navigation und Sprachausgabe.

Der native Einstieg nutzt die gemeinsame Suche im bestehenden erlaubten CineGenius-Ursprung und die vorhandene Sitzung. Kein zweiter Suchparser, keine separate Anmeldung und keine Kopie von Sitzungstokens oder Suchtexten in native Archive. Die Suche benötigt keine Scanner-/Location-Auswahl oder Kameraberechtigung. Beim Wechsel zur Suche bleiben offene Arbeitsplatz-Entwürfe und die bestehende Abbruch-/Speicherbehandlung erhalten. Neue WebView-Handler oder Rücksprungformate erst auf Grundlage der geprüften Schnittstelle festlegen.

Die Präzisierungen zu Startseite, kostenpflichtiger Nutzung und Ortszuordnung wurden ebenfalls am 14. November 2026 über WEB CODEX übermittelt. Die korrespondierende Web-Planung steht in dessen `docs/app-product-flows.md`; ältere dortige Aufschubformulierungen sind durch die neuere ausdrückliche Umsetzungsfreigabe ersetzt. Planung und Freigabe sind kein Nachweis von veröffentlichtem Anwendungscode.

Beim späteren Abgleich bleiben laufende native Änderungen, Grundrisse, Fotos, PDF- und Drehplan-/Dispo-Arbeit erhalten. Den tatsächlichen Mac-Stand vor Änderungen prüfen; die Serverfassung der nativen Oberfläche darf neuere Mac-Arbeit nicht überschreiben. Die bestehende kontogebundene Sichtbarkeit und Bildberechtigung gelten auch für gemeinsame Ergebnisse. Neue Bedienoberflächen und Texte gehören dann gleichzeitig in alle neun bestehenden Sprachen.

Diese Notiz aktiviert keinen nativen Werkzeug-Einstieg und enthält keine Veröffentlichungsfreigabe. Ein realer iPhone-/Xcode-Test steht zusätzlich zur Server-/Browserprüfung aus. Der aktuelle Mac-Auftrag bearbeitet native Dokumentvorlagen und Symbole; sein neuerer Quellstand muss vor der nativen Integration abgeglichen werden.
