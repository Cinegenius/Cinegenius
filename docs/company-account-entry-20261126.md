# Firmenkonto: Profillink und Foto-Bearbeitung · 26. November 2026

Status: Nach ausdrücklicher Freigabe am 26. November 2026 veröffentlicht:
`65f160cdacded7b5e8cf2e85ef80a21538d68595`, Deployment
`dpl_5sBZjTTFJhD6Uvb9wCyoCSzJpnFZ` ist READY und sowohl
`www.cinegenius.co` als auch `cinegenius.co` sind diesem Stand zugeordnet. Die Meldung
betrifft eine 404-Seite bereits beim Öffnen der Foto-/Bearbeitungsansicht.
Die genaue Fehleradresse und der ursprüngliche Klickverlauf liegen nicht vor.

## Gesicherter Befund und Grenzen

Die gemeldete Firma ist gespeichert, veröffentlicht und dem vorhandenen Konto
als Eigentümer zugeordnet. Ein persönliches Crewprofil existiert nicht und ist
für die Firma auch nicht erforderlich. Die öffentliche Firmenadresse lädt live;
ein ausgeloggter Aufruf ihrer Bearbeitungsadresse führt korrekt zur Anmeldung.
Es wurden weder Konten übernommen noch Kundendaten verändert oder Nachrichten
verschickt. Die datensparsame Produktanalyse bietet keinen personenbezogenen
Klickverlauf, mit dem sich diese konkrete Meldung nachträglich zuordnen ließe.

Unabhängig davon sind drei Fehler in den tatsächlichen Komponenten nachgewiesen:

- Das Kontomenü baut „Profil ansehen“ aus der eigenen Benutzer-ID. Ohne
  persönliches Profil landete dieser Link auf der 404-Seite.
- Zwei Foto-/Bearbeitungslinks in der Firmenübersicht vergaßen die ausgewählte
  Firmen-ID. Bei mehreren Firmen oder delegiertem Bearbeitungsrecht konnte so
  eine andere Firma oder die Neuanlage geöffnet werden.
- Mitglieder mit ausschließlich Leserecht sahen ebenfalls Bearbeitungslinks,
  obwohl die API das Bearbeiten korrekt verbietet.

## Korrektur

Nur wenn die frisch angemeldete Benutzer-ID genau dem angeforderten eigenen
Profillink entspricht und kein persönliches Profil vorliegt, führt der Link
jetzt nach „Mein Bereich“. Dort bleibt „Firma verwalten“ erreichbar. Es wird
kein Crewprofil erzeugt oder verlangt. Fremde/unbekannte Profile bleiben 404;
bestehende Profile durchlaufen unverändert ihre Datenschutzprüfung.

Alle Bearbeitungslinks der Firmenübersicht behalten die ausgewählte Firmen-ID.
Nur Eigentümer, Admins und Editoren bekommen diese Aktionen angeboten. Die
bestehende serverseitige Berechtigungsprüfung bleibt maßgeblich und unverändert.
Upload, Speicherung, Veröffentlichung, Originalbilder und Medienrechte ändern
sich nicht. Keine neuen Texte, Sprachschlüssel, API-Verträge oder Migrationen.

## Prüfungen

Die acht neuen Regressionen führen die tatsächliche Profilroute und die echte
Firmenübersicht aus. Drei davon scheitern gezielt auf dem unveränderten Hauptstand
und bestehen mit der Korrektur; die übrigen schützen fremde/private und bestehende
Profile. Insgesamt 106 gezielte Firmen-, Wiederholungs-, Datenschutz-, Zugriffs- und
Menütests bestehen. Die gemeinsame Designprüfung und alle 17 Sprachkataloge
mit 11.761 Schlüsseln bestehen ebenfalls. Der vollständige Produktionsbuild
einschließlich TypeScript besteht mit 4 GiB Node-Heap; der erste Versuch
erschöpfte das lokale Standardlimit von 2 GiB. Ohne Produktionsvariablen melden
einzelne bestehende statische Datenabrufe ihre Ausweichzustände; dies ist kein
Live-Datenabruf. Browser- und Buildbelege werden unter
`/srv/cinegenius/handoffs/20261126-company-photo-entry/` geführt.

ESLint meldet in der Firmenverwaltung dieselben drei Fehler und drei Warnungen
wie vor der Änderung; die geänderte Profilroute ist ohne Befund. Dies ist keine
Behauptung eines fehlerfreien globalen Lintlaufs.

16 Browserfälle bestehen mit Chromium und WebKit bei 393 und 1366 Pixeln:
eigener Profillink ohne Crewprofil → Kontobereich → Firmenverwaltung →
Bearbeiten → Logo-/Galerieauswahl, delegierte Bearbeitung der zweiten Firma,
Lesemitglied und Wiederholen nach einem fehlgeschlagenen Abruf. Die letzten
getrennten Durchläufe haben keine JavaScript-Seitenfehler; die absichtlich
erzeugte 503-Antwort bleibt als erwartete Konsolemeldung sichtbar. Screenshots
der mobilen Galerie wurden geprüft.

Ein früherer schneller WebKit-Durchlauf meldete `TypeError: Load failed` beim
Wechsel zwischen den unveränderten Abrufflächen. Nach Abwarten der vorherigen
Anfragen bestehen beide isolierten Browserläufe. Der schnelle Abbruchfall ist
nicht als pauschal behoben ausgewiesen und erzeugte hier keinen 404-Nachweis.

Browserprüfungen verwenden die echten Komponenten und kontrollierte Konten/API-
Antworten. Sie ersetzen keinen angemeldeten Kundentest, keine echte Dateiablage
und keine physische iPhone-Prüfung. Eine abschließende Aussage über Sabines
ursprüngliche 404 benötigt ihre Fehleradresse oder einen erneuten Versuch.

## App und Veröffentlichung

Die Korrektur liegt in den gemeinsam genutzten Webrouten. Native Quellen,
TestFlight, Geräteinstallationen und andere laufende App-Kandidaten bleiben
separat. Markus hat „Ja, Korrekturen live stellen“ bestätigt. Veröffentlichung
über `npm run deploy:production` von sauberem `main` identisch mit `origin/main`
und bestätigter Projektidentität; vollständiger Vercel-Build einschließlich
TypeScript, gemeinsamer Designprüfung und 17 Sprachkatalogen bestanden.

Acht Live-HTTP-Prüfungen bestätigen Firmenansicht, alte Firmen-ID, geschützte
Bearbeitungs-/Verwaltungs-/Kontowege, anonymen API-Schutz und weiterhin fehlende
unbekannte Personenprofile. Die mobile Chromium-Prüfung bestätigt zusätzlich
die gerenderte Firmenansicht, die Weiterleitung der alten ID zum Firmenslug und
den Bearbeitungslink zur Anmeldung ohne JavaScript-Seitenfehler. In WebKit
bestehen der direkte Firmenaufruf und der getrennte direkte Bearbeitungsaufruf
bis zu den sichtbaren Anmeldefeldern ebenfalls ohne Seitenfehler.

Prüfgrenze: Beim schnellen Wechsel bzw. dem alten ID-Weiterleitungspfad meldet
WebKit abgebrochene Abrufe, darunter eine Clerk-Anfrage; die Zielseiten wurden
trotzdem erreicht. Der kombinierte WebKit-Lauf gilt deshalb nicht als fehlerfrei.
Dieser Nebenbefund bleibt separat offen und ist weder als Ursache des gemeldeten
404 noch als behoben nachgewiesen. Die erste TLS-Laufzeitkonfiguration und ein
zu allgemeiner E-Mail-Feldselektor betrafen ausschließlich das Prüfwerkzeug und
sind in getrennten Belegen erhalten. Kundensitzung, echter Upload und physische
iPhone-Bedienung wurden nicht geprüft.
Produktionsbelege: `/srv/cinegenius/handoffs/20261126-company-photo-entry/receipt.json`
und `live-checks.json`. Kein nativer Build, keine Geräteinstallation, keine
Migration, keine Änderungen an Kundendaten oder Anbietern.
