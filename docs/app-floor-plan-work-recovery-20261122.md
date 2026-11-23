# Grundriss mit mehreren Räumen und Work-Wiederaufnahme

Prüfcheckpoint vom22./23.November2026, vor vollständigem Gerätebuild2208. Der installierte2207-Stand und originale Archive bleiben erhalten. Hier beschriebener Quellcode und Komponentenprüfungen sind keine Behauptung einer bereits aktualisierten oder physisch abgenommenen App.

## Grundriss

„Raum hinzufügen“ ergänzt auf derselben Zeichenfläche Rechteck,L-,U-,T- oder Freiformkonturen. Der Benutzer bestätigt eine bekannte Länge. Ein gezeichneter erster Punkt bleibt dabei an seiner Position. Maßvorlagen erhalten beim Öffnen eine zum aktuellen Entwurf gebundene freie Position rechts neben bestehenden Inhalten. Weitere Räume stapeln sich dadurch nicht mehr am Ursprung.

Benannte Räume, Garten und andere Außenflächen liegen im selben Koordinatensystem. Ganze Räume lassen sich verschieben und drehen, ihre Konturpunkte bearbeiten und Änderungen über die vorhandene Historie zurücknehmen. Gemeinsame kollineare Teilwände werden zentral einmal abgeleitet; Garten-/Außengrenzen bleiben gestrichelt. Scan-Ursprünge, alte einzelne Wandobjekte sowie originale Bild-/PDF-Vorlagen werden nicht umgeschrieben. Canvas und PDF/PNG verwenden dieselbe Raumdarstellung; vollständige Namen bleiben auch in Liste/Exportdetails erhalten.

Die23 freigegebenen eigenen Außensymbole sind als17 manuelle Marker,3 echte editierbare Linienarten und1 Polygonart integriert. Sonne und Nord öffnen die bestehenden Werkzeuge. Wind ist ein manueller Hinweis. Die bisherigen56 Roh-IDs und40 eigenen Gerätevektoren bleiben erhalten,21 Objektarten kommen hinzu(77 insgesamt). Ansicht/Bauteile/Licht/Kamera bleiben die vier Hauptmenüs; die verworfene neue Kategorienhauptseite wird nicht eingebaut.

Neue Raum-/Punktgeometrie erhält Archivversion5 mit genau passenden bekannten Features rooms-v1 und/oder outdoor-geometry-v1. Versionen1–4 bleiben lesbar und werden beim bloßen Öffnen nicht neu geschrieben. Fehlende/ungekannte Features, neue Daten unter falscher Altversion und ungültige Konturen werden abgewiesen; Dateien bleiben erhalten. Bis zu50 Räume mit jeweils3–24 Punkten, Objektlinien/-flächen mit bis zu64 Punkten. Das ist Zeichen- und bekannte-Längen-Geometrie, keine automatisch nachgewiesene Vermessung oder Schattenberechnung.

## Work nach Neustart

Die alte Schutzansicht zeigte accountUnavailable schon vor Abschluss ihrer asynchronen Prüfung und bot nur Schließen. Zusätzlich konnte eine Modell-/Präsentationssperre bestehen bleiben: Eine reine Speicherautorisierung konnte diese nicht erneuern; konkurrierende Vordergrundprüfungen konnten sich entwerten. Der dokumentierte Codepfad ist synthetisch reproduziert. Ein konkreter Geräte-Netzwerkfehlerzeitpunkt oder ein Clerk-Ausfall wurde dadurch nicht bewiesen.

Die Korrektur zeigt checking/ready/recovery getrennt. Eine ausdrücklich gestartete gemeinsame Präsentationsprüfung erneuert Modell und Präsentation aus einer frischen authentifizierten Antwort und übernimmt die Freigabe nur in derselben Konten-/Dokument-/Lebenszyklusgeneration. Unteransichten dürfen diese Prüfung teilen; gewöhnliche Speicheroperationen starten sie nicht. Abgebrochene Aufrufer, Konto-/Dokumentwechsel und Hintergrundzustand können keine alte Freigabe wiederbeleben. Vorhandene höchstens fünf Sekunden alte Laufzeitbelege behalten ihre bisherige kurze Wiederverwendung; keine persistierte Identität autorisiert Work.

Echte Fehler bieten Wiederholen/Schließen, bei401 auch die bestehende Anmeldung. Eine unter Work weiterlaufende Webnavigation bleibt ein Sperrereignis; es gibt keinen blinden automatischen Resume-Hook. Zusätzliche Geräteauthentifizierung bleibt entfernt. Ursprungs-/Navigationsprüfung, Konto-/Projektbindung und Widerruf bestehender Schreibfreigaben bleiben in Kraft.

## Prüfstand und noch folgende Schritte

Die Editorstufe umfasst130 Core- und160 mobile Bestandstests vor den eng dokumentierten finalen Folgekorrekturen; danach9 gezielte Modell- und5 Formtests sowie echte SDK-Prüfungen. Eigene ausführende Canvas-/Vektor-/PDF-Fälle prüfen Formen, Vorlagen, Räume, Unterbrechungen und gemeinsame Exporte. Die Authstufe prüft13 synthetische Wiederaufnahmeszenarien mit echtem Context und exakt übernommenen UI-Funktionen sowie einen SDK-Typcheck. Nach Entfernung ausschließlich neu erzeugbarer Buildcaches besteht der vollständige Core-Schlusslauf130/130; der unabhängige gemeinsame Schlusslauf16/16 besteht einschließlich des zuvor durch ENOSPC blockierten Archivfalls, Editor-/Canvas-/Exportfällen und der13 Auth-Wiederaufnahmeszenarien. Der vollständige signierte Appbuild folgt separat.

Lokale Einzelbelege liegen im App-Auftrag unter work/floor-scanner-outdoor-20261122 und work/native-workspace-auth-recovery-20261123. Der finale signierte Kandidat, kanonische Webveröffentlichung, frische iPhone-Sicherung, Dateivergleich vor Erststart und installierte Buildnummer benötigen jeweils eigene Belege. Physische Mehrraum-, Touch-, Export- und Kaltstartabnahme bleibt erforderlich. Keine Provider-/GPS-Anfrage oder neue Datenbankänderung in dieser Arbeit; Gmail bleibt ausgeschaltet und unverbunden.
