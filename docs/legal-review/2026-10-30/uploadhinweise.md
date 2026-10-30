# Kurze Hinweise für Upload und Veröffentlichung

Die kurze Informationskomponente `components/ContentUsageNotice.tsx` wurde nach ausdrücklicher Freigabe in die vorhandenen Fotoabschnitte von Profileinstellungen, Firmeneinstellungen, Inseratserstellung, Dashboard-Bearbeitung, ProfileSetupWizard und GuidedListingWizard eingebunden. Der AGB-Entwurf und die Marketingvorlage bleiben unveröffentlicht. Sie verwendet die vorhandenen Übersetzungskataloge; Deutsch, Englisch, Spanisch, Italienisch, Tschechisch und Ungarisch sind als Vorschau vorbereitet. Das ersetzt keine Prüfung übersetzter verbindlicher Rechtstexte.

## Normaler Upload

Direkt unter dem vorhandenen Uploadfeld:

> Fotos sind freiwillig. Lade nur Inhalte hoch, die du hier verwenden darfst.

Darunter ein kompakter, zunächst geschlossener Aufklapper **„Nutzung und Sichtbarkeit“**. Er führt zu keiner weiteren Seite und enthält kein Zustimmungshäkchen. Der vorhandene Upload, seine Dateiprüfung und sein Speicherablauf bleiben unverändert.

Aufgeklappte Erklärung:

> Deine Rechte bleiben bei dir beziehungsweise den Rechteinhabern. Beachte auch Rechte abgebildeter Personen und an Logos. CineGenius darf Bilder für die gewählten Plattformfunktionen speichern, verkleinern und ausliefern. Externe Werbung benötigt eine gesonderte Grundlage.

Der Informationslink **„Mehr zu Bildrechten“** führt zur bestehenden Seite `/bildrechte`. Er ist kein Beleg, dass eine konkrete Veröffentlichung rechtmäßig ist.

## Sichtbarkeit passend zum tatsächlichen Status

Nur einen belegten Status behaupten. Für Formulare mit unterschiedlichen privaten und öffentlichen Bearbeitungsständen wird die neutrale Variante `configured` verwendet: „Welche Inhalte öffentlich erscheinen, richtet sich nach ihrer Freigabe und deinen Sichtbarkeitseinstellungen. Ein Upload allein veröffentlicht keinen privaten Entwurf.“ Danach folgt der zur Quelle passende Satz über öffentliche Bilder. Es wird kein unbekannter Status als öffentlich ausgegeben. Die gezielten privaten/eingereichten Varianten bleiben für Aufrufer mit sicher bekanntem Status verfügbar.

| Aktueller Zustand | Kurzer Satz im aufgeklappten Hinweis |
| --- | --- |
| Privater Entwurf | „Dieser Entwurf und seine Bilder sind nicht öffentlich.“ |
| Beschränkte Sichtbarkeit | „Nur die nach deinen Einstellungen berechtigten Personen können diese Inhalte sehen. Sie erscheinen nicht in der öffentlichen Community-Auswahl.“ |
| Zur Prüfung eingereicht | „Deine Einreichung bleibt bis zur Freigabe nicht öffentlich.“ |
| Öffentliches Personenprofil | „Öffentliche Profilfotos, Cover und direkt hochgeladene Portfoliofotos können auch in ‚Frische Einblicke‘ erscheinen.“ |
| Öffentliches Firmenprofil | „Öffentliche Firmenlogos, Cover und Galeriefotos können auch in ‚Frische Einblicke‘ erscheinen.“ |
| Öffentliches Angebot | „Öffentliche Angebotsbilder können in passenden Übersichten und Suchergebnissen erscheinen. Sie gehören nicht in ‚Frische Einblicke‘.“ |
| Öffentliches eigenständiges Projekt | „Öffentliche Projektbilder können in Projektansichten erscheinen. Sie gehören nicht in ‚Frische Einblicke‘.“ |
| Öffentlicher Brettbeitrag | „Öffentliche Beitragsbilder können beim Beitrag und in passenden Übersichten erscheinen. Sie gehören nicht in ‚Frische Einblicke‘.“ |

Ein Firmenformular, dessen Speichern erstmals veröffentlicht, muss die **künftige Folge vor dem Speichern** zusätzlich klar am vorhandenen Speicherbutton erklären: „Mit dem Speichern wird dein Firmenprofil öffentlich.“ Der Entwurfshinweis allein reicht dafür nicht.

## Hinweise an vorhandenen Abschlussaktionen

Die bestehende Veröffentlichungslogik bleibt verbindlich:

- Personenprofil: „Mit ‚Profil veröffentlichen‘ wird dein Profil entsprechend deinen Sichtbarkeitseinstellungen auffindbar.“
- Firma: „Mit dem Speichern wird dein Firmenprofil öffentlich. Persönliche Kontaktdaten werden dadurch nicht automatisch freigegeben.“
- Marktplatzobjekt oder Fahrzeug mit entsprechender Berechtigung: „Mit ‚Veröffentlichen‘ wird dein Angebot öffentlich sichtbar.“ Keine erfundene Adminprüfung ankündigen.
- Location, Tierportfolio oder anderer prüfpflichtiger Typ: „Dein Inserat wurde eingereicht und wartet auf Prüfung. Nach der Freigabe ist es öffentlich sichtbar.“ Diesen Erfolg erst nach bestätigter Einreichung anzeigen.
- Privater Entwurf: „Privat gespeichert. Noch nicht veröffentlicht.“ Erst nach bestätigter dauerhafter Speicherung anzeigen.

Diese Abschlussformulierungen sind redaktionell vorbereitet. Die sechs Katalogfassungen in der Komponente betreffen den kurzen Uploadhinweis; Abschlussbuttons und Systemantworten werden erst im freigegebenen Integrationsschritt konsistent mitübersetzt.

## Herkunft der Bilder

| Tatsächliche Quelle | Öffentliche Community-Fotoauswahl | Andere passende Plattformvorschauen |
| --- | --- | --- |
| Profilfoto, Profilcover, direktes persönliches Portfolio | Ja, wenn Profil und Bild tatsächlich öffentlich sind | Nach jeweiliger Berechtigung |
| Firmenlogo, Firmencover, Firmengalerie | Ja, wenn Firma und Bild tatsächlich öffentlich sind | Nach jeweiliger Berechtigung |
| Eigenständiges Projekt und dessen Cover/Galerie | Nein | Öffentliche Projektansichten |
| Location | Nein | Freigegebene Locationansichten |
| Marktplatz einschließlich Fahrzeugen | Nein | Entsprechend dem Veröffentlichungsstatus |
| Schwarzes Brett | Nein | Entsprechend der Beitragssichtbarkeit |
| Private Datei, Entwurf, Nachricht, Supportanhang | Nein | Nur für berechtigte Betrachter |

Die Herkunft bleibt auch bei einer zusätzlichen Anzeige im Anbieterprofil bestehen. Der Hinweis ändert weder diese Zuordnung noch die Zugriffsprüfung. Logos bleiben vollständig dargestellt; die technische Verkleinerung verleiht keine zusätzlichen Rechte.

## Besondere Rechteklärung

Die bereits vorhandene Erklärung für Filmplakate und eigenständige Projektbilder bleibt ein gesonderter Ablauf. Ungeklärte Projektbilder werden nicht durch einen allgemeinen Uploadhinweis freigegeben. Umgekehrt darf diese spezielle Prüfung nicht als Pflichtformular auf normale persönliche Fotos übertragen werden.

Bei konkreten Zweifeln gezielt nachfragen, statt jedem Nutzer für jedes Foto erneut umfangreiche Rechteformulare vorzulegen. Externe Werbenutzung erst bei einer tatsächlich geplanten Kampagne anfragen.
