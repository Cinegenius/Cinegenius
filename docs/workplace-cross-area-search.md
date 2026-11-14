# Übergreifende Suche: Startseite und Arbeitsplatz

Aktueller Status vom 14. November 2026: **gemeinsamer Suchstand zur App-Integration übergeben und von WEB veröffentlicht**. WEB CODEX hat den geprüften Commit `ce37ab6548fbeb3e021db52424da0977c682abab` geliefert; der Mergebaum entspricht dem geprüften `b094f29`. Nach der vorgezogenen Limits-Veröffentlichung `83a3dc1` ist nun auch `ce37ab6` auf beiden CineGenius-Domains live, Vercel `dpl_8z1GdsEiHEwXUvkt2etix1KqqWjH` READY. Diese Übergabe beauftragt keine App-Veröffentlichung. Andere bereits beauftragte App-Arbeiten bleiben erhalten; reale native Sprach- und persönliche Modellprüfungen sind davon getrennt.

## Bestätigter Bedienablauf

- Haupteinstieg auf der **Startseite**, über die bestehende Suche und Genie.
- Die gemeinsame Suchlogik und das gemeinsame Ergebnisziel später zusätzlich als Werkzeug **Übergreifende Suche** im nativen Arbeitsplatz nutzen. Website und App erhalten kein zweites, abweichendes Suchsystem.
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
