# AGB-Löschklausel: beauftragter Entwurf vom 25. November 2026

Markus hat ausdrücklich gefragt: „können wir die 30 tag nicht einfach raus nehemn“. Die pauschale Zusage wird im **unveröffentlichten Entwurf** ersetzt. Das ist keine rückwirkende Vertragsänderung, keine bestätigte rechtliche Freigabe und kein Nachweis erledigter Löschungen.

## Bisheriger Wortlaut und bestehende Rechte

Die bisherige Klausel `Ui.text_b96e50a60df1cc` lautete im deutschen Original:

> Du kannst deinen Account jederzeit ohne Angabe von Gründen löschen. Die Löschung erfolgt über die Accounteinstellungen oder per schriftlicher Anfrage an hello@cinegenius.co. Nach der Löschung werden deine personenbezogenen Daten innerhalb von 30 Tagen gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (z. B. steuerrechtliche Aufbewahrungspflichten nach § 147 AO von bis zu 10 Jahren).

Die Quelle bleibt über die Git-Historie nachvollziehbar. Durch das Entfernen dieser Klausel aus einer künftigen Webseitenfassung werden bereits bestehende vertragliche Ansprüche nicht automatisch beseitigt. Vor Veröffentlichung sind die tatsächlich einbezogene AGB-Fassung, betroffene bestehende Verträge und ein gegebenenfalls erforderlicher Änderungs-/Informations-/Zustimmungsweg fachkundig zu prüfen. Es wird keine Zustimmung durch Schweigen oder bloße weitere Nutzung erfunden. Für bestehende Löschanfragen darf kein längerer Zeitraum allein aus dem neuen Entwurf abgeleitet werden.

## Neuer Entwurf

Quelle: `LegalAuditOriginal.accountDeletion` in allen 17 Katalogen, identisches deutsches Original bis zu geprüften Übersetzungen. `/agb` rendert diesen Schlüssel mit erreichbarer Kontaktadresse und internem Link auf die Datenschutzhinweise.

> Du kannst dein Konto jederzeit ohne Angabe von Gründen über die Kontoeinstellungen oder durch eine Anfrage an hello@cinegenius.co löschen lassen. Nach Beendigung deines Kontos löschen wir die nicht mehr erforderlichen personenbezogenen Daten unverzüglich. Gesetzliche Aufbewahrungspflichten und die erforderliche Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen können der Löschung einzelner Daten entgegenstehen. Diese Daten werden nur im erforderlichen Umfang und nur so lange für den jeweiligen Zweck gespeichert, wie der konkrete Grund besteht. Für Sicherungskopien und Daten bei Dienstleistern sind die tatsächlichen Löschabläufe zu berücksichtigen; weitere Informationen findest du in den Datenschutzhinweisen. Gesetzliche Löschungsrechte und bereits bestehende vertragliche Ansprüche bleiben unberührt.

Die ergänzende Erläuterung zu Eingangsbelegen bleibt erhalten: Annahme einer Anfrage ist keine Löschbestätigung; eine Warteschlange schafft keine zusätzliche Wartefrist. Die Datenschutzhinweise unterscheiden die unverzügliche Bearbeitung und die grundsätzlich einmonatige Antwortfrist nach Art. 12 Abs. 3 DSGVO. Diese Antwortfrist ist keine allgemeine Erlaubnis, Daten einen Monat weiter zu nutzen oder erst dann zu löschen. Zulässige Verlängerungen sind individuell zu begründen und rechtzeitig mitzuteilen.

## Tatsächliche Abläufe bleiben zu belegen

Die Änderung ersetzt weder einen funktionierenden Löschprozess noch Nachweise über Sicherungen, Logs, Dateien oder Dienstleisterreste. Keine konkrete Dauer wird erfunden. Die Kontolöschautomatik bleibt im Entwurf deaktiviert; die Abschlussbestätigung hängt von den zuvor belegten und freigegebenen Regeln ab. Ungeklärte gemeinsame Inhalte und Anbieterzuordnungen bleiben offene Fälle. Siehe [Umfang und Grenzen](../../privacy/account-erasure.md).

Öffentliche Anbieterunterlagen sind nicht gleichbedeutend mit der konkreten CineGenius-Konfiguration: Supabase dokumentiert planabhängige Backup-Zeiträume und getrennte Storage-Objekte. Clerks DPA nennt in Abschnitt 9 einen Zeitraum nach Ende des **Dienstvertrags**; daraus wird keine Frist für die Löschung eines einzelnen CineGenius-Mitglieds abgeleitet.

## Primärquellen

Geprüft am 25.11.2026:

- [§ 311 Abs. 1 BGB](https://www.gesetze-im-internet.de/bgb/__311.html): Vertragsänderungen benötigen grundsätzlich eine vertragliche Grundlage.
- [LfDI Baden-Württemberg: Betroffenenrechte](https://www.baden-wuerttemberg.datenschutz.de/betroffenenrechte/): Löschanspruch, Ausnahmen, Rückmeldung und begründete Fristverlängerung.
- [DSGVO, amtliche Ausgabe der Berliner Datenschutzaufsicht](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/gesetzestexte/2025-BlnBDI_DSGVO.pdf), Art. 5, 12 und 17.
- [BayLfD, 30. Tätigkeitsbericht, Abschnitt 12.5](https://www.datenschutz-bayern.de/tbs/tb30/k12.html): Umgang mit Datenkopien in Backup-Systemen; keine pauschale Backup-Ausnahme ableiten.
- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups), [Clerk DPA, Abschnitt 9](https://clerk.com/legal/dpa).
