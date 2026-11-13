# Vereinheitlichte öffentliche Filter und Navigation – 13. November 2026

Die öffentlichen Suchbereiche verwenden dieselbe kompakte Suche, Sortierung, Filteranzeige und denselben Filterdialog auf Handy, Tablet und Desktop. Crew, Marktplatz (einschließlich der Fahrzeug- und Marketplace-Routen), Locations, Firmen, Jobs, Projekte, News und Filmtiere behalten ihre jeweiligen Fachfilter. Zusätzliche Crew-Merkmale sind eingeklappt, Rollen bleiben mehrfach auswählbar. Organisationen haben derzeit keine eigenen Filter, sondern eine paginierte Übersicht.

Auswahlwerte stammen ausschließlich aus den jeweils öffentlich sichtbaren Einträgen. Die Marktplatz- und News-Facetten werden vollständig und geordnet in Datenbankseiten geladen; sie hängen nicht von den ersten sichtbaren Ergebnissen ab. Fehler einer späteren Seite werden als Fehler behandelt. Länder, Regionen und Städte sind voneinander abhängig. Ein veralteter ausgewählter Wert bleibt erkennbar und entfernbar, erzeugt aber keine neue auswählbare Kategorie. Die globale Suche erhält öffentliche Trefferarten auch beim Wechsel zwischen Bereichen und zeigt bei Lesefehlern eine Wiederholung an. Neue Inserate können weiterhin alle vorgesehenen Länder und Kategorien verwenden. Die Profilort-Bevorzugung bleibt eine Priorisierung, kein Ausschluss anderer Länder.

Persönliche Ziele und Abmelden liegen vollständig im vorhandenen Profilfoto-Menü; das rechte öffentliche Menü wiederholt sie nicht. Die veröffentlichte App-Navigation (News unten, zusätzliche KI-Werkzeuge als deaktiviertes „Demnächst verfügbar“) ist integriert. Eine überholte CSS-Ausblendung des bestehenden Genie-Buttons unter 1024 px wurde entfernt. Seine bisherigen Cookie-, Sitzungs- und Chat-Regeln bleiben bestehen.

## Vergleichsgrundlage

Die offiziellen Beschreibungen der Suche bei [Airbnb](https://www.airbnb.com/help/article/479), [eBay](https://www.ebay.com/help/buying/search-tips/advanced-search?id=4049) und [IMDb](https://help.imdb.com/article/imdb/discover-watch/using-the-advanced-search-feature/GLUEUYWPQNPTEVPU) wurden als Vergleich für Basissuche, zusätzliche Filter und fachbezogene Auswahl herangezogen. Dies ist kein behaupteter angemeldeter Nutzungstest dieser Dienste. Es wurde kein fremdes Design oder Bildmaterial kopiert.

## Prüfung

- 258 gezielte automatisierte Prüfungen: vollständige Facetten über 1.000 Einträge hinaus, öffentliche Sichtbarkeit, Fehler, Geopriorität vor Pagination, Kategorien und Rollen, kombinierte Filter, Zurücksetzen, Karten/Listenkonsistenz, Suchfehler und Navigation.
- 72 Browserfälle: acht Verzeichnisse in allen neun Sprachen bei 320 CSS px, einschließlich geöffnetem Dialog und ohne horizontalen Seitenüberlauf.
- 32 zusätzliche Browserfälle am integrierten Stand: acht Verzeichnisse bei 375, 430, 768 und 1024 CSS px. Vorher zusätzlich 24 Fälle bei 320, 390 und 1366 CSS px.
- Browserinteraktionen: abhängige Ortsfilter, veraltete URL-Auswahl, mehrere Crew-Rollen, Fokus/Escape, tatsächliches Browser-Zurück ohne zusätzliche History-Einträge, Wiederholung nach simuliertem Suchfehler mit anschließenden echten öffentlichen Ergebnissen.
- Isolierter Browser mit simuliertem angemeldeten Konto: vollständige Profilmenü-Ziele, keine persönlichen Duplikate im öffentlichen Menü; Genie sichtbar, mindestens 44 px berührbar und oberhalb der unteren Navigation bei 320/390/768/1024/1366 px; Öffnen, Schließen und Fokusrückgabe.
- Die reduzierte Bildschirmhöhe simuliert eine Tastatur. Es wurden hier keine echten iPhone-/Android-Tastaturen oder nativen App-Gesten geprüft. Die App-Entwicklung hat die Übernahme des neuen Hauptstands und die Erhaltung der Änderungen bestätigt.
- Übersetzungsprüfung: neun Kataloge, 7.786 Schlüssel; gemeinsame Designprüfung bestanden. Der Lint-Vergleich vor Integration zeigte keine neu hinzugekommenen Regelverletzungen; bestehende Hinweise in Crew, News und globaler Suche bleiben außerhalb dieses Umbaus.

Es gibt keine Datenbankmigration und keine Änderung an Mitgliedsinhalten, Freigaben oder Medien. Browser- und Prüfarbelege sowie der abschließende Build-/Veröffentlichungsbeleg werden unter `/srv/cinegenius/handoffs/20261113-unified-filters` aufbewahrt. Die Veröffentlichung wurde von Markus im WEB-CODEX-Chat mit „stell auch live“ freigegeben.
