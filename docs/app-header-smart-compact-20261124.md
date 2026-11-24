# App-Kopf und kompakte Smart-Bedienung · 24. November 2026

## Ausgang und Umfang

Basis ist der veröffentlichte e99689540ae83925128859a7687cbc18d8dd338a-Stand. Nach dem getrennten iPhone2220-Update meldet Markus den unterschiedlichen Kopfbereich: Work breit mit Symbol, Community schmal links mit Foto. Vorgabe: „sie soll immer mittig sein mit bild“. Der zusätzliche Auftrag anhand a7ac1627 führt Übersetzen/Aktualisieren in die vorhandene Für-dich/Alle-Zeile rechts vor Info; beim Umschalten soll kein zusätzlicher Original-/Übersetzt-Statustext erscheinen. Fünf Quellschalter und Filterleiste bleiben.

## Korrektur

Die Web-App-Kopfleiste reservierte weiterhin54px für den entfernten Sonnenknopf. Diese Reservierung und dessen ungenutztes CSS entfallen; die vier bestehenden Aktionen nutzen die volle Breite zwischen14px-Rändern bei56px Höhe. Kein neuer Knopf oder Platzhalter. Die tatsächliche Navbar-Kontosteuerung, autorisierter Profilabruf, MediaImage, Konto-/Revisions-/Abbruchschutz bleiben unverändert.

Native Work liegt laut App-Quellprüfung über der erhaltenen WKWebView. Der bestehende HTML-Marker `data-native-workspace-covered` enthält eine volatile UUID, keinen booleschen Wert. Nur zusammen mit dem bestehenden App-Darstellungsmarker blendet CSS Web-Kopf und Web-Dock durch `visibility:hidden` aus. Maße, Scrollgeometrie und gemounteter Zustand bleiben erhalten; nach Entfernen des Markers erscheinen sie wieder. Keine neue Bridge oder Ableitung einer Berechtigung. Eine zweite native Dockinstanz wurde im nativen Quellcheck nicht gefunden. Dass der Web-Dock tatsächlich die fotografierte zweite Kontur verursacht, ist weiterhin nicht durch eine Geräte-Ansichtshierarchie bewiesen.

Native Smart trägt die vorhandene Übersetzungspräferenz und das vorhandene Aktualisieren jetzt in derselben Zeile wie Für dich/Alle/Info. Lange visuelle Fokuslabels dürfen sich verkürzen; vollständige zugängliche Namen,44px-Bedienziele, Tastatur, gedrückter Zustand und Funktion bleiben. Auch nach Wahl des Originals entsteht keine sichtbare Statussatz-Zeile. Ladeanzeige, echte Fehler und Wiederholen bleiben erhalten. Die einfache Smart-Einstiegsansicht entfernt ihre zweite Utility-Zeile vollständig; die weiterhin erreichbare Karteninfo sitzt bei Kartenansicht am Kartenrand links neben den Zoomknöpfen. Der Infotext bleibt innerhalb der Bildschirmbreite. Freie Textsuchen ohne diese Fokuszeile behalten ihre eigenen Übersetzungsaktionen. Die gewöhnliche Website verwendet ihre unveränderte Darstellung.

## Getrennte native Arbeit

Root hat im2221-Fork einen unabhängigen Avatar-Lebenszyklusfehler eingegrenzt: Früher Task-Abbruch vor gültiger Autorisierung und fehlendes Nachladen nach erneuter Freigabe können das SF-Symbol festhalten. Korrektur dort mit bestehendem kontogebundenem Reader und Thumbnail-Validator; kein zusätzlicher Web-Bildabruf, keine globale Fotokopie. Der unveränderliche2220-Stand wird nicht überschrieben.

## Prüfungen und Grenzen

Bestanden: 198 gezielte Tests, 22 Designprüfungen, vollständiges TypeScript, ESLint der drei geänderten TSX-Dateien und 17 Sprachkataloge mit 11.761 Schlüsseln. Die kontrollierten Browserläufe umfassen 14 Header-/Coverage-Fälle sowie 23 Smart-Fälle; keine Browserfehler, Warnungen oder externen Anfragen.

Prüfbelege: `/srv/cinegenius/handoffs/20261124-app-header-center`. Endgültige Prüfsummen und Testergebnisse stehen im Kandidatenbeleg. Header-Browser nutzt tatsächliche Navbar, NativeAppNavbar, BottomNav, MediaImage-Transformation und CSS; Anmeldung, Profilantwort, Next-Bildrenderer und1px-Testbild sind kontrolliert. Smart-Browser nutzt tatsächliches NativeSmartLanding, Explorer, Fokus-/Übersetzungsbedienung, Filter, Views, kontogebundenen History-Zustand und17 Kataloge; Auth/API/Resultate/Karte/Medien/Ortsdienst und äußere Hülle sind kontrolliert. Keine echten privaten Abrufe, Provideraufrufe oder native UIKit-Ausführung.

Gegenproben reproduzieren die54px-Reservierung auf e996 und vergleichen öffentliche Header-/Explorer-HTML und Geometrie bei320/1024px. Abgedeckt werden Web-Konto-/Fotowechsel, alte Antworten, Fotoentfernung, Abmeldung; Coverage mit UUID, Routentausch, unveränderte Höhen und erreichbares Profilmenü nach Rückkehr. Fokuszeile mit17 Sprachen ab320px, große Grundschrift, Tastatur, Modi, leere Quellenwahl, Karteninfo und echter kontrollierter Fehler mit Retry. Zusätzliche Geometriefälle bei 320/393/820px prüfen Abstand zu Zoom und Zähler sowie die Grenzen des Infotexts; die Gegenprobe mit der alten Position erkennt die Überlagerung. Die Kartenbedienung ist dabei eine kontrollierte Nachbildung der vorhandenen 44px-Knöpfe und ihrer 12px-Ränder, kein echter Kartenanbieterabruf. Ältere Resume-Testhülle erhält fehlende tatsächliche Modulbindungen und useMemo-Nachbildung; keine Produktions-Autorisierungslogik wird dafür verändert.

Vollständiger Produktionsbuild und reale iPhone-Prüfung gehören zum abgestimmten Release. Keine eigenständige Veröffentlichung, main-Änderung, Installation oder Behauptung einer physischen Abnahme durch diesen Kandidaten. Kosten9dc bleibt getrennt; Gmail/Provider/Schlüssel/DB unverändert.
