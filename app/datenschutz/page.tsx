import Link from "next/link";

export const metadata = {
  title: "Datenschutzerklärung — CineGenius",
  description: "Datenschutzerklärung gemäß DSGVO für CineGenius",
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

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">1. Verantwortlicher</h2>
            <p className="text-sm leading-relaxed">
              Markus Müller<br />
              Plinganserstr. 19, 81369 München<br />
              E-Mail: <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a><br />
              Tel: <a href="tel:+4901713866624" className="text-gold hover:underline">+49 171 3866624</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">2. Erhobene Daten & Zweck</h2>
            <div className="text-sm leading-relaxed space-y-3">
              <p><strong className="text-text-primary">Registrierung & Profil:</strong> Bei der Registrierung über Clerk erheben wir Name, E-Mail-Adresse und optional ein Profilbild. Diese Daten sind notwendig zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p>
              <p><strong className="text-text-primary">Inserate & Inhalte:</strong> Von dir eingestellte Inserate, Bilder und Beschreibungen werden in unserer Datenbank (Supabase, EU-Server) gespeichert.</p>
              <p><strong className="text-text-primary">Nutzungsdaten:</strong> Server-Logs mit IP-Adresse, Browsertyp und Zugriffszeit werden für max. 7 Tage gespeichert (berechtigtes Interesse gem. Art. 6 Abs. 1 lit. f DSGVO).</p>
              <p><strong className="text-text-primary">Kommunikation:</strong> Nachrichten zwischen Nutzern werden zur Ermöglichung der Plattformfunktion gespeichert.</p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">3. Drittanbieter & Auftragsverarbeitung</h2>
            <div className="text-sm leading-relaxed space-y-3">
              <p><strong className="text-text-primary">Clerk (Authentifizierung):</strong> Clerk Inc., USA. Datenübertragung in die USA auf Basis von Standardvertragsklauseln (SCC). Datenschutz: clerk.com/privacy</p>
              <p><strong className="text-text-primary">Supabase (Datenbank & Storage):</strong> Supabase Inc. — Server in der EU (Frankfurt). Datenschutz: supabase.com/privacy</p>
              <p><strong className="text-text-primary">Vercel (Hosting):</strong> Vercel Inc., USA. Datenübertragung auf Basis von SCC. Datenschutz: vercel.com/legal/privacy-policy</p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">4. Cookies & Speicherung</h2>
            <p className="text-sm leading-relaxed">
              Wir verwenden ausschließlich technisch notwendige Cookies (Session-Token für die Authentifizierung via Clerk).
              Es werden keine Tracking- oder Werbe-Cookies eingesetzt. Eine Cookie-Einwilligung ist daher nicht erforderlich.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">5. Deine Rechte</h2>
            <p className="text-sm leading-relaxed">
              Du hast gemäß DSGVO folgende Rechte:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Auskunft über gespeicherte Daten (Art. 15 DSGVO)</li>
              <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Löschung deiner Daten (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Zur Ausübung deiner Rechte wende dich an:{" "}
              <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a>
              <br /><br />
              Du hast zudem das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren.
              Zuständig für Bayern: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA),
              Promenade 27, 91522 Ansbach.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">6. Datensicherheit</h2>
            <p className="text-sm leading-relaxed">
              Alle Datenübertragungen erfolgen verschlüsselt via HTTPS/TLS. Passwörter werden nicht gespeichert —
              die Authentifizierung erfolgt ausschließlich über Clerk. Zugriff auf Datenbankdaten ist über
              Row Level Security (RLS) auf autorisierte Nutzer beschränkt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">7. Speicherdauer</h2>
            <p className="text-sm leading-relaxed">
              Profildaten und Inserate werden gespeichert, solange dein Account aktiv ist. Nach Löschung des Accounts
              werden alle personenbezogenen Daten innerhalb von 30 Tagen gelöscht, sofern keine gesetzlichen
              Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">8. Kontakt bei Datenschutzfragen</h2>
            <p className="text-sm leading-relaxed">
              Bei Fragen zum Datenschutz erreichst du uns unter:{" "}
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
