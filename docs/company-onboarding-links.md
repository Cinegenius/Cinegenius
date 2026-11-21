# Firmenlink nach der Einrichtung · 21. November 2026

Status: Korrektur vorbereitet, noch nicht veröffentlicht. Kein Datenbank- oder
Providerwechsel, keine Migration und keine Änderung an bestehenden Firmendaten.

## Befund

Der Setup-Assistent bewahrte die Firmen-ID in `quickStart.completed.company` auf
und verwendete sie anschließend als `/companies/<id>`-Link. Die Firmenseite
akzeptierte bisher ausschließlich `companies.slug`. Dadurch konnte eine erfolgreich
gespeicherte Firma nach dem Abschluss wie ein fehlgeschlagener Eintrag wirken.

Ein gemeldeter Fall wurde lesend verifiziert: Der veröffentlichte Firmendatensatz
ist vorhanden; die öffentliche Slug-Adresse zeigt die Firma, die ID-Adresse die
Fehleransicht. Der fehlende ursprüngliche Browser-Verlauf erlaubt keine Aussage
über jeden Klick der betroffenen Sitzung. Es wurden weder Kundendaten verändert
noch Nachrichten verschickt.

## Korrektur und gemeinsamer App-Vertrag

- Die API liefert bereits `data.id` und `data.slug`. Der Assistent erhält die ID
  unverändert für Abschluss-/Wiederholungsprüfungen und merkt zusätzlich den Slug
  in `quickStart.completed.companySlug` für „Firma ansehen“.
- Die private Wiederherstellung übernimmt dieses optionale Feld. Ältere Entwürfe
  ohne Slug bleiben gültig; kein Firmenname wird zu einer Adresse geraten.
- Die Browser-Detailroute sucht zuerst den exakten Slug und bei gültigen UUIDs
  ersatzweise die ID. Erst nach der bisherigen Sichtbarkeitsprüfung erfolgt eine
  Weiterleitung zum tatsächlichen Slug. Private Firmen bleiben für Gäste und
  andere Konten verborgen; Eigentümerzugriff bleibt erhalten.
- Öffentliche Metadaten verwenden den tatsächlichen Slug. Lesefehler werden nicht
  als fehlende Firma ausgegeben. API-Endpunkte und native Detailaufrufe verwenden
  weiterhin den vorhandenen Slug-Vertrag.
- Direkte Firmenerstellung, Dashboard, Verzeichnis, Karten und Suchprojektion
  verwenden bereits Slugs. Locations/Marktplatz verwenden ihre bestehenden
  ID-Routen; sie werden nicht auf Firmen-Slugs umgestellt.
- Darstellung, Texte, Kontaktrechte, Veröffentlichung und Wiederholungsschlüssel
  bleiben unverändert. Native Übernahme und echte Geräteprüfung separat über APP.

## Nachweise

58 gezielte Tests bestanden, darunter 13 neue Regressionen zu alten/neuen Links,
privaten Firmen, Eigentümerzugriff, UUID-förmigen Slugs, aktuellen Sichtbarkeiten
und Fehlerbehandlung. Zwei ältere Profil-API-Testadapter wurden an bereits
vorhandene Währungs-/Bildmodulimporte angepasst. ESLint ohne Fehler; zwei bereits
bestehende Hook-Abhängigkeitswarnungen im Assistenten bleiben ausgewiesen.
17 Sprachkataloge mit 11.303 Schlüsseln und gemeinsame Designprüfung bestanden.
Produktionsbuild einschließlich TypeScript bestanden. In der lokalen Umgebung
fehlen Supabase-Laufzeitvariablen; bestehende statische Projekt-/Empfehlungsabrufe
melden deshalb ihre Ausweichzustände. Das ist kein Live-Daten-/Anmeldetest.
20 WebKit-Browserfälle am tatsächlichen Setup-Assistenten bestanden: Abschluss
in allen 17 Sprachen bei 320 px, Wiederholung nach Abschlussfehler bei 390 px,
alter ID-only-Entwurf bei 768 px und neue Firma bei 1366 px. Keine doppelten
Firmen-POSTs beim Wiederholen; Abschlusslink mindestens 44 px hoch, kein Überlauf.
Der reale öffentliche ID-Link zeigte vor der Korrektur „Scene not found“, der
Slug-Link die Firma. Wegen gestreamter Antworten hatten beide HTTP-Status 200;
der Befund beruht deshalb auf der sichtbaren Browseransicht, nicht dem Statuscode.

Browser- und Buildnachweise werden außerhalb des Repositories unter
`/srv/cinegenius/handoffs/20261121-company-onboarding-link/` geführt. Lokale
Browserprüfungen mit kontrollierter Anmeldung/API sind keine echte Registrierung
und kein nativer Gerätetest. Veröffentlichung erst nach eigener Betreiberfreigabe
und Abstimmung mit dem parallelen App-Release.
