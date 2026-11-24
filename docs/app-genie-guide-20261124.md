# Kurzer App-Rundgang im vorhandenen Genie · 24. November 2026

Status: isolierter Quellkandidat auf `3a766008`, noch nicht veröffentlicht oder auf einem Gerät abgenommen.

## Auftrag und Umfang

Der direkte Betreiberauftrag im lokalen APP-Root vom 24. November verlangt einen kurzen Genie-Einstieg bei der ersten App-Nutzung und das Entfernen des Hell/Dunkel-Schalters samt oberem Sonnensymbol. Dieser Webanteil blendet die App-Kopfschaltung und den nativen Menü-Einhängepunkt aus. Die aktuelle Palette, gespeicherte Auswahl und Theme-Engine bleiben erhalten. Swift-Menüs und native Work-Werkzeuge gehören weiter dem APP-Root. Die gewöhnliche Website verliert keinen Theme-Schalter.

Vier übersetzte Schritte erklären Smart, Projekte, Work mit Analyse/Floor Scanner und Nachrichten. Weiter, Zurück, Überspringen und erneutes Öffnen über „App-Rundgang“ im vorhandenen Genie sind verfügbar. Kein zweiter Assistent, kein neuer Anbieter, kein automatischer Chat, keine Dokumentanalyse, Navigation oder native Werkzeugausführung. Die Anleitung selbst sendet keine Anfrage.

Der vorhandene Web-Hamburger enthält bereits Jobs, Board, Hilfe und Support. Persönliche Zugänge zu Merkliste, Kollegen und HOMIES bleiben erreichbar; doppelte native Menüeinträge werden separat vom APP-Root bereinigt.

## Erste Anzeige, Zustand und Daten

Automatisch nur mit aktuell übereinstimmender aktiver Clerk-Sitzung, App-Darstellung und sichtbarem fertigem Community-Bereich. Kein Öffnen über Anmeldung/Einrichtung, nativem Work, eingebetteter Ansicht, verdecktem Dokument, Formularfokus oder sichtbarem Dialog. Das ist eine UI-Regel und gewährt keinerlei Konto-/Projektrechte. Der bestehende Authkontext und Bootvertrag werden nicht verändert.

Erst ausdrückliches Beenden, Überspringen, Schließen oder Außentippen speichert ausschließlich `cg_app_guide_v1=done` im lokalen Browserspeicher. Keine Identität, Nachrichten, Eingaben, Analysedaten oder Trackingereignisse. Bei gesperrter Speicherung gilt der Abschluss nur für die aktuelle Dokumentlaufzeit. Konto-/Sitzungsverlust oder bloßes Entfernen der Komponente markiert die Anleitung nicht als erledigt. Die Kennzeichnung ist pro Browserinstallation/Version, nicht kontogebunden.

Die eigentliche Chat-Komponente lädt erstmals beim bewussten Öffnen nach der Anleitung. Beim späteren Wiederholen bleibt ein bereits geladener Chat mit seinem ungesendeten Entwurf erhalten; laufende Anfragen folgen dem vorhandenen Abbruch bei inaktivem Chat. Sprach-/Chat-/Providerregeln bleiben unverändert.

## Integrationsgrenze

Bei Kaltstart direkt in nativem Work wird die automatische Anleitung bis zur ersten sichtbaren Community-Ansicht zurückgestellt. Ein sofortiger Einstieg im nativen Work ist noch mit APP zu integrieren. Der Webkandidat behauptet keine vollständige Erstbenutzung aller nativen Bereiche. Eingebettete Genie-Ansichten behalten ihre bisherigen Öffnungsregeln; kein versteckter Webview darf den Rundgang ungefragt abschließen.

## Prüfstand

104 gezielte Fälle für Anleitung, Genie-Chat, Begrüßung, native Genie-Besitzregel und Kopfzeile bestanden. 20 verpflichtende Designfälle und alle 17 Sprachkataloge mit 11750 Schlüsseln bestanden. Vollständiges TypeScript und gezieltes ESLint bestanden. 64 kontrollierte Chromiumfälle bestanden: alle17Sprachen bei320/393/1024px sowie10Verhinderungs-/Wiederaufnahmefälle, nativeGenie-Besitzregel bei320×430px, blockierter UI-Speicher und Sitzungsverlust. 0ungeplanteNetzwerkanfragen und0Browserfehler. Nach der rein internen Umbenennung einer Übersetzungsschlüssel-Eigenschaft wurde die finale Quelle zusätzlich gezielt geprüft. Die kurze Ansicht ist innerhalb der Anleitung scrollbar; sie ist keine physische Tastaturabnahme.

Browserprüfung verwendet die tatsächlichen Genie-/Guide-/Besitzregel-Komponenten und Modul-CSS mit React, aber synthetische Clerk-Werte und einen kontrollierten Chatkörper. Sie beweist keinen echten Login, keine Produktionsdaten, keine physische Tastatur und keine native Gerätebedienung. Sprach-/Viewport-, Auslassen/Wiederholen-, Fokus-/Dialog-, Sitzungswechsel- und Netzwerkfreiheit werden getrennt protokolliert. Belege: `/srv/cinegenius/handoffs/20261124-app-genie-guide/`.

Veröffentlichung erst nach gemeinsamer Abstimmung mit dem Teamgruppen-Paket und den bestehenden Releaseprüfungen. Kein unabhängiger Parallelrelease, keine Gmail-/TestFlight-Aktivierung oder neue Geräteinstallation durch diesen Kandidaten.
