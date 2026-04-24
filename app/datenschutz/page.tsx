import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — CineGenius",
  description: "Datenschutzerklärung gemäß DSGVO für CineGenius — vollständige Informationen über Datenverarbeitung, eingesetzte Dienste und deine Rechte.",
};

export default function DatenschutzPage() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Rechtliches</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Datenschutzerklärung</h1>
          <p className="text-text-muted text-sm">Gemäß DSGVO, BDSG und TTDSG — Stand: April 2026</p>
        </div>

        <div className="space-y-10 text-text-secondary text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">1. Verantwortlicher</h2>
            <p>
              Markus Müller<br />
              Plinganserstrasse 19, 81369 München<br />
              E-Mail: <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a><br />
              Tel: <a href="tel:+4901713866624" className="text-gold hover:underline">+49 171 3866624</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">2. Überblick der eingesetzten Dienste</h2>
            <p className="mb-3">Auf CineGenius kommen folgende externe Dienste zum Einsatz, die personenbezogene Daten verarbeiten können:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-text-primary font-semibold">Dienst</th>
                    <th className="text-left py-2 pr-4 text-text-primary font-semibold">Zweck</th>
                    <th className="text-left py-2 text-text-primary font-semibold">Sitz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Clerk", "Authentifizierung / Login", "USA"],
                    ["Supabase", "Datenbank & Dateispeicher", "EU (Frankfurt)"],
                    ["Vercel", "Hosting & CDN", "USA"],
                    ["Stripe", "Zahlungsabwicklung", "USA"],
                    ["Sentry", "Fehler-Tracking", "USA"],
                    ["Resend", "Transaktions-E-Mails", "USA"],
                    ["Vercel Analytics", "Nutzungsstatistiken (cookielos)", "USA"],
                    ["Vercel Speed Insights", "Performance-Messung (cookielos)", "USA"],
                    ["OpenStreetMap Nominatim", "Geocoding von Städtenamen", "UK / EU"],
                  ].map(([d, z, s]) => (
                    <tr key={d}>
                      <td className="py-2 pr-4 font-medium text-text-primary">{d}</td>
                      <td className="py-2 pr-4">{z}</td>
                      <td className="py-2">{s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-text-muted text-xs">Alle Drittlandübertragungen (USA) erfolgen auf Basis von EU-Standardvertragsklauseln (SCC) gem. Art. 46 Abs. 2 lit. c DSGVO.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">3. Registrierung & Nutzerkonto</h2>
            <p>
              Für die Erstellung eines Kontos verarbeiten wir über <strong className="text-text-primary">Clerk Inc.</strong> deinen Namen und deine E-Mail-Adresse. Optional kannst du ein Profilbild hochladen. Die Daten werden zur Vertragserfüllung benötigt (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO). Passwörter werden von uns nicht gespeichert — die Authentifizierung läuft vollständig über Clerk.
            </p>
            <p className="mt-2">
              Clerk verarbeitet Anmeldedaten auf Servern in den USA auf Basis von Standardvertragsklauseln.<br />
              Datenschutz Clerk: <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">clerk.com/privacy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">4. Profildaten & Inserate</h2>
            <p>
              Alle von dir eingestellten Inhalte — Profildaten, Inserate, Beschreibungen, Bilder — werden in unserer Datenbank (<strong className="text-text-primary">Supabase</strong>, Server in Frankfurt/EU) gespeichert. Rechtsgrundlage ist die Vertragserfüllung (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO). Veröffentlichte Inserate und Profile sind für alle Besucher der Plattform öffentlich einsehbar.
            </p>
            <p className="mt-2">
              Datenschutz Supabase: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">supabase.com/privacy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">5. Nachrichten & Kommunikation</h2>
            <p>
              Nachrichten zwischen Nutzern werden zur Ermöglichung der Plattformfunktion in der Datenbank gespeichert (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO). Wir lesen keine privaten Nachrichten, außer zur Strafverfolgung oder bei gemeldeten Inhaltsverstoßen. Bewerbungen auf Job-Inserate werden dem ausschreibenden Unternehmen weitergegeben.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">6. Profilaufrufe</h2>
            <p>
              Wenn ein eingeloggter Nutzer ein Profil besucht, speichern wir intern, dass dieses Profil aufgerufen wurde (Zeitstempel und pseudonymisierter Bezug zum Betrachter). So können Profilinhaber sehen, wie oft ihr Profil aufgerufen wurde. Rechtsgrundlage ist das berechtigte Interesse beider Seiten an Transparenz (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO). Die Daten werden nach 90 Tagen automatisch gelöscht. Nicht eingeloggte Besucher werden nicht erfasst.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">7. Zahlungsabwicklung (Stripe)</h2>
            <p>
              Buchungen werden über <strong className="text-text-primary">Stripe Inc.</strong> (USA) abgewickelt. Bei einer Zahlung werden Zahlungsdaten direkt von Stripe entgegengenommen — wir haben zu keinem Zeitpunkt Zugriff auf vollständige Kartennummern. Stripe verarbeitet Name, E-Mail, Rechnungsadresse und Zahlungsmittelinformationen auf Basis der Vertragserfüllung (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO).<br />
              Datenschutz Stripe: <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">stripe.com/de/privacy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">8. Hosting & Infrastruktur (Vercel)</h2>
            <p>
              Die Plattform wird bei <strong className="text-text-primary">Vercel Inc.</strong> (USA) gehostet. Vercel verarbeitet Zugriffsdaten (IP-Adresse, Browsertyp, aufgerufene Seite, Datum und Uhrzeit) in Server-Logs. Rechtsgrundlage ist das berechtigte Interesse an einem sicheren und fehlerfreien Betrieb (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO). Log-Daten werden nach maximal 30 Tagen gelöscht.<br />
              Datenschutz Vercel: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">vercel.com/legal/privacy-policy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">9. Fehler-Tracking (Sentry)</h2>
            <p>
              Zur Erkennung und Behebung technischer Fehler setzen wir <strong className="text-text-primary">Sentry</strong> (Functional Software Inc., San Francisco, USA) ein. Tritt ein Fehler auf, werden technische Informationen — Fehlermeldung, Stack-Trace, Browsertyp, Betriebssystem sowie deine pseudonymisierte Nutzer-ID (kein Name, keine E-Mail) — an Sentry übermittelt. Sentry ist ausschließlich in der Produktionsumgebung aktiv.
            </p>
            <p className="mt-2">
              Session-Replay ist so konfiguriert, dass es <strong className="text-text-primary">ausschließlich bei Fehlern</strong> ausgelöst wird und dabei alle Texte automatisch unkenntlich gemacht sind (<code className="bg-bg-elevated px-1 rounded text-xs">maskAllText: true</code>). Normale Nutzungssitzungen werden nicht aufgezeichnet. Rechtsgrundlage ist das berechtigte Interesse an der Systemstabilität (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO). Fehler-Logs werden nach 90 Tagen automatisch gelöscht.<br />
              Datenschutz Sentry: <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">sentry.io/privacy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">10. E-Mail-Versand (Resend)</h2>
            <p>
              Transaktions-E-Mails (z.&nbsp;B. Buchungsbestätigungen, Benachrichtigungen, Systemmeldungen) werden über <strong className="text-text-primary">Resend Inc.</strong> (USA) versendet. Dabei wird deine E-Mail-Adresse sowie dein Name an Resend übermittelt. Wir versenden ausschließlich transaktionale Nachrichten, die zur Vertragserfüllung notwendig sind (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO). Werbe-E-Mails versenden wir nicht ohne ausdrückliche Einwilligung.<br />
              Datenschutz Resend: <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">resend.com/privacy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">11. Nutzungsstatistiken (Vercel Analytics & Speed Insights)</h2>
            <p>
              Wir nutzen <strong className="text-text-primary">Vercel Analytics</strong> und <strong className="text-text-primary">Vercel Speed Insights</strong> zur Auswertung von Seitenaufrufen und Ladezeiten. Diese Dienste arbeiten <strong className="text-text-primary">ohne Cookies und ohne persönliche Identifikatoren</strong>. IP-Adressen werden nicht gespeichert; die Daten sind vollständig aggregiert und anonymisiert. Eine Rückverfolgung auf einzelne Personen ist technisch ausgeschlossen. Rechtsgrundlage ist das berechtigte Interesse an der Verbesserung der Plattform (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).<br />
              Datenschutz Vercel Analytics: <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">vercel.com/docs/analytics/privacy-policy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">12. Geocoding (OpenStreetMap Nominatim)</h2>
            <p>
              Für die Kartenansicht bei Locations ermitteln wir geografische Koordinaten über die öffentliche <strong className="text-text-primary">Nominatim-API</strong> der OpenStreetMap Foundation (UK). Dabei werden ausschließlich Städtenamen übertragen — keine personenbezogenen Daten. Ergebnisse werden serverseitig 24 Stunden gecacht, sodass jede Stadt nur einmal angefragt wird. Rechtsgrundlage ist das berechtigte Interesse (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).<br />
              Datenschutz OpenStreetMap: <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">osmfoundation.org/wiki/Privacy_Policy</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">13. Cookies, localStorage & lokale Speicherung</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-text-primary">Technisch notwendige Cookies (Clerk):</strong> Clerk setzt Session-Cookies, die für die Authentifizierung zwingend erforderlich sind. Ohne diese Cookies ist eine Anmeldung nicht möglich. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO, § 25 Abs.&nbsp;2 Nr.&nbsp;2 TTDSG.
              </p>
              <p>
                <strong className="text-text-primary">Präferenz-Cookie:</strong> <code className="bg-bg-elevated px-1 rounded text-xs">cg_locale</code> speichert deine Sprachauswahl. Enthält keine personenbezogenen Daten. Rechtsgrundlage: § 25 Abs.&nbsp;2 Nr.&nbsp;2 TTDSG (technisch notwendig für korrekte Sprachanzeige).
              </p>
              <p>
                <strong className="text-text-primary">Lokaler Browser-Speicher (localStorage):</strong> Im Browser werden lokal gespeichert:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li><code className="bg-bg-elevated px-1 rounded text-xs">cg_recent_searches</code> — deine zuletzt eingegebenen Suchbegriffe. Verbleiben ausschließlich in deinem Browser, werden nie an unsere Server übertragen.</li>
                <li><code className="bg-bg-elevated px-1 rounded text-xs">cg_cookies_ok</code> — deine Bestätigung des Cookie-Hinweises.</li>
              </ul>
              <p>
                <strong className="text-text-primary">Keine Werbe- oder Tracking-Cookies:</strong> Wir setzen keinerlei Cookies zu Werbe-, Tracking- oder Profilierungszwecken ein.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">14. Drittlandübertragungen (USA)</h2>
            <p>
              Mehrere eingesetzte Dienste (Clerk, Vercel, Stripe, Sentry, Resend) haben ihren Sitz in den USA. Da die USA kein der EU vergleichbares Datenschutzniveau garantieren, erfolgen diese Übertragungen auf Basis von EU-Standardvertragsklauseln (SCC) gemäß Art.&nbsp;46 Abs.&nbsp;2 lit.&nbsp;c DSGVO. Die SCC-Dokumente der jeweiligen Anbieter können über deren Datenschutzseiten abgerufen werden.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">15. Speicherdauer & Löschung</h2>
            <div className="space-y-2 mt-1">
              {[
                ["Profildaten & Inserate", "Bis zur Kontolöschung; danach binnen 30 Tagen vollständig gelöscht"],
                ["Nachrichten", "Bis zur Löschung des Kontos eines der Beteiligten"],
                ["Profilaufrufe", "90 Tage (automatische Löschung)"],
                ["Server-Logs (Vercel)", "Max. 30 Tage"],
                ["Fehler-Logs (Sentry)", "90 Tage"],
                ["Buchungsdaten", "10 Jahre (§ 147 AO — gesetzliche Aufbewahrungspflicht)"],
                ["E-Mail-Versandlogs (Resend)", "30 Tage"],
              ].map(([what, when]) => (
                <div key={what} className="flex flex-col sm:flex-row gap-1 sm:gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-text-primary font-medium sm:w-52 shrink-0">{what}</span>
                  <span className="text-text-muted">{when}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">16. Datensicherheit</h2>
            <p>
              Alle Datenübertragungen sind mit HTTPS/TLS verschlüsselt. Der Zugriff auf Datenbankdaten ist durch Row Level Security (RLS) strikt auf autorisierte Nutzer beschränkt — jeder Nutzer kann ausschließlich auf die ihm erlaubten Datensätze zugreifen. Passwörter werden von uns nicht gespeichert. Administrative Zugriffe auf die Plattform sind protokolliert und auf wenige Personen beschränkt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">17. Deine Rechte (Art. 15–21 DSGVO)</h2>
            <p className="mb-3">Du hast folgende Rechte gegenüber uns als Verantwortlichem:</p>
            <ul className="space-y-2 list-disc list-inside marker:text-gold">
              <li><strong className="text-text-primary">Auskunft</strong> — Welche Daten wir über dich verarbeiten (Art. 15 DSGVO)</li>
              <li><strong className="text-text-primary">Berichtigung</strong> — Korrektur unrichtiger Daten (Art. 16 DSGVO)</li>
              <li><strong className="text-text-primary">Löschung</strong> — Deiner Daten, sofern keine Aufbewahrungspflichten entgegenstehen (Art. 17 DSGVO)</li>
              <li><strong className="text-text-primary">Einschränkung</strong> — Der Verarbeitung in bestimmten Fällen (Art. 18 DSGVO)</li>
              <li><strong className="text-text-primary">Datenübertragbarkeit</strong> — Export deiner Daten in einem gängigen Format (Art. 20 DSGVO)</li>
              <li><strong className="text-text-primary">Widerspruch</strong> — Gegen Verarbeitungen auf Basis berechtigten Interesses (Art. 21 DSGVO)</li>
              <li><strong className="text-text-primary">Widerruf</strong> — Einer Einwilligung jederzeit mit Wirkung für die Zukunft</li>
            </ul>
            <p className="mt-3">
              Konto und alle Daten löschen: <strong className="text-text-primary">Dashboard → Einstellungen → Konto löschen.</strong><br />
              Alle anderen Anfragen an: <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a>
            </p>
            <p className="mt-3">
              Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Zuständig für Bayern:<br />
              <strong className="text-text-primary">Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)</strong><br />
              Promenade 27, 91522 Ansbach —{" "}
              <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">lda.bayern.de</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">18. Minderjährige</h2>
            <p>
              CineGenius richtet sich ausschließlich an Personen ab 18 Jahren. Wir erheben wissentlich keine Daten von Minderjährigen. Solltest du Kenntnis davon haben, dass ein Minderjähriger ein Konto erstellt hat, melde dies bitte unter <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">19. Änderungen dieser Datenschutzerklärung</h2>
            <p>
              Wir behalten uns vor, diese Erklärung bei Änderungen an der Plattform oder neuen gesetzlichen Anforderungen zu aktualisieren. Die jeweils aktuelle Version ist unter <strong className="text-text-primary">cinegenius.co/datenschutz</strong> abrufbar. Bei wesentlichen Änderungen informieren wir registrierte Nutzer per E-Mail.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">20. Kontakt bei Datenschutzfragen</h2>
            <p>
              Markus Müller<br />
              Plinganserstrasse 19, 81369 München<br />
              <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-6">
          <Link href="/impressum" className="text-sm text-gold hover:underline">Impressum →</Link>
          <Link href="/agb" className="text-sm text-gold hover:underline">AGB →</Link>
        </div>

      </div>
    </div>
  );
}
