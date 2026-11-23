# Günstigere Bildreserve · 23. November 2026

Markus hat die Umstellung auf OpenAI Batch ausdrücklich beauftragt. Quellstand
implementiert und offline geprüft; Migration und Live-Aktivierung stehen separat
aus. Die vorhandene serverseitige Verbindung bleibt, keine neuen Zugangsdaten.

## Kosten und Nutzerablauf

Dasselbe Modell `gpt-image-2.6-flare`, Qualitätsstufe low und dieselben Bildgrößen
laufen über `/v1/batches` mit einem 24-Stunden-Verarbeitungsfenster. Laut
[Batch-Dokumentation](https://developers.openai.com/api/docs/guides/batch) und
[Preisen](https://developers.openai.com/api/docs/pricing) kostet die Erzeugung
50 % weniger als synchron. Beispiel: 1.000 Avatare mit je 823 Bildausgabetokens
kosten dafür rechnerisch 12,345 statt 24,69 USD. Eingabetext, unveränderte separate
Bildprüfung, abgelehnte Versuche und Hosting kommen hinzu. Das ist keine gemessene
Gesamtrechnung und kein Versprechen, sämtliche Bildkosten exakt zu halbieren.

Die Profilerstellung wartet nie auf eine Erzeugung: vorhandene freie Avatare/Cover
bleiben auswählbar, eigene Fotos oder kein Bild weiterhin möglich. Eigentum,
Reservierungen und gespeicherte Bilder bleiben erhalten. Keine Erzeugung allein
durch Anzeigen/Öffnen eines Profils. Bestätigte Zuweisung und bestehender Zeitplan
füllen die Reserve nach; Bestand 18 je Art, täglich maximal 64 neue Aufträge.

## Dauerhafter Ablauf

- Höchstens sechs ausstehende Batch-Aufträge. Pro Datei ein Bild: derselbe Rabatt,
  aber begrenzter Speicherbedarf und kein wiederholtes Laden großer Sammeldateien.
- Vor jeder kostenpflichtigen Anfrage werden Auftrag, einmaliges Token sowie
  hochgeladene Eingabedatei und exakter Anfrage-Hash dauerhaft gespeichert.
- Keine automatische Wiederholung einer Erzeugung bei unklarem Ausgang. Eine
  verlorene Auftragsbestätigung wird anhand Datei, Auftrags-ID und Hash gesucht.
  Unauffindbare/mehrdeutige Ergebnisse bleiben als ungeklärt stehen. Sie blockieren
  keinen Profilabschluss und lösen keinen teuren synchronen Ersatz aus.
- Statusprüfung frühestens nach 15 Minuten; keine wartende Serverfunktion über
  die mögliche Laufzeit von 24 Stunden. Der bestehende geschützte Zeitplan bleibt.
- Fertige Ergebnisse werden einzeln übernommen: genaue Zuordnung, begrenzte
  Datenmenge, Bild-/Duplikatprüfung, unabhängige Stilprüfung, verifizierter privater
  Speicher, atomare Freigabe. Ein Auftrag wird nie allein wegen „completed“ öffentlich.
- Nach einer Prompt-/Modelländerung dürfen ältere ausstehende Bilder nicht als
  neue Stilfassung etikettiert werden: ihr Anfrage-Hash muss weiterhin passen.
- Keine Erzeugungswiederholung nach abgelaufener Übernahme. Anbieterdateien nach
  der Übernahme/definitivem Fehlschlag löschen; Wiederholung dieser Löschung ist
  unschädlich. Eingabedateien erhalten zusätzlich sieben Tage Aufbewahrungsfrist.
- Alle neuen Befehle sind service-only; keine Mitgliederdaten, Fotos oder freien
  Nutzerprompts. Pipeline-/Review-Schalter und bisherige Budgetgrenzen bleiben.

## Aktivierung und Prüfung

Vor abhängiger Veröffentlichung nur die neue Migration
`20261123134457_profile_art_batch_generation.sql` gezielt anwenden. Die rein lesende
Produktionsvorprüfung am 23.11.2026 fand **kein**
`supabase_migrations.schema_migrations` und noch keine Batch-Spalten. Deshalb kein
blindes `db push` oder erfundene historische Registereinträge: bestehenden
Katalog/Quellbeleg vorab vergleichen, genau diese Migration mit eigenem
Anwendungsbeleg ausführen und die neuen Definitionen/Rechte danach unabhängig
prüfen. Diese Aktivierung ist noch nicht erfolgt. Die Migration ergänzt private
Auftragsfelder und schaltet
alte synchrone Claim-Funktionen auf Leerlauf. Bereits laufende alte Aufträge können
noch abschließen. Keine Profile oder Eigentumsdatensätze werden geändert. Ein
Rollback des Codes allein darf die alten teuren Claims nicht wieder aktivieren.

Zehn neue Prüfungen auf echten lokalen PostgreSQL-Regeln (PGlite) und simuliertem
Anbieter bestanden: verlorene Antworten, kein doppelter POST, Teilresultate,
Leaseablauf, Höchstgrenzen, unberechtigte Tokens/Rollen, fremde Bild-IDs/URLs,
Dateigrößen, Anfrage-Hash und vollständiger Bildprüfpfad. Die bestehende
Refill-/Bestands-/Stilsuite wird separat erhalten. Kein bezahlter echter Batchlauf,
keine angewandte Produktivmigration und keine gemessene Kosteneinsparung behauptet.

Belege: `/srv/cinegenius/handoffs/20261123-verification-check/`.
