# Teamgruppen und Genie: gemeinsame Übernahme · 24. November 2026

## Eingefrorener Umfang und Veröffentlichungsstopp

Die gemeinsame Quelle verbindet ausschließlich die unabhängig geprüften
Teamgruppen `601abed86a02fdc03bfe495f141b1138d44c0556` und den Genie-Rundgang
`a152170b180480f041b173af9199a6f0f143ed70` auf dem GitHub-Hauptstand
`3a7660089890dbf0a24ac220832b28d35cd399c7`.

**Kein Deploy und kein Hauptstandswechsel durch diese Vorbereitung.** APP-Root
hat die Veröffentlichung ausdrücklich bis zur Bestätigung seines nativen
Guide-/Assetsabgleichs zurückgehalten. Der separate neue Kostenkandidat gehört
nicht zu dieser Übernahme. Gmail-/TestFlight-Aktivierung, Produktionsmigrationen,
Provideraufrufe und Geräteinstallationen sind nicht Teil dieses Schritts.

Team-/Guide-Runtime und Tests bleiben bytegleich zu den beiden geprüften Quellen.
Die17 Kataloge enthalten exakt beide Änderungen: `WorkTeams` aus601 und
`Genie.appGuide` ausa152. Zwei konkurrierende Einträge am Anfang der gemeinsamen
Übersichten wurden zusammengeführt; beide Texte und die bisherige Historie
bleiben erhalten. Die Mail-Quelle, Paketdateien, Authkontext, Boot-/Teamvertrag,
native Quellen und Deploykonfiguration wurden gegenüber3a nicht verändert.

## Exakter zusätzliche Umfang von3a gegenüber Live

Die frische lesende www-Prüfung bestätigt weiterhin
`dpl_94Eh94YmSfPn9B7BSs4jvRgaX5rA` als READY, den belegten Produktcommit
`2e5ce0702f0d3f94ed5e2a1bef215975a5ade833`. Zwischen diesem Livecommit und3a
liegen der reine Auth-Releasebeleg821 und die Mail-Quellarbeit3a: **28 Dateien**.

| Bereich | Dateien | Änderung |
| --- | ---: | --- |
| Mail-Runtime | 3 | `app/api/work/mail/route.ts`, `components/work/WorkMail.tsx`, `lib/work-mail-service.ts` |
| Mail-Prüfungen | 2 | Service- und API-Fälle für Auswahl/Analysevorbereitung |
| Sprachkataloge | 17 | Je13 neue `WorkMail`-Schlüssel und3 angepasste bestehende Texte |
| Pakete | 2 | `pdf-parse` und die gesperrte Abhängigkeitsauflösung,13 zusätzliche Lockfile-Pakete |
| Dokumentation | 4 | Beide Produktübersichten, Auth-Releasebeleg und Mail-Vertrag |

Die zwei neuen Mailaktionen heißen `import_current_dispo` und
`analysis_document`. Die erste wertet die neuesten höchstens10 Nachrichten
anhand von Betreff/Absender/Anhangshinweisen aus und importiert den bestbewerteten
Kandidaten ab dem bestehenden Schwellwert. Die zweite bereitet einen ausgewählten
PDF-Anhang oder vorhandenen Nachrichtentext als Dokument vor. Die UI kann nach
`connected=1` sowie nach einem ausdrücklichen Import die bestehende private
Dispoanalyse starten; bereits importierte Nachrichten erhalten einen Analyseknopf.
Es gibt keine neue Mail-Sende-/Löschfunktion, Hintergrundsynchronisierung oder
automatische Verteilung an Projekte/Teams.

Diese Beschreibung ist keine Beurteilung der richtigen Dispoauswahl in einem
echten Postfach: die Bewertung verwendet Metadaten und keine verifizierte
Aktualität. Die Aufbereitung verwendet Grenzwerte von250000 Zeichen und100 Seiten bei bestehender
Anhangsgrenze; die Analyse verwendet den bisherigen persönlichen Vertrag.
Die Mail-Oberfläche hat17 Sprachen, während die hier übergebene Analyselocale
weiter auf die bisherigen9 Werte begrenzt ist und sonst Deutsch verwendet.

## Deaktivierung ist keine globale Archivsperre

`WORK_MAIL_ENABLED` muss exakt`1` sein, bevor ein Postfach verbunden oder über
einen gespeicherten Providerzugang gelesen/importiert werden kann. Die
Zusammenführung ändert weder dieses Flag noch Zugangsdaten, Verschlüsselung,
OAuth-Konfiguration oder Datenbankschema. Kein Produktionswert wurde geschrieben.

Das private bestehende Archiv bleibt unabhängig davon zugänglich. Die neue
Dokumentvorbereitung und der Analyseknopf für eigene bereits archivierte Inhalte
sind **nicht** durch diesen Mailflag vollständig ausgeschaltet. Die vorhandene
persönliche serverseitige KI-Freigabe bleibt zusätzlich erforderlich. Der spätere
Release führt daher echte Analyse-Quelländerungen mit; er darf nicht pauschal als
„nur abgeschalteter Mailcode“ beschrieben werden.

Vier lokale Grenzfälle am tatsächlichen Service bestätigen: fehlender/`0`-Flag
sperrt den Providerimport vor Entschlüsselung oder Provideraufruf; eigener
Archivtext lässt sich ohne Provider vorbereiten, fremder Archivbesitzer wird
abgewiesen.0 Provider-/KI-Aufrufe, ausschließlich synthetische Daten. Das ist
keine neue Prüfung eines realen Postfachs oder produktiver Kontoinhalte.

## Gemeinsamer Prüfstand und native Grenze

185 gezielte Team-/Genie-/Recovery-/Auth-/Mailfälle bestanden.17 Kataloge mit11760
Schlüsseln,20 Designfälle und gezieltes ESLint bestanden. Vier zusätzliche
Chromiumfälle laden die tatsächlichen Team-/Genie-/Containerkomponenten gemeinsam:
kein Rundgang/zweiter Genie in der nativen Gruppen- oder Verknüpfungsansicht;
nach deren Verlassen erscheint der erste Rundgang im sichtbaren Community-Bereich.
Synthetische Clerk-/API-/Draft-/Chatadapter, keine Browserfehler oder unerwarteten
Netzwerkanfragen. Die jeweils früheren33 und64/14 Browserfälle sind getrennte
Paketbelege und werden nicht als neuer gemeinsamer Durchlauf gezählt.

Die vollständige gemeinsame TypeScript-Prüfung ist bestanden. Der normale
Next-Produktionsbuild und echte Live-/Geräteprüfungen bleiben separat.
Belege: `/srv/cinegenius/handoffs/20261124-app-team-guide-integration`.

Native Erstbenutzung und Doppelintro muss APP-Root gesondert prüfen. Der bestehende
Webvertrag ist ausschließlich `localStorage.cg_app_guide_v1 = "done"` nach bewusstem
Abschluss/Überspringen, ohne Identität oder Rechte. Kein neues SyncEvent. Ein
bereits geöffnetes Webintro wird durch ein nachträglich gesetztes Flag nicht
automatisch geschlossen. Direkter erster Work-Start und manuelles eingebettetes
Erstöffnen sind durch diesen Servernachweis nicht physisch abgenommen.
