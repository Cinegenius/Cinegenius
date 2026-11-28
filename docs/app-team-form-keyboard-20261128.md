# Teamformular und Tastatur · 28. November 2026

Markus meldet nach dem lokalen Update1.0(8)→1.0(9) die abgeschnittene Namenseingabe. Im Screenshot verbleiben nach festem Kopf/Fuß nur ungefähr56CSS-Pixel für den Inhalt. Die Eingabe liegt deshalb teilweise hinter dem Fuß. Eine doppelte Safe-Area-Subtraktion ist nicht unabhängig belegt und wird nicht pauschal geändert.

## Enger Quellumfang

`MessagingDialog` verwendet bei `surface=default`, sichtbarer Höhe unter420px und ohne natives Kopfwerkzeug einen einzigen Dialog-Scroller. Bei größeren Höhen bleiben bisherige Aufteilung und kompakte natürliche Höhe erhalten. Das aktuell fokussierte Feld wird bei einer Höhenänderung über eigene Dialogrechtecke/scrollTop sichtbar gehalten; kein `focus()`, kein Remount und kein Scrollen äußerer Vorfahren. Such-/Browsefenster behalten ihren bestehenden Swipe-/Layoutvertrag. Busy/Escape, echtes Zurück, Fokus-Rückkehr und Body-Lock bleiben erhalten.

`CreateTeamDialog` zeigt den Namen in einer eigenen vollen Zeile mit kleinem Symbol. Namens- und Kontaktsuchfeld erhalten im gemeinsamen App-Material eine erkennbare Kontur, getönte Eingabefläche und Fokusmarkierung; Pure und Forced-Colors sind berücksichtigt. Die bestehende Schriftgröße16px und mindestens44px Bedienhöhe bleiben erhalten. Keine neuen UI-Texte oder Katalogänderungen.

Keine Änderung an Team-/Einladungsoperationen, Rechten, privater Entwurfswiederherstellung oder Dateispeichern. Kein nativer Neubuild, Team-Cloudflag oder endgültiger Löschumbau aus diesem Umfang.

## Prüfcheckpoint

Auf dem abschließenden unveränderten Fünf-Dateien-Quellstand:18 gezielte Dialog-/Erstellungsfälle, gezieltes ESLint und vollständiges TypeScript bestanden.22 Designprüfungen und17 Sprachkataloge mit11792Schlüsseln bestanden. Der erste zusätzliche Teststart ohne den bestehenden Alias-Loader scheiterte am Modulimport; mit dem regulären Testloader sind die18Fälle bestanden. Der neue Fokusfall prüft240→700px ohne Feld-/Dialogremount und verhindert ein Scrollen äußerer Vorfahren. Unabhängige Quellprüfung hat zwei konkrete Hinweise (Forced-Colors-Spezifität und äußeres Scrollen) ergeben, beide sind eng korrigiert; keine weitere konkrete Beanstandung im Fünf-Dateien-Delta.

Die tatsächliche Safari-Vorschau ist im engen Umfang bestanden: alter220px-Fall mit Feldabschneidung nachgestellt; neuer Dialog zeigt das vollständige Feld mit sichtbarer Kontur/Fokus. Deutsche Kontaktauswahl→Name, Eingabe,220→852→180px bei erhaltenem Text/Kontakt, Erreichen der Fußknöpfe durch Scrollen bei180px, Pure-Lesbarkeit und echte Safari-Responsive-Breite320px geprüft.17 tatsächliche React-Sprachansichten bei320×240px:17/17 bestanden, Eingaben265×48px voll sichtbar, kein Querüberlauf, Fuß per Scrollausdehnung erreichbar,0 sichtbare Fehler/Fake-Schreiboperationen. Die Matrix ist eine DOM-Geometrieprüfung; nur die deutschen Abläufe wurden manuell bedient. Die simulierte sichtbare Tastaturhöhe ersetzt keine physische iPhone-Tastaturabnahme.

Browserwerkzeug/IAB ist in diesem Chat nicht verfügbar, deshalb tatsächliches Safari über CUA. Der erste lokale Vite-Start hing an synchronen Modulreads; isolierte Harnessfehler (Tailwind-Auflösung und CJS-Prebundling) wurden korrigiert. Die ersten Matrixmessungen vor fertigem CSS bleiben als früher Zwischenstand erhalten; nach bewusster sichtbarer Aktualisierung17/17 auf endgültigen265×48px. Kein Produktfehler daraus abgeleitet. Nachweise im Mac-Auftrag: `work/team-create-keyboard-20261128/{checks/final-checks.safe.json,browser-cua.safe.json,audit/module-http.safe.json}`.

**Noch nicht veröffentlicht oder auf dem iPhone aktiv.** Keine neue native Installation erforderlich aus dem Quellumfang; die reguläre Web-Veröffentlichung und anschließende physische Tastaturgegenprobe stehen separat aus.

Lokale native Installation separat abgeschlossen:1.0(9),190 Dateien/sieben Ordner frisch gesichert;173 Dokument-/Supportdateien vor Erststart bytegleich,12/12 Grundrissarchive erhalten. Smart-Startbildschirm physisch sichtbar. Dies ist keine Tastatur-/Teamformularabnahme. Neuere endgültige Löschfassung bleibt separat nicht installiert, gemeinsame Team-Cloud nicht aktiviert.

## Freigegebener Team-Release und neuer Produktionsabgleich

Markus hat am28.11.2026 nach dem Prüfabschluss ausdrücklich „stell. live“ freigegeben. Beim GitHub-Desktop-Abgleich wurde origin/main d5fcb21c über dem zuvor veröffentlichten b3e6 erreicht. Dieser Zweierdelta betrifft ausschließlich Dispo-Recovery und deren Test. Der unabhängige Serverchat meldet dafür eine synthetisch belegte Nebenwirkung: ein falscher Drehtag entfernt auch ein korrekt belegtes Datum/Literal. Der Analysebefund bleibt im getrennten Auftrag offen.

Zunächst wurde für einen engen Teamrelease erwogen, diese zwei Dateien auf den früheren Produktionsinhalt zu setzen. Noch VOR jedem Commit/Push/Deploy traf der neue tatsächliche Veröffentlichungsbefund ein. Root hat die echte Nutzernachricht „stell live auf die app“ im Dispoanalyse-Chat gelesen und beide .co-Aliase unabhängig auf dpl_4UrTWCtaqUXLTStKu3gadoEqv2vr/READY/production bestätigt. Deshalb wurde die nur lokale Rückstellung vollständig verworfen. Beide Analyse-Dateien sind wieder bytegleich d5 und werden durch diesen Teamrelease weder umgebaut noch zurückgesetzt. d5-Historie sowie die zeitgebundenen Abgleichbelege bleiben erhalten.

Gegenüber dem jetzt tatsächlich laufenden d5 besteht damit ausschließlich der freigegebene Team-/Feld-/Tastaturdelta. Regulärer geschützter Release und Liveprüfung folgen; noch keine Team-READY-/physische Tastaturabnahme behauptet. Mac-Belege: `release-20261128/{release-boundary.safe.json,upstream-live-report-local-hold-withdrawn.safe.json,preflight-current-production.safe.json}` im getrennten Aufgabenordner.
