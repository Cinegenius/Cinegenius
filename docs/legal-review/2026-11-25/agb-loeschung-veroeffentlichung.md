# AGB-Löschklausel: beauftragte Veröffentlichung am 25. November 2026

Markus hat die Entfernung der pauschalen 30-Tage-Zusage und anschließend ausdrücklich den Livegang beauftragt. Die Veröffentlichung wird auf die geänderte Klausel und den AGB-Stand begrenzt. Die weitere Datenschutzarbeit aus `0fa6f23a` bleibt unveröffentlicht; insbesondere werden weder der neue HTTP-202-Löschvertrag noch Worker, Datenbankmigrationen oder deren Beschreibung aktiviert.

## Wortlaut

Bisherige Klausel (bestehende vertragliche Ansprüche bleiben erhalten):

> Du kannst deinen Account jederzeit ohne Angabe von Gründen löschen. Die Löschung erfolgt über die Accounteinstellungen oder per schriftlicher Anfrage an <part1>hello@cinegenius.co</part1>. Nach der Löschung werden deine personenbezogenen Daten innerhalb von 30 Tagen gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (z. B. steuerrechtliche Aufbewahrungspflichten nach § 147 AO von bis zu 10 Jahren).

Neue Fassung, als deutscher Originaltext in allen 17 Sprachkatalogen:

> Du kannst dein Konto jederzeit ohne Angabe von Gründen über die Kontoeinstellungen oder durch eine Anfrage an <contact>hello@cinegenius.co</contact> löschen lassen. Nach Beendigung deines Kontos löschen wir die nicht mehr erforderlichen personenbezogenen Daten unverzüglich. Gesetzliche Aufbewahrungspflichten und die erforderliche Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen können der Löschung einzelner Daten entgegenstehen. Diese Daten werden nur im erforderlichen Umfang und nur so lange für den jeweiligen Zweck gespeichert, wie der konkrete Grund besteht. Für Sicherungskopien und Daten bei Dienstleistern sind die tatsächlichen Löschabläufe zu berücksichtigen; weitere Informationen findest du in den <privacy>Datenschutzhinweisen</privacy>. Gesetzliche Löschungsrechte und bereits bestehende vertragliche Ansprüche bleiben unberührt.

Die Änderung führt keine längere Wartefrist ein und ersetzt keinen tatsächlichen Löschvorgang. Sie behauptet weder eine vollständige Datenschutzfreigabe noch belegte Speicherfristen bei Dienstleistern oder Sicherungen. Es wird keine Zustimmung bestehender Mitglieder erfunden. Frühere Fassungen und Ansprüche bleiben über die Git-Historie und die ausdrückliche Bestandsschutzklausel nachvollziehbar.

## Prüfungen und Veröffentlichungsweg

Der Änderungssatz wird getrennt auf dem aktuellen Hauptstand aufgebaut. Die Nutzeroberfläche behält Aufbau und Gestaltung; Links auf Kontakt und Datenschutzhinweise bleiben erreichbar. Der neue Originaltext wird mit dem tatsächlichen Übersetzungssystem und der AGB-Komponente in allen 17 Sprachen gerendert. Sprach- und Designprüfungen laufen vor dem Release; der geschützte Produktionsbefehl prüft zusätzlich sauberes `main == origin/main` und die CineGenius-Projektidentität und baut auf Vercel.

Die abschließenden Veröffentlichungs- und Liveprüfungen werden außerhalb des veröffentlichten Commits unter `/srv/cinegenius/audits/20261125-agb-release/` festgehalten. Ein vorbereiteter oder gestarteter Build ist kein Live-Nachweis. Es erfolgen keine Datenbankänderungen und keine Änderung des bestehenden Konto-/App-API-Vertrags. Die separate Löschautomatik benötigt weiterhin die in ihrem Entwurf dokumentierten Nachweise und Prüfungen.

## Aktuell geprüfte Primärquellen

- [§ 311 Abs. 1 BGB](https://www.gesetze-im-internet.de/bgb/__311.html): vertragliche Grundlage für Änderungen bestehender Schuldverhältnisse.
- [LfDI Baden-Württemberg: Betroffenenrechte](https://www.baden-wuerttemberg.datenschutz.de/betroffenenrechte/): Löschansprüche, begründete Ausnahmen und Antwortfristen.

Die grundsätzlich einmonatige Antwortfrist wird nicht als allgemeine Wartefrist für die Löschung verstanden. Für Sicherungen und Dienstleister werden keine unbelegten Zahlen ergänzt.
