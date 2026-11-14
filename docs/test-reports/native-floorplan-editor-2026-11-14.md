# Native Anmeldung und Location-Grundrisseditor – 14. November 2026

## Umfang

App-Branch `codex/cinegenius-mobile`, Ausgangspunkt `cff0926`.
Anmeldeeinstieg und persistenter WebKit-Speicher, enge Clerk-Handshake-Ausnahme,
servergeprüfte eigene vorhandene Locations, kontogebundene lokale Raumarchive,
Baustein-Editor, zwei Finger zum Verschieben/Zoomen, manuelle Rechteckräume,
PDF-Ergänzungen und neun Sprachkataloge. Keine Website-Veröffentlichung.

## Hier tatsächlich geprüft

- `npm --prefix mobile test`: **10/10 bestanden**. Authentifizierte GETs,
  Eigentümerfilter, Kontowechsel während des Ladens, 401/503/ungültige Antworten,
  bestehendes 200-Inserate-Limit, Origin-Konfiguration und Katalogvollständigkeit.
- `swift test ... --jobs 2`: **23/23 bestanden**, Swift 6.2.1 auf Ubuntu 24.04.
  Acht Editor-/Kontoprüfungen plus 15 vorhandene Kernprüfungen: Rundreise von
  Koordinaten mit Zoom/Pan/Drehung, ungültige Objekte, Undo/Redo, Schema-1-Lesen,
  Eigentümer/Location-Grenze, idempotente Updates, Revisionskonflikte, unveränderte
  Originale/andere Räume bei Schreibfehlern, enge Handshake-URL-Prüfung.
- Apple-Backup-Exclusion-Metadaten sind auf Linux nicht vorhanden. Die zwei
  entsprechenden Assertions bleiben auf Apple aktiv; hier wurden sie nicht
  ausgeführt. POSIX-Dateirechte wurden ausgeführt und bestanden.
- Swift-Syntaxprüfung aller nativen App-Dateien: bestanden. Foundation-Kern und
  isolierter PDF-Koordinatentransform zusätzlich typgeprüft.
- `npm run check:i18n`: neun Kataloge, **7963 Schlüssel**, keine neuen erfassten
  unübersetzten Texte. **153 NativeRoomScanner-Schlüssel** in jeder Sprache.
- `npm --prefix mobile run prepare:preview`: bestanden; Anmeldung als Startpfad,
  neun native Kataloge/Permission-Texte und isoliertes Kontoskript erzeugt.
- `npm run check:design` und `git diff --check`: bestanden.

Die vorübergehende Linux-Swift-Werkzeugkette lief nur für die Kernprüfungen und
wurde nicht als systemweite Installation eingerichtet. Ein anfänglicher
Compilerfehler in der Geometrie und eine zu frühe `self`-Erfassung wurden vor
dem erfolgreichen Durchlauf behoben. Der ursprüngliche Linux-Testlauf meldete
außerdem die erwartbar fehlenden Apple-Backup-Metadaten; die Plattformgrenze ist
jetzt ausdrücklich im Test markiert, ohne Apple-Assertions zu entfernen.

## Noch nicht nachgewiesen

- Vollständiges Kompilieren/Linken mit UIKit, SwiftUI und dem aktuellen Xcode-SDK.
- Erfolgreiche Anmeldung, MFA/Passwort-Wiederherstellung, Abmeldung, erneutes Öffnen
  und Sitzungserneuerung im **tatsächlichen iPhone-WebView**. Der Handshake-Fix ist
  aus dem vorhandenen Capacitor/Clerk-Code abgeleitet, nicht am Fehlergerät bestätigt.
- Gestenwechsel ein/zwei Finger, Pinch zusammen mit Pan, VoiceOver, Dynamic Type,
  320pt, Rotation, Tastatur und alle neun Sprachen im nativen Editor.
- PDF-Rendering/Seitenumbrüche und echte Share-Sheet-Unterbrechungen.
- Zwei echte Testkonten, entzogenes Location-Recht, Wiedereinstieg nach Anmeldung,
  Scanunterbrechung, erneuter Appstart und Dateischutz auf einem gesperrten Gerät.
- Installation dieses Updates auf Markus' iPhone. Die bestätigte Installation
  aus `MAC-DEVICE-INSTALL.md` gehört zur **vorherigen Fassung**.

Der Mac-Nachrichtenkanal schlug erneut mit dem veralteten lokalen MCP-Endpunkt
fehl. Daher wurde kein neuer Arbeitsauftrag an den Mac zugestellt. Nicht als
aktualisierten Xcode-/iPhone-Stand melden. Ein überprüfbares Quellpaket mit
Manifest liegt unter `/srv/cinegenius/handoffs/20261114-floorplan-editor/`.

## Bewusste Grenzen

Bestehender Backend-Endpunkt maximal 200 Inserate, sichtbar ausgewiesen.
Alte ungebundene lokale Scans bleiben erhalten, werden aber nicht automatisch
in eine Kontobibliothek übernommen; bestätigte Zuordnung bleibt offen.
Kein Cloudbackup, kein Raumzusammenfügen, keine freie Wandbearbeitung, keine
Leitungsberechnung. Das 3D-Modell bleibt der Originalscan ohne 2D-Bausteine.
