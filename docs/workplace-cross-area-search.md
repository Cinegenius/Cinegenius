# Arbeitsplatz: Übergreifende Suche — für später vorgemerkt

Status vom 14. November 2026: **aufgeschoben, keine Umsetzung und keine Veröffentlichung beauftragt**. WEB CODEX hat Markus' abschließende Entscheidung „lass das merken und dann später bauen“ an APP Entwicklung übermittelt. Die vorherige Vorbereitung dieser Funktion ist damit zurückgestellt. Andere bereits beauftragte App-Arbeiten bleiben davon unberührt.

## Vorgemerkter Bedienablauf

- Eigenes Werkzeug **Übergreifende Suche** im nativen Arbeitsplatz.
- Eingabe als freier Text sowie über Genie.
- Mehrere Suchteile gemeinsam verarbeiten: Crew, Marktplatz, Locations, Firmen und weitere tatsächlich unterstützte öffentliche Bereiche.
- Ergebnisse gemeinsam anzeigen und klar nach Bereich gruppieren; das bestehende CineGenius-Design verwenden.
- Stichwörter und Kurzformen wie „OB“, „Fahrer“ und „Kostüm“ berücksichtigen. Unklare Begriffe nicht stillschweigend auf eine erfundene Bedeutung festlegen.
- Jeder Suchteil behält seine eigenen Angaben, insbesondere seinen Ort. „Fahrer in München UND Fahrer in Berlin“ enthält zwei eigenständige Suchteile. Nicht allein nach Beruf zusammenfassen oder einen gemeinsamen Ort über alle Suchteile legen.

## Spätere Abstimmung

WEB CODEX verantwortet die gemeinsame Suchlogik und die bestehende `/search`-Ergebnisseite. APP Entwicklung übernimmt nach einem erneuten Umsetzungsauftrag den nativen Arbeitsplatz-Einstieg und die Abstimmung mit Xcode. Eine verbindliche neue Schnittstelle oder ein geprüfter Implementierungs-Commit liegt für diese Funktion noch nicht vor.

Beim späteren Abgleich bleiben laufende native Änderungen, Grundrisse, Fotos, PDF- und Drehplan-/Dispo-Arbeit erhalten. Den tatsächlichen Mac-Stand vor Änderungen prüfen; die Serverfassung der nativen Oberfläche darf neuere Mac-Arbeit nicht überschreiben. Die bestehende kontogebundene Sichtbarkeit und Bildberechtigung gelten auch für gemeinsame Ergebnisse. Neue Bedienoberflächen und Texte gehören dann gleichzeitig in alle neun bestehenden Sprachen.

Diese Notiz aktiviert kein Werkzeug, erweitert keinen Sprach-/WebView-Handler, verändert keine Suche und enthält keine Veröffentlichungsfreigabe. Konkrete Schnittstellen und Geräteprüfungen werden erst mit dem späteren Auftrag festgelegt.
