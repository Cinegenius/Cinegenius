# Homepage-Crew: neue Auswahl- und Sichtbarkeitsvorgabe

Stand 21. November 2026: von WEB CODEX übermittelter Betreiberauftrag,
**angekündigter Vertrag, noch kein geprüfter Produktcommit und nicht live**.
WEB arbeitet auf `codex/home-crew-discretion-20261121`, angekündigte Basis
`a3ff549a`; Tests laufen. Der Abschlussbeleg wird gesondert geliefert.
Diese App-Vormerkung ist ausschließlich Dokumentation.

## Auswahl auf der Startseite

- Die Überschrift lautet exakt **Crew**.
- Neue Registrierungen erhalten keinerlei Vorrang, auch nicht für 24 Stunden.
  Die Auswahl wechselt mit der bestehenden Länderpriorisierung.
- Die frühere Regel aus WEB `f6b45be5` / App `0c5e63fd` ist durch diesen Auftrag
  ersetzt. Ihre damaligen Testergebnisse bleiben historische Belege; die
  Bevorzugung darf beim nächsten Abgleich nicht wieder eingeführt werden.
- Der neue Auftrag betrifft die Startseiten-Auswahl. Native News-/Crew-Navigation
  und die bestehenden Regeln der allgemeinen Crew-Entdeckung bleiben bestehen.

## Angekündigter gemeinsamer Datenvertrag

| Feld / Weg | Vorgesehene Bedeutung |
| --- | --- |
| `user_settings.show_in_home_crew` | Kontogebundener boolescher Wert; nach bereitgestelltem Schema Standard `true` für bestehende Konten. `false` schließt das Profil aus dieser Startseiten-Auswahl aus. |
| `GET /api/user-settings` | Bestehenden privaten Einstellungsweg um das Feld ergänzen; keine parallele native Datenhaltung einführen. |
| `PATCH /api/user-settings` | Nur das eigene angemeldete Konto, erfolgreiche Speicherung bestätigen; vorhandene Konto-/Fehlerregeln erhalten. |
| Profileinrichtung | Freiwillige Wahl anbieten und bestätigt speichern, bevor das Profil veröffentlicht wird. Wiederholen darf weder die Wahl verlieren noch das Profil doppelt anlegen. |
| Einstellungen → Privatsphäre | Die gleiche gespeicherte Wahl später bearbeiten. |

Ghost, Mitglieder-/Freundes-Sichtbarkeit und bestehende öffentliche Rechte haben
Vorrang. `true` macht kein ansonsten verborgenes Profil sichtbar. `false` ist ein
Ausschluss aus dieser Auswahl, keine Löschung und keine Änderung der allgemeinen
Profilveröffentlichung. Ausschluss und aktuelle Rechte müssen vor Auswahl und
Begrenzung wirken; das ist mit dem abschließenden WEB-Stand zu prüfen.

Der Standard für bestehende Datensätze ist nicht mit einem fehlenden Feld in
einer alten API-Antwort gleichzusetzen. Native Einrichtung/Einstellungen dürfen
eine nicht bestätigte Wahl nicht als gespeichert anzeigen. Veraltete Antworten
bei Kontowechsel verwerfen, Eingabe bei Fehlern behalten und Wiederholen anbieten.
Alle sichtbaren und zugänglichen Texte in den 17 unterstützten Sprachen abgleichen.

## Abhängigkeit und noch offene Prüfung

WEB nennt die additive Migration
`20261121145336_home_crew_visibility.sql`. Sie ist hier nur als Abhängigkeit
erfasst; weder SQL noch Datenbankwirkung sind in dieser Vormerkung geprüft oder
angewandt. Vor funktionaler App-Übernahme den endgültigen Commit, API-Antwort,
Speicherreihenfolge, Migrations-/Schema-Nachweis und die Sprach-/Testergebnisse
aus der abschließenden WEB-Übergabe prüfen. Kein Produktionsauftrag aus dieser
Ankündigung ableiten.

Zu belegen bleiben insbesondere: keine Bevorzugung junger Konten, Länderwahl,
Ausschluss vor Limits, Altbestandsstandard, Ghost/Mitglieder/Freunde, Kontowechsel,
fehlendes Schema/Feld, fehlgeschlagenes Speichern vor Veröffentlichung und
Wiederaufnahme alter Einrichtungsvorgänge. Native Geräteprüfung gesondert.

In dieser Aufgabe: keine Produktdateien/Sprachkataloge geändert, keine neuen
Laufzeittests, keine Migration, Veröffentlichung oder Installation.
Die bestehende Crew-Rotationsarbeit bleibt als unveränderter historischer Zweig
erhalten. Empfangsbeleg:
`/srv/cinegenius/handoffs/20261121-app-home-crew-discretion-contract/receipt.json`.
