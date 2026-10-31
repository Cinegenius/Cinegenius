import {getTranslations} from "next-intl/server";
import Link from "next/link";

export const metadata = {
  title: "AGB — CineGenius",
  description: "Allgemeine Geschäftsbedingungen von CineGenius",
};

export default async function AgbPage() {
  const t = await getTranslations("LegalAuditOriginal");
  return (
    <div className="pt-16 min-h-screen min-w-0 bg-bg-primary [overflow-wrap:anywhere]">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Rechtliches</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Allgemeine Geschäftsbedingungen</h1>
          <p className="text-text-muted text-sm">{t("termsDate")}</p>
        </div>

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 1 Geltungsbereich</h2>
            <p className="text-sm leading-relaxed">
              {t("scope")}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 2 Leistungsbeschreibung</h2>
            <p className="text-sm leading-relaxed">
              CineGenius ist ein Online-Marktplatz für die Film-, Foto- und Medienbranche. Die Plattform
              ermöglicht registrierten Nutzern das Inserieren und Finden von:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Drehlocations und Außengeländen</li>
              <li>Film- und Spezialfahrzeugen</li>
              <li>Requisiten, Ausstattung und Custom-Anfertigung</li>
              <li>Film Jobs und Produktionsausschreibungen</li>
              <li>Crew-Profilen und Talenten</li>
              <li>Tieren für Filmproduktionen</li>
              <li>Unternehmensprofilen der Film- und Medienbranche</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber stellt lediglich die technische Infrastruktur zur Verfügung und ist nicht
              Vertragspartei der zwischen Nutzern geschlossenen Verträge. Ein Anspruch auf jederzeitige
              Verfügbarkeit der Plattform besteht nicht; der Betreiber ist berechtigt, den Betrieb aus
              technischen oder betrieblichen Gründen vorübergehend einzuschränken.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 3 Registrierung & Account</h2>
            <p className="text-sm leading-relaxed">
              Die Nutzung der Plattform in vollem Umfang erfordert eine Registrierung. Es gelten
              folgende Pflichten:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Die Registrierung ist ausschließlich Personen ab 18 Jahren gestattet.</li>
              <li>Du bist verpflichtet, bei der Registrierung und im Profil wahrheitsgemäße und vollständige Angaben zu machen.</li>
              <li>Jede natürliche oder juristische Person darf nur einen Account betreiben. Mehrfachaccounts sind verboten.</li>
              <li>Du bist verpflichtet, deine Zugangsdaten vertraulich zu behandeln und vor unbefugtem Zugriff Dritter zu schützen.</li>
              <li>Änderungen deiner Daten sind umgehend in den Accounteinstellungen zu aktualisieren.</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber behält sich das Recht vor, Accounts bei begründetem Verdacht auf Verstöße
              gegen diese AGB oder gesetzliche Vorschriften ohne Vorankündigung zu sperren oder dauerhaft
              zu löschen. Ein Anspruch auf Registrierung oder Aufrechterhaltung eines Accounts besteht nicht.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 4 Inserate & Nutzerpflichten</h2>
            <p className="text-sm leading-relaxed">
              Du bist für alle von dir auf der Plattform eingestellten Inhalte allein verantwortlich.
              Folgende Inhalte und Verhaltensweisen sind ausdrücklich verboten:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Falsche, irreführende oder unvollständige Angaben in Inseraten oder Profilen</li>
              <li>Rechtswidrige, beleidigende, diskriminierende oder hasserfüllte Inhalte</li>
              <li>Verwendung urheberrechtlich geschützten Materials ohne ausdrückliche Erlaubnis</li>
              <li>Spam, automatisierte Masseneintragungen oder Scraping</li>
              <li>Umgehung von Sicherheitsmechanismen oder missbräuchliche Nutzung der API</li>
              <li>Veröffentlichung personenbezogener Daten Dritter ohne deren Einwilligung</li>
              <li>Inserate, die nicht der tatsächlich angebotenen Leistung entsprechen</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Mit dem Einstellen von Inhalten räumst du dem Betreiber ein nicht-exklusives, unentgeltliches,
              zeitlich unbeschränktes Nutzungsrecht zur Darstellung, Verbreitung und Vervielfältigung auf der
              Plattform sowie in zugehörigen Marketingmaterialien ein. Das Nutzungsrecht erlischt mit der
              Löschung des betreffenden Inhalts durch dich, sofern keine gesetzlichen Aufbewahrungspflichten
              entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 4a FSK & jugendschutzrelevante Inhalte</h2>
            <p className="text-sm leading-relaxed">
              CineGenius wird für professionelle Film-, Foto- und Medienproduktionen genutzt, die auch
              Inhalte mit Altersfreigabe (FSK 16 / FSK 18) umfassen können. Für solche Produktionen
              gelten folgende Regeln:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Bei Produktionen mit FSK-16- oder FSK-18-Inhalt sind ausschließlich volljährige Darsteller einzusetzen. Der Auftraggeber ist für die Einhaltung verantwortlich.</li>
              <li>Gewalt- oder Intimszenen dürfen ausschließlich im Rahmen professioneller, einvernehmlicher Filmproduktionen ausgeschrieben werden.</li>
              <li>Die Ausschreibung von Inhalten, die unter § 131 StGB (Gewaltdarstellung) oder § 184 StGB (Verbreitung pornografischer Schriften) fallen, ist verboten.</li>
              <li>Kinderdarsteller (unter 18 Jahren) dürfen nicht für Produktionen mit jugendgefährdenden Inhalten gebucht oder vermittelt werden.</li>
              <li>Inserate für Produktionen mit expliziten Inhalten müssen als solche gekennzeichnet werden.</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber kooperiert mit Behörden bei Verdacht auf strafbare Handlungen und ist
              berechtigt, entsprechende Inhalte unverzüglich zu entfernen und betroffene Accounts zu sperren.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 5 Kosten der Plattformnutzung</h2>
            <p className="text-sm leading-relaxed mt-3">Registrierung, Profilerstellung, Suche, Inserate und Plattformnachrichten sind derzeit kostenlos. Entgelte für angebotene Dienstleistungen, Vermietungen oder Verkäufe werden zwischen den beteiligten Nutzern vereinbart und sind keine Gebühr für die Plattformnutzung.</p>
            <p className="text-sm leading-relaxed mt-3">Eine Anfrage oder Kontaktaufnahme ist noch keine automatische Buchungsbestätigung und löst keine automatische Zahlung aus. Verfügbarkeit, Leistungsumfang, Preis, Zahlungsweise und Übergabe sind mit dem jeweiligen Anbieter zu klären.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 6 Änderungen des Leistungsangebots</h2>
            <p className="text-sm leading-relaxed mt-3">Sollten künftig kostenpflichtige Plattformleistungen angeboten werden, müssen Leistung und Preis vor einer kostenpflichtigen Beauftragung erkennbar sein. Eine kostenpflichtige Beauftragung wird nicht allein durch eine Anfrage oder die weitere Nutzung kostenloser Funktionen ausgelöst.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 7 Gesetzliche Verbraucherrechte</h2>
            <p className="text-sm leading-relaxed mt-3">Ob für einen Vertrag zwischen Nutzern ein gesetzliches Widerrufsrecht besteht, richtet sich insbesondere nach den beteiligten Vertragsparteien, der vereinbarten Leistung und den gesetzlichen Vorschriften. Anbieter sind für die gegebenenfalls erforderlichen Verbraucherinformationen verantwortlich.</p>
            <p className="text-sm leading-relaxed mt-3">Mit einer Anfrage auf CineGenius wird kein pauschaler Verzicht auf ein gesetzliches Widerrufsrecht erklärt. Gesetzliche Rechte bleiben unberührt.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 8 Terminänderungen, Stornierung und Erstattungen</h2>
            <p className="text-sm leading-relaxed mt-3">Terminänderungen, Stornierungsbedingungen, Kautionen und mögliche Erstattungen sind vor Vertragsschluss zwischen Anbieter und Nachfrager zu klären. Es gelten ihre wirksamen Vereinbarungen und die gesetzlichen Vorschriften.</p>
            <p className="text-sm leading-relaxed mt-3">CineGenius verspricht keine allgemeinen automatischen Erstattungen, keine Treuhandverwahrung und keine Auszahlung zu festen Zeitpunkten. Ein Plattformhinweis ersetzt keine konkrete Vereinbarung der Vertragsparteien.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 9 Vertragsabschluss zwischen Nutzern</h2>
            <p className="text-sm leading-relaxed">
              Verträge über Dienstleistungen, Vermietungen, Buchungen oder sonstige Leistungen kommen
              ausschließlich zwischen den beteiligten Nutzern (Anbieter und Nachfrager) zustande.
              Der Betreiber ist kein Vertragspartner und übernimmt keine Haftung für die Erfüllung,
              Qualität oder Rechtmäßigkeit dieser Verträge.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Anbieter ist verpflichtet, seine Leistungen so zu beschreiben, dass Nachfrager eine
              informierte Entscheidung treffen können. Wesentliche Eigenschaften, Einschränkungen und
              Verfügbarkeiten sind wahrheitsgemäß anzugeben. Der Anbieter steht für die Richtigkeit
              seiner Angaben ein.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 10 Haftung für Set- und Drehschäden</h2>
            <p className="text-sm leading-relaxed">
              Der Betreiber übernimmt keine Haftung für Schäden, die im Rahmen von über die Plattform
              vermittelten Buchungen oder Produktionen entstehen, insbesondere:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Sachschäden an gemieteten Locations, Fahrzeugen oder Requisiten</li>
              <li>Personenschäden, die Dritten oder den beteiligten Nutzern entstehen</li>
              <li>Schäden durch fehlerhafte oder unvollständige Angaben im Inserat</li>
              <li>Ausfälle oder Verzögerungen im Produktionsablauf</li>
              <li>Schäden durch nicht ordnungsgemäß gesicherte Sets oder Requisiten</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Anbieter und Nachfrager sind eigenverantwortlich für den Abschluss angemessener
              Versicherungen (z. B. Drehschutzversicherung, Haftpflichtversicherung für Drehs)
              vor Beginn einer Produktion. Der Betreiber empfiehlt ausdrücklich, eine
              Produktionshaftpflichtversicherung abzuschließen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 11 Haftungsbeschränkung des Betreibers</h2>
            <p className="text-sm leading-relaxed">
              Der Betreiber haftet nicht für die Richtigkeit, Vollständigkeit und Aktualität der von
              Nutzern eingestellten Inhalte. Die Haftung des Betreibers ist auf Vorsatz und grobe
              Fahrlässigkeit beschränkt. Bei leicht fahrlässiger Verletzung von Kardinalpflichten
              (wesentliche Vertragspflichten) haftet der Betreiber nur bis zur Höhe des vorhersehbaren,
              vertragstypischen Schadens.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Die vorstehenden Haftungsbeschränkungen gelten nicht bei schuldhafter Verletzung des
              Lebens, des Körpers oder der Gesundheit, bei Ansprüchen nach dem Produkthaftungsgesetz
              sowie bei arglistiger Täuschung.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber übernimmt keine Gewähr für die jederzeitige Erreichbarkeit der Plattform.
              Geplante Wartungsarbeiten werden, soweit möglich, vorab angekündigt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 12 Kündigung & Löschung</h2>
            <p className="text-sm leading-relaxed">
              Du kannst deinen Account jederzeit ohne Angabe von Gründen löschen. Die Löschung erfolgt
              über die Accounteinstellungen oder per schriftlicher Anfrage an{" "}
              <a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">
                cinegenius.co@gmail.com
              </a>
              . Nach der Löschung werden deine personenbezogenen Daten innerhalb von 30 Tagen gelöscht,
              sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (z. B. steuerrechtliche
              Aufbewahrungspflichten nach § 147 AO von bis zu 10 Jahren).
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber ist berechtigt, Accounts bei schwerwiegenden oder wiederholten Verstößen
              gegen diese AGB fristlos zu sperren oder dauerhaft zu löschen. Im Fall einer Sperrung
              bleiben die Rechte und Pflichten aus Vereinbarungen zwischen Nutzern unberührt.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber kann die Plattform mit einer Ankündigungsfrist von 30 Tagen einstellen.
              Die Rechte aus bereits geschlossenen Verträgen zwischen Nutzern bleiben hiervon unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 13 Sperrung & Moderation</h2>
            <p className="text-sm leading-relaxed">
              Der Betreiber behält sich vor, Inhalte zu prüfen, zu bearbeiten oder zu entfernen,
              die gegen diese AGB oder geltendes Recht verstoßen. Inserate können ohne Vorankündigung
              entfernt werden, wenn sie:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Gegen § 4 oder § 4a dieser AGB verstoßen</li>
              <li>Falsche oder irreführende Angaben enthalten</li>
              <li>Mehrfach von anderen Nutzern gemeldet wurden und eine Prüfung Verstöße ergibt</li>
              <li>Nicht der ausgeschriebenen Kategorie entsprechen</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              Nutzer können gegen Moderationsentscheidungen per E-Mail Einspruch erheben.
              Der Betreiber bearbeitet Einsprüche innerhalb von 14 Werktagen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 14 Verbraucherstreitbeilegung</h2>
            <p className="text-sm leading-relaxed mt-3">Der Betreiber ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG). Bei Fragen oder Beschwerden ist der Betreiber unter cinegenius.co@gmail.com erreichbar. Der ordentliche Rechtsweg bleibt unberührt.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 15 Änderungen der AGB</h2>
            <p className="text-sm leading-relaxed">
              Der Betreiber behält sich vor, diese AGB jederzeit mit Wirkung für die Zukunft zu ändern.
              Über wesentliche Änderungen werden registrierte Nutzer per E-Mail mindestens 30 Tage vor
              Inkrafttreten der neuen AGB informiert. Widersprichst du den geänderten AGB nicht innerhalb
              von 30 Tagen nach Zugang der Änderungsmitteilung, gelten die neuen AGB als akzeptiert.
              Auf das Widerspruchsrecht und die Folgen des Ausbleibens eines Widerspruchs wird in der
              Änderungsmitteilung ausdrücklich hingewiesen.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Im Fall eines Widerspruchs ist der Betreiber berechtigt, das Vertragsverhältnis zum
              Zeitpunkt des Inkrafttretens der neuen AGB zu beenden.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 16 Anwendbares Recht & Gerichtsstand</h2>
            <p className="text-sm leading-relaxed">
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts
              (CISG). Gerichtsstand für Streitigkeiten mit Kaufleuten, juristischen Personen des
              öffentlichen Rechts oder öffentlich-rechtlichen Sondervermögen ist München.
              Für Streitigkeiten mit Verbrauchern gilt der gesetzliche Gerichtsstand.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies
              die Wirksamkeit der übrigen Bestimmungen nicht. Die unwirksame Bestimmung gilt als durch
              eine wirksame ersetzt, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung
              am nächsten kommt (salvatorische Klausel).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 17 Kontakt</h2>
            <p className="text-sm leading-relaxed">
              Bei Fragen zu diesen AGB, zur Plattform oder für rechtliche Anfragen wende dich an:
            </p>
            <div className="mt-3 text-sm leading-relaxed bg-bg-elevated rounded-lg p-4 space-y-1">
              <p className="font-medium text-text-primary">CineGenius — Markus Müller</p>
              <p>Plinganserstr. 19, 81369 München</p>
              <p>
                E-Mail:{" "}
                <a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">
                  cinegenius.co@gmail.com
                </a>
              </p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-6">
          <Link href="/impressum" className="text-sm text-gold hover:underline">Impressum →</Link>
          <Link href="/datenschutz" className="text-sm text-gold hover:underline">Datenschutzerklärung →</Link>
        </div>

      </div>
    </div>
  );
}
