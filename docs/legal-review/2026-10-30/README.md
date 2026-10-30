# CineGenius Rechtstexte zur Prüfung

Stand der Bestandsprüfung: 30. Oktober 2026. **Entwurf, nicht veröffentlicht.** Die geltenden Rechtstextseiten, Registrierung und Veröffentlichungsregeln wurden nicht umgestellt. Die kurzen, nicht zustimmungspflichtigen Uploadhinweise wurden anschließend zur Veröffentlichung freigegeben; ihr gesonderter Integrationsstand steht im [Releasebericht](../../test-reports/upload-notices-2026-10-30.md). Die abschließende rechtliche Prüfung und die unten genannten technischen Nachweise stehen vor einer Veröffentlichung aus.

Die Bedienung bleibt einfach: Ein kurzer Hinweis im bestehenden Uploadbereich erklärt Rechte und Sichtbarkeit. Details lassen sich aufklappen. Für normale Profil-, Firmen- und Angebotsfotos entstehen weder ein zusätzliches Pflichtfeld noch eine neue Bestätigungsseite. Externe Werbung erhält keine pauschale Erlaubnis aus einem Upload.

## Die vorbereiteten Unterlagen

- [Vollständiger deutscher AGB Entwurf](agb-entwurf.md)
- [Kurze Hinweise für Upload und Veröffentlichung](uploadhinweise.md)
- [Vorlage für eine konkrete externe Marketingfreigabe](marketingfreigabe-entwurf.md)
- [Datenschutz und notwendige technische Anpassungen](datenschutz-und-technik.md)
- [Umstellung bestehender Konten und offene Entscheidungen](umstellung-und-offene-fragen.md)
- [Amtliche Quellen und Zuordnung](quellen.md)
- [Prüfergebnisse und Grenzen](pruefung.md)

## Gefundene Lücken und Widersprüche

„Bestätigt“ bedeutet hier im Repository nachvollzogen, nicht durch einen Eingriff in ein Nutzerkonto getestet. Laufende Dienstleisterkonfigurationen, Vertragsunterlagen und Produktionsprotokolle sind damit nicht vollständig geprüft.

| Priorität | Befund | Fundstelle | Vorbereitung |
| --- | --- | --- | --- |
| Hoch | Das Uploadrecht umfasst bisher zeitlich unbeschränkte Nutzung und Marketingmaterialien, endet im nächsten Satz aber bei Löschung. Zweck, externe Kanäle und Rechte Dritter bleiben zu unbestimmt. | `app/agb/page.tsx`, § 4 | Zweckgebundene Betriebslizenz; getrennte konkrete Marketingfreigabe. |
| Hoch | Die AGB verbieten die Umgehung einer Plattformprovision, obwohl die aktuelle Nutzung kostenlos und `platform_fee` im Anfrageweg null ist. | AGB § 4/5; `app/api/bookings/route.ts` | Provisionsklausel entfernen; keine fiktiven Gebühren einführen. |
| Hoch | Die Buchungsseite bezeichnet einen Anfrageschritt als Zahlung und zeigt auch bei einer abgelehnten API-Antwort eine scheinbare Bestätigung mit erzeugter Referenz. | `app/booking/checkout/page.tsx`, `app/api/bookings/route.ts` | Separater Reparaturauftrag vor Freigabe: Erfolg nur nach gespeicherter Anfrage, kein Zahlungsversprechen. |
| Hoch | Kontolöschung wartet auf `allSettled`, wertet Teilergebnisse aber nicht aus; danach wird das Clerk-Konto gelöscht und Erfolg gemeldet. Neue Inhaltsbereiche und Dateien sind nicht vollständig explizit erfasst. Cascades sind gesondert zu prüfen. Die zugesagte Komplettlöschung binnen 30 Tagen ist dadurch nicht nachgewiesen. | `app/api/account/route.ts`; AGB § 12 | Löschinventar, überprüfte Abhängigkeiten, Fehlerbehandlung und Wiederholungsauftrag vorbereiten; keine Testlöschung echter Konten. |
| Hoch | Sentry Replay ist für Fehlerfälle konfiguriert, ohne Anbindung an eine Einwilligung; Medien sind nicht pauschal blockiert. Der Cookie-Hinweis bestätigt nur einen Text. | `sentry.client.config.ts`, `components/CookieBanner.tsx` | Einfachste vorgeschlagene Lösung: optionale Sitzungsaufzeichnung deaktivieren; technische Fehlerdiagnose getrennt prüfen. Noch nicht geändert. |
| Hoch | Die Zustimmung wird nur bei entsprechendem Clerk-Pflichtfeld abgefragt. Ein eigener belastbarer Bezug zu einer bestimmten AGB-Fassung ist im geprüften Anwendungspfad nicht belegt. Datenschutzinformation und Vertrag werden sprachlich vermischt. | `components/AuthForm.tsx`, `legal_accepted` | Providerkonfiguration prüfen, Fassung und Zeitpunkt bei tatsächlich nötiger Zustimmung nachvollziehbar erfassen. Keine rückwirkenden Datensätze. |
| Hoch | Der vorgesehene Adminweg erlaubt ausdrücklich die Freigabe eines noch nicht eingereichten privaten Angebotsentwurfs. Eine technische Adminberechtigung belegt aber nicht die Veröffentlichungsabsicht des Anbieters oder dessen Nutzungsrechtseinräumung für diese Veröffentlichung. | `AGENTS.md`, Regel zur Adminprüfung; `20261029020000_admin_review_discretion.sql` | Vor diesem Sonderfall die konkrete Veröffentlichungsgrundlage klären. Normales ausdrückliches Einreichen darf weiter der einfache Regelweg sein. Keine alten Entwürfe automatisch veröffentlichen und keine neue Zustimmung fingieren. |
| Hoch | Das interne Meldeformular verlangt Anmeldung und unterstützt nur Nutzer, Inserate und Bewertungen. Ein vollständiger öffentlich nutzbarer Melde- und Entscheidungsweg für alle relevanten Inhalte ist damit nicht belegt. | `app/api/reports/route.ts`; `/bildrechte` | Der vorhandene öffentliche E-Mail-Kontakt bleibt nutzbar. Ein leicht erreichbarer, angemessen abgesicherter Meldeweg und Entscheidungsmitteilungen sind vor rechtlichen Zusagen fertigzustellen. |
| Mittel | „Vollständig“ wird in den AGB pauschal verlangt, obwohl Fotos und viele Angaben freiwillig sind und private Entwürfe vorgesehen sind. | AGB § 4; `AGENTS.md` | Notwendige zutreffende Angaben von freiwilligen Ergänzungen trennen. |
| Mittel | Die AGB beschränken Darsteller in FSK-16/18-Produktionen pauschal auf Volljährige. Die Zuschauer-Altersfreigabe ersetzt keine Prüfung der tatsächlich geltenden Regeln für Mitwirkende. | AGB § 4a | Keine erfundene generelle FSK-Darstellerregel. Konten bleiben ab 18; Beschäftigung, Jugendschutz und nötige Erlaubnisse getrennt behandeln. |
| Mittel | Sperrung, Löschen und redaktionelles Ändern sind sehr weit gefasst; ein garantiertes Einspruchsergebnis binnen 14 Werktagen ist technisch nicht belegt. | AGB § 3/13 | Verhältnismäßige Maßnahmen, konkrete Gründe, erreichbare Überprüfung; keine unbelegte Fristgarantie. |
| Mittel | Schweigen soll wesentliche AGB-Änderungen akzeptieren. Neue Rechte an alten Bildern lassen sich daraus nicht pauschal ableiten. | AGB § 15 | Keine pauschale Zustimmungsfiktion; gezielte Umstellung nach rechtlicher Freigabe. |
| Mittel | Datenschutztext erklärt alle Resend-Mails als vertraglich notwendig, Analytics als vollständig anonym und lokale Suchbegriffe als niemals übertragen. Diese Aussagen sind zu weit. | `app/datenschutz/page.tsx`, Abschnitte 14–16 | Zweck, Rechtsgrundlage, tatsächliche Datenübermittlung und Aufbewahrung einzeln beschreiben. |
| Mittel | Auswahl-, Ranking- und Bewertungsregeln sind vorhanden, aber nicht ausreichend zusammenhängend erläutert. | `lib/community-media-server.ts`, `lib/rating-ranking.ts`, `lib/review-eligibility.ts` | Sachliche Erklärung; bestätigte Plattforminteraktion nicht als geprüfter Kauf oder tatsächliche Leistung ausgeben. |
| Klärung | DSA, P2B und Verbraucherpflichten hängen von Funktion, Nutzerkreis und Unternehmensgröße ab. „Nur Kontaktplattform“ und „kostenlos“ schließen sie nicht automatisch aus. | Tatsächliche Vermittlungs- und Uploadfunktionen | Einordnung durch Rechtsberatung vor endgültiger Fassung; keine pauschale Ausnahme behaupten. |

## Was weiterhin funktioniert und erhalten bleibt

Die Impressumsanschrift und die Kontaktadresse `cinegenius.co@gmail.com` entsprechen den zuletzt bestätigten Betreiberangaben. Es wurde kein Unternehmensregistereintrag und keine Umsatzsteuer- oder Wirtschafts-ID erfunden.

Die Community-Fotoauswahl hat bereits eine zentrale Erlaubnisliste für persönliche Profile und Firmen. Die vorbereiteten Hinweise beschreiben diese Regel, erweitern sie aber nicht. Projekt-, Location-, Marktplatz- und Brettbilder werden dadurch nicht für „Frische Einblicke“ freigegeben. Fotos bleiben optional; gespeicherte Sichtbarkeit und die tatsächliche Medienherkunft entscheiden über den Zugriff.

Öffentliche Firmenfunktionen bleiben von Verwaltungsrechten getrennt. Teamzugehörigkeiten benötigen die Bestätigung der anderen Seite. Die unterschiedlichen Veröffentlichungsregeln für Marktplatz, Locations, Tierportfolios, Firmen und Personenprofile bleiben bestehen.

## Freigabe vor Veröffentlichung

Zuerst die AGB und Datenschutzanpassungen rechtlich abstimmen, insbesondere P2B/DSA und Verbraucherrechte. Danach die tatsächlichen Abläufe für Meldungen, Löschung und Anfragebestätigung mit eigenen Konten nachweisen. Erst anschließend eine datierte Fassung veröffentlichen und gegebenenfalls eine erforderliche einmalige Zustimmung einholen. Alte Bilder, Konten oder Zustimmungshistorien werden nicht pauschal umgeschrieben.
