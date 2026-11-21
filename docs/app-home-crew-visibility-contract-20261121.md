# Homepage-Crew: geprüfter Vertrag für die App

Stand 21. November 2026: geprüfter WEB-Quellstand
`5cafc814b92f5ab9ab58c3c7936cfb7374c40535` auf
`codex/home-crew-discretion-20261121`, Basis
`a3ff549af885721d437158742d117109c8974fdc`.
WEB meldet inzwischen die gesondert freigegebene Veröffentlichung in Arbeit;
**der abschließende Live-/Datenbankbeleg steht noch aus**.
Diese App-Aufgabe übernimmt ausschließlich Dokumentation, keine native Umsetzung.

Der [gemeinsame Vertrag](home-crew-discretion.md) ist unverändert aus diesem
Quellstand übernommen. Seine Statusangabe beschreibt den geprüften Vorabstand;
spätere Produktionsnachweise werden getrennt dokumentiert.

## Auswahl und Reichweite

- Die Überschrift lautet exakt **Crew** in allen 17 Web-Katalogen.
- Neue Registrierungen erhalten keinerlei Vorrang. Registrierungsdaten werden
  weder für die Reihenfolge verwendet noch mit den Crew-Karten ausgeliefert.
- Die Auswahl rotiert im bestehenden 15-Minuten-Takt bei einer neuen Anfrage;
  eine bereits geöffnete Bildreihe springt nicht durch einen Timer um.
  Länderpriorisierung, Bildreihe und Kartengestaltung bleiben erhalten.
- Die frühere Regel aus WEB `f6b45be5` / App `0c5e63fd` ist ersetzt. Der alte
  Zweig und seine damaligen Testergebnisse bleiben als historische Belege erhalten.
- Die neue Sichtbarkeitswahl betrifft ausschließlich die Homepage-Crew.
  Allgemeines Verzeichnis/Profil, persönliche Angebote und separate Foto-Entdeckung
  behalten ihre eigenen Sichtbarkeitsregeln. Native News-/Crew-Navigation erhalten.

## Gemeinsamer Datenvertrag

| Feld / Weg | Bedeutung für die App |
| --- | --- |
| `user_settings.show_in_home_crew` | Boolescher Wert, nach bereitgestelltem Schema Standard `true`; `false` schließt das Profil aus der Homepage-Crew aus. Fehlende Einstellungszeile nutzt den Standard, fehlendes API-Feld gilt als nicht verfügbar. |
| `GET /api/user-settings` | Bestehender privater, kontogebundener Einstellungsweg; keine parallele native Datenhaltung. |
| `PATCH /api/user-settings` | Nur eigenes angemeldetes Konto, echte boolesche Eingabe, Prüfung der mitgesendeten `accountId`, bestätigte Rückgabe der gespeicherten Wahl. |
| `quickStart.showInHomeCrew` | Im vorhandenen privaten Einrichtungsvorgang erhalten; nur tatsächliche boolesche Werte übernehmen. |
| Profileinrichtung | Freiwillige Wahl bei optionalen Angaben und Prüfung; vor Profilanlage/-änderung bestätigt speichern. Fehler stoppt den Abschluss und erhält die Eingaben für Wiederholen. |
| Einstellungen → Privatsphäre | Dieselbe gespeicherte Wahl später bearbeiten; Kontowechsel und veraltete Antworten absichern. |

Ghost, Mitglieder-/Freundes-Sichtbarkeit und bestehende Rechte haben Vorrang.
`true` macht kein verborgenes Profil öffentlich. Kandidaten werden vor der
Auslieferung erneut geprüft; ausgeschlossene Profile werden durch weitere
berechtigte Kandidaten ersetzt. Bei fehlgeschlagener Einstellungsabfrage wird
keine Crew-Auswahl ausgeliefert.

Die Wahl erst als gespeichert anzeigen, wenn die Antwort sie bestätigt. Native
Einrichtung darf bei unbestätigter Wahl kein Profil veröffentlichen. Alle Texte,
Fehler- und Wiederholungszustände in den 17 unterstützten Sprachen abgleichen.

## Schema und Veröffentlichungsgrenze

`20261121145336_home_crew_visibility.sql` ergänzt ausschließlich die boolesche
Spalte mit `NOT NULL DEFAULT true` in der vorhandenen Einstellungs-Tabelle;
keine Änderung an RLS, Zugriffsrechten oder Profilveröffentlichungen. Der SQL-
Quelltext ist hier nachgelesen, die Produktionswirkung hier nicht ausgeführt
oder bestätigt. WEB übernimmt Migration, Schema-Prüfung und Veröffentlichung;
kein paralleler Produktionslauf aus der älteren App-Arbeitsbasis.

Vor funktionaler nativer Übernahme den endgültigen Live-Commit, Schema-Nachweis,
Standardwerte und bestätigte false-Speicherung aus dem Abschlussbeleg abgleichen.
App-Implementierung, Installation und echte Geräteprüfung bleiben gesondert.

## Prüfnachweise und Grenzen

WEB dokumentiert 93 unterschiedliche gezielte Testfälle: zunächst 91 bestanden,
zwei veraltete Erwartungen korrigiert; der anschließende Streaming-Lauf besteht
17/17, die abschließende Avatar-/Serialisierungsprüfung 25/25. Diese Wiederholungen
werden nicht zu den 93 Fällen addiert. Hinzu kommen 21 kontrollierte Browserfälle:
17 Sprachen bei 320px sowie 390/768/1366px, Speichern/Neuladen, Fehler/Wiederholen,
Kontowechsel und Einrichtungs-Wiederaufnahme ohne Profilanlage nach Speicherfehler.

Kataloge (17 Sprachen, 11.319 Schlüssel), Design und vollständiger Build samt
Typen bestanden laut WEB. Zwei vorhandene Hook-Lintfehler und zwei vorhandene
Warnungen wurden gegen die unveränderte Basis bestätigt; kein sauberer Gesamtlint
behauptet. Authentifizierung, Transport und Medien waren kontrolliert. Im lokalen
Build fehlten Supabase-Laufzeitberechtigungen; bestehende Daten-Fallbacks wurden
protokolliert. Keine echte Anmeldung, Live-Datenbank- oder iPhone-Abnahme aus
diesen Vorabtests ableiten.

Diese App-Aufgabe hat Vertrag, Auswahl/Serialisierung, API, Einstellungen,
Einrichtung/Entwurf, SQL und die drei betroffenen Textschlüssel in allen 17
Quellkatalogen nachgelesen. Eigene Prüfung: identischer Vertragsinhalt,
Dokumentationsverweise und sauberer Diff; keine neuen Laufzeit-/Gerätetests und
keine Sprachqualitätsfreigabe aus der reinen Schlüsselkontrolle.

WEB-Beleg: `/srv/cinegenius/handoffs/20261121-home-crew-discretion/receipt.json`.
App-Empfang: `/srv/cinegenius/handoffs/20261121-app-home-crew-discretion-contract/receipt.json`.
