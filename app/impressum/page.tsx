import Link from "next/link";

export const metadata = {
  title: "Impressum — CineGenius",
  description: "Impressum und Anbieterkennzeichnung gemäß § 5 TMG",
};

export default function ImpressumPage() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Rechtliches</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Impressum</h1>
          <p className="text-text-muted text-sm">Angaben gemäß § 5 TMG</p>
        </div>

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Anbieter</h2>
            <p className="text-sm leading-relaxed">
              Markus Müller<br />
              Plinganserstrasse 19<br />
              81369 München<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Kontakt</h2>
            <p className="text-sm leading-relaxed">
              Telefon: <a href="tel:+4901713866624" className="text-gold hover:underline">+49 171 3866624</a><br />
              E-Mail: <a href="mailto:m.mller.business@gmail.com" className="text-gold hover:underline">m.mller.business@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</h2>
            <p className="text-sm leading-relaxed">
              Markus Müller<br />
              Plinganserstrasse 19<br />
              81369 München
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Online-Streitbeilegung</h2>
            <p className="text-sm leading-relaxed">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
              <br /><br />
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Haftung für Inhalte</h2>
            <p className="text-sm leading-relaxed">
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den
              allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
              zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder
              Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Haftung für Links</h2>
            <p className="text-sm leading-relaxed">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
              Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
              verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
              Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
              Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">Urheberrecht</h2>
            <p className="text-sm leading-relaxed">
              Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
              Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
              Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
              Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-6">
          <Link href="/datenschutz" className="text-sm text-gold hover:underline">Datenschutzerklärung →</Link>
          <Link href="/agb" className="text-sm text-gold hover:underline">AGB →</Link>
        </div>

      </div>
    </div>
  );
}
