import Link from "next/link";

export const metadata = {
  title: "AGB — CineGenius",
  description: "Allgemeine Geschäftsbedingungen von CineGenius",
};

export default function AgbPage() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Rechtliches</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Allgemeine Geschäftsbedingungen</h1>
          <p className="text-text-muted text-sm">Stand: April 2026</p>
        </div>

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 1 Geltungsbereich</h2>
            <p className="text-sm leading-relaxed">
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform CineGenius, betrieben von
              Markus Müller, Plinganserstr. 19, 81369 München (nachfolgend „Betreiber").
              Mit der Registrierung akzeptierst du diese AGB.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 2 Leistungsbeschreibung</h2>
            <p className="text-sm leading-relaxed">
              CineGenius ist ein Online-Marktplatz für die Film- und Medienbranche. Die Plattform ermöglicht das
              Inserieren und Finden von Locations, Crew, Equipment, Fahrzeugen, Requisiten und Jobs.
              Der Betreiber ist nicht Vertragspartei der zwischen Nutzern geschlossenen Verträge.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 3 Registrierung & Account</h2>
            <p className="text-sm leading-relaxed">
              Die Nutzung der Plattform erfordert eine Registrierung. Du bist verpflichtet, wahrheitsgemäße Angaben
              zu machen und deine Zugangsdaten vertraulich zu behandeln. Die Registrierung ist ab 18 Jahren möglich.
              Der Betreiber behält sich vor, Accounts ohne Angabe von Gründen zu sperren oder zu löschen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 4 Inserate & Inhalte</h2>
            <p className="text-sm leading-relaxed">
              Du bist für die von dir eingestellten Inhalte selbst verantwortlich. Es ist verboten:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Falsche oder irreführende Angaben zu machen</li>
              <li>Rechtswidrige, beleidigende oder diskriminierende Inhalte einzustellen</li>
              <li>Urheberrechtlich geschütztes Material ohne Erlaubnis zu verwenden</li>
              <li>Spam oder automatisierte Masseneintragungen vorzunehmen</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Mit dem Einstellen von Inhalten räumst du dem Betreiber ein nicht-exklusives, kostenloses Nutzungsrecht
              zur Darstellung auf der Plattform ein.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 5 Vertragsabschluss zwischen Nutzern</h2>
            <p className="text-sm leading-relaxed">
              Verträge über Dienstleistungen, Vermietungen oder sonstige Leistungen kommen ausschließlich zwischen
              den beteiligten Nutzern zustande. Der Betreiber ist kein Vertragspartner und übernimmt keine Haftung
              für die Erfüllung dieser Verträge.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 6 Haftungsbeschränkung</h2>
            <p className="text-sm leading-relaxed">
              Der Betreiber haftet nicht für die Richtigkeit, Vollständigkeit und Aktualität der von Nutzern
              eingestellten Inhalte. Der Betreiber haftet nicht für Schäden, die durch die Nutzung der Plattform
              entstehen, außer bei Vorsatz oder grober Fahrlässigkeit des Betreibers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 7 Kündigung & Löschung</h2>
            <p className="text-sm leading-relaxed">
              Du kannst deinen Account jederzeit löschen. Nach der Löschung werden deine Daten innerhalb von
              30 Tagen gelöscht. Der Betreiber kann Accounts bei Verstößen gegen diese AGB jederzeit sperren.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 8 Änderungen der AGB</h2>
            <p className="text-sm leading-relaxed">
              Der Betreiber behält sich vor, diese AGB jederzeit zu ändern. Über wesentliche Änderungen werden
              registrierte Nutzer per E-Mail informiert. Die weitere Nutzung der Plattform gilt als Zustimmung
              zu den geänderten AGB.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 9 Anwendbares Recht & Gerichtsstand</h2>
            <p className="text-sm leading-relaxed">
              Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.
              Gerichtsstand für Streitigkeiten mit Kaufleuten oder juristischen Personen ist München.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 10 Kontakt</h2>
            <p className="text-sm leading-relaxed">
              Bei Fragen zu diesen AGB wende dich an:{" "}
              <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">
                m.mller.business@gmail.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-6">
          <Link href="/impressum" className="text-sm text-gold hover:underline">Impressum →</Link>
          <Link href="/datenschutz" className="text-sm text-gold hover:underline">Datenschutzerklärung →</Link>
        </div>

      </div>
    </div>
  );
}
