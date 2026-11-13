# Projekte: Veröffentlichung und Prüfung

Entscheidung von Markus, 13. November 2026: Mitglieder veröffentlichen ihre eigenen Projekte ausdrücklich; nur CineGenius-Admins verifizieren Projektangaben. Eine Admin-Freigabe vor jeder Veröffentlichung ist nicht vorgesehen.

## Mitglieder

1. Die Übersicht zeigt veröffentlichte Projekte direkt. Kategorien, Suche, Format, Jahr, Regie, Sortierung und Liste/Kacheln verwenden dieselben Daten und die gemeinsamen Browse-Steuerelemente.
2. Vor einem neuen Eintrag wird nach einem bestehenden Projekt gesucht. Mitglieder können einem vorhandenen Projekt ihre eigene Mitwirkung hinzufügen und sie später korrigieren oder entfernen.
3. Neue Projekte und Änderungen eines Projekteigentümers werden zunächst privat gespeichert. Die Vorschau erlaubt Korrekturen; Bilder bleiben optional. Vorhandene Bildrechte müssen für die konkret veröffentlichten Bilder bestätigt werden.
4. Erst „Jetzt veröffentlichen“ schreibt die öffentliche Projektfassung. Projekt, eigene Mitwirkung, zusätzlich genannte Crew und Veröffentlichungsbeleg werden gemeinsam in einer Datenbanktransaktion gespeichert. Bei einem Fehler wird keine Teilveröffentlichung erzeugt. Ein wiederholter Aufruf liefert denselben veröffentlichten Eintrag.
5. Ein zwischenzeitlich geänderter Entwurf oder öffentliches Projekt wird nicht überschrieben. Der letzte gespeicherte Entwurf und noch offene Eingaben bleiben erhalten. Bei widersprüchlichen Änderungen müssen Mitglieder den aktuellen Stand vergleichen; ein veralteter Entwurf wird nicht automatisch über die neuere Fassung gelegt.

## Verifizierung und Mitwirkungen

- Verifizierung betrifft die aktuell geprüften Projektangaben. Sie bestätigt nicht automatisch die Identität, Tätigkeit oder Mitwirkung jeder gelisteten Person.
- Beide direkten Admin-Verifizierungseinstiege prüfen die Adminberechtigung auf dem Server, binden die Entscheidung an den gelesenen Änderungsstand und protokollieren sie.
- Eine veröffentlichte Inhaltsänderung entfernt eine frühere Verifizierung. Mitglieder können weder das Prüfkennzeichen setzen noch ein altes Prüfkennzeichen übernehmen.
- Abteilungen werden über den gemeinsamen Berufskatalog und eng begrenzte exakte Altbezeichnungen bestimmt. Freie Notizen und Figurennamen beeinflussen die Zuordnung nicht. Mehrdeutige Bezeichnungen wie „Best Boy“ oder „Playback Operator“ bleiben unter „Weitere Tätigkeiten“, bis ein eindeutiger Beruf angegeben wird.
- Gleiche Namen auf unterschiedlichen Projekten reichen nicht aus, unbeanspruchte Personenprofile automatisch zusammenzuführen. Bestehende Verknüpfungen und ursprüngliche Mitgliedstexte bleiben erhalten. Private verknüpfte Identitäten werden weiterhin vor jeder Ausgabe ausgeblendet.

## Veröffentlichung dieses Updates

Vor Veröffentlichung des abhängigen Anwendungscodes muss `supabase/migrations/20261113190610_atomic_project_publication.sql` angewendet und die Funktion einschließlich ihrer Zugriffsrechte verifiziert werden. Die Migration erstellt ausschließlich eine Funktion und deren Berechtigungen; sie veröffentlicht keine alten Entwürfe und verändert keine bestehenden Mitgliedsinhalte. Ohne die Funktion schlägt die Veröffentlichung geschlossen fehl, statt auf die frühere mehrteilige Schreibfolge zurückzufallen.

Die Veröffentlichung benötigt Markus' gesonderten Auftrag. Danach gelten der freigegebene Server-Git-Ablauf und `npm run deploy:production` aus einem sauberen `main` auf dem exakten Stand von `origin/main`.

## Referenzen und Prüfung

Die Ablaufanalyse orientiert sich an der Trennung von Einreichen, Prüfen und Beiträgen in den offiziellen [IMDb-Hinweisen zu neuen Titeln](https://help.imdb.com/article/contribution/titles/adding-a-new-title/GNXTSSVTJTFCRZGN), den [IMDb-Hinweisen zu Credit-Nachweisen](https://help.imdb.com/article/contribution/contribution-information/how-can-i-submit-additional-verification-for-a-credit-submission/GN93ME9NVXHVE36E) und den [Crew-United-FAQ](https://www.crew-united.com/de/croft/render/home/faq). Die konkrete Veröffentlichungsregel folgt Markus' Entscheidung, nicht den Regeln dieser anderen Dienste.

Prüfungen: Berufskatalog und unveränderte Mitgliedstexte, alle neun Sprachkataloge und tatsächliche lokalisierte Oberflächen, Besitz-/Adminrechte, veraltete Prüfstände, Rollback und Wiederholbarkeit mit lokalem PostgreSQL (PGlite), responsive Browseransichten und echtes Zurück-Navigieren. Fehler beim Laden/Speichern/Veröffentlichen sowie Sprachwechsel wurden mit dem tatsächlichen Vorschauformular und simulierten Antworten geprüft. Keine Testprojekte oder Mitwirkungen wurden in der Produktionsdatenbank angelegt. Browsergrößen simulieren Mobilgeräte; dies ist keine native iOS-/Android-Geräteprüfung.
