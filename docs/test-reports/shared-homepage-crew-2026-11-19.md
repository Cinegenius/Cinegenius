# Gemeinsamer Website-Code: Die Crew – 19. November 2026

Der Abgleich übernimmt den vorhandenen Website-Bereich aus WEB CODEX. Er fügt
keinen nativen Crew-Bereich hinzu. Markus hat die frühere Aussage zur sichtbaren
App-Oberfläche ausdrücklich korrigiert: „bei der app gibt es doch das garnicht“.
Die installierte iPhone-App wurde in diesem Auftrag nicht untersucht.

## Abgleich und Verhalten

- Web-Quelle: `2bbf54b25f52168c119b046ac875e791eccac2b3`, nicht veröffentlicht.
- App-Ausgangsstand: `03615c5b7cf6e2759dc9fa74218c9db57afdf68f`.
- `home.newCrewTitle` entspricht in allen 17 Sprachen der Web-Quelle; Deutsch:
  „Die Crew“. Alle anderen Katalogwerte bleiben erhalten.
- Der ältere App-Arbeitszweig verwendete für diesen Website-Bereich noch
  `random_crew_profiles`. `app/page.tsx` übernimmt deshalb zusätzlich die bereits
  bestehende Web-Abfrage nach `created_at` absteigend und wählt höchstens zehn
  geeignete Personen nach den aktuellen Sichtbarkeitsprüfungen aus. Bei gleichen
  Zeitangaben gilt die vorhandene Namenssortierung der Web-Quelle.
- Lokations- und Marktplatzanbieter bleiben als Personen zulässig;
  reine Firmenprofile und aktuell ausgeblendete Personen werden nicht als
  Crew-Karten ausgegeben. Widerrufene Sichtbarkeit wird erneut geprüft.
- Die Zufallsreihenfolge des vollständigen Crew-Verzeichnisses, Fotogalerie,
  Smart, native Quellen und Scanner bleiben unverändert. Keine neue Schnittstelle
  oder Datenbankmigration. Smart bleibt pausiert.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis und Umfang |
| --- | --- |
| Bestehende Funktionstests | 45 bestanden, 0 Fehler: Homepage-Avatare, Streaming und Crew-Zufallspaginierung. Prüfen unter anderem Chronologie, Privatsphäre vor der Kartenauswahl, erneute Sichtbarkeitsprüfung, optionale Fotos und verzögerte/fehlgeschlagene Datenabrufe. |
| TypeScript | `tsc --noEmit` mit 4-GB-Heap bestanden. |
| Lokalisierung | `check:i18n`: 17 Kataloge, 11.294 Schlüssel, keine neuen unlokalisierten Texte. Zusätzlich geändert wurde ausschließlich `home.newCrewTitle`, jeweils identisch zur Web-Quelle. |
| Design und gezielte Codeprüfung | `check:design`, ESLint für `app/page.tsx` und Diffprüfung bestanden. |
| Browser-Komponentenprüfung | 40 Fälle bestanden: Chromium und Linux-WebKit, jeweils alle 17 Sprachen bei 320 px sowie Deutsch bei 393/834/1280 px. |
| Bestandserhalt | 175 erfasste native, Smart-, Crew- und Fotoquelldateien haben unveränderte Prüfsummen. |

Die Browserprüfung rendert den tatsächlichen `HomeCrew`-Serverinhalt und
`HomeCardRail` mit aktuellem CSS, Schriftarten und klar bezeichneten synthetischen
Profilen. Geprüft wurden Überschrift, zehn Karten in der Reihenfolge neu nach alt,
kein horizontaler Seitenüberlauf, mindestens 44-px-Punktbedienflächen und Wechsel
der Bildreihe. Deutsch wurde in vier Breiten je Browser über eine vereinfachte
Test-Detailseite und echte Browser-Zurück-Navigation geprüft. Keine Browserfehler.
Screenshots bei 393 und 1280 px wurden zusätzlich angesehen.

Die erste externe Testhülle hatte einen abweichenden `main`-Wrapper und dadurch
falsche Seitenränder. Nur die Testhülle wurde dem bestehenden Seitenaufbau
angepasst; anschließend bestanden die abschließend gezählten 40 Browserfälle.
Keine Produkt-Layoutänderung war erforderlich.

## Grenzen und Veröffentlichungsstatus

Die bestehende Web-Abfrage begrenzt auf 300 aktuelle benannte Kandidaten vor der
anwendungsseitigen Sichtbarkeitsprüfung. Bei entsprechend vielen verborgenen
Kandidaten kann der Einstieg weniger als zehn Karten zeigen. Dies ist keine
vollständige Mitgliederliste und keine Gesamttrefferzahl.

Die Browserprüfung verwendet synthetische Daten und optionale Platzhalterbilder;
sie ersetzt weder eine angemeldete Prüfung mit echten Daten noch die komplette
Next.js-Navigation, physisches Wischen, Tastatur-/Safe-Area-Prüfungen oder einen
iPhone-Test. Die vorhandene Capacitor-Quellarchitektur belegt nicht, welche
Oberfläche aktuell auf dem iPhone installiert ist oder welche neueren Änderungen
noch auf dem Mac liegen.

Kein vollständiger Produktionsbuild für diesen kleinen Abgleich, kein Livegang,
keine produktiven Schreibzugriffe und keine neue App-Installation. Web- und
App-Veröffentlichung bleiben getrennte Schritte.

Prüfbelege, Browserhülle und Bilder:
`/srv/cinegenius/handoffs/20261119-app-homepage-die-crew/`.
