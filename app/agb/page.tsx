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
          <p className="text-text-muted text-sm">Stand: Mai 2026</p>
        </div>

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 1 Geltungsbereich</h2>
            <p className="text-sm leading-relaxed">
              Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB") gelten für die Nutzung der
              Online-Plattform CineGenius unter der Domain cinegenius.co, betrieben von Markus Müller,
              Plinganserstr. 19, 81369 München (nachfolgend „Betreiber"). Mit der Registrierung oder
              der erstmaligen Nutzung der Plattform erkennst du diese AGB in ihrer jeweils gültigen
              Fassung an. Abweichende Bedingungen der Nutzer gelten nicht, es sei denn, der Betreiber
              stimmt ihrer Geltung ausdrücklich schriftlich zu.
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
              <li>Direktkontakt-Verlagerung zur Umgehung der Plattformprovision</li>
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
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 5 Zahlungsbedingungen & Gebühren</h2>
            <p className="text-sm leading-relaxed">
              Die Nutzung der Grundfunktionen von CineGenius (Profil anlegen, Inserate einstellen,
              Nachrichten senden) ist kostenfrei. Für Premium-Funktionen und die Abwicklung von Buchungen
              über die Plattform können Gebühren anfallen, die jeweils transparent vor Abschluss
              ausgewiesen werden.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Zahlungen werden über den Zahlungsdienstleister Stripe, Inc. (USA) abgewickelt. Es gelten
              ergänzend die Nutzungsbedingungen von Stripe. Mit der Zahlung beauftragst du Stripe als
              Zahlungsagenten; der Betreiber erhält erst nach erfolgreicher Transaktion Kenntnis.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer, soweit anwendbar.
              Rechnungen werden per E-Mail oder als Download im Account bereitgestellt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 6 Servicegebühren</h2>
            <p className="text-sm leading-relaxed">
              Die Nutzung der Plattform — einschließlich Registrierung, Profilerstellung, Inseratsschaltung
              und Suche — ist derzeit kostenlos. Der Betreiber behält sich vor, zukünftig Servicegebühren
              einzuführen. Nutzer werden über Änderungen der Gebührenstruktur mindestens 30 Tage im Voraus
              per E-Mail informiert.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Eine Umgehung etwaiger zukünftiger Gebühren durch Direktkontakt oder außerhalb der Plattform
              abgewickelte Buchungen, die über die Plattform angebahnt wurden, ist verboten und
              berechtigt den Betreiber zur Sperrung des Accounts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 7 Widerrufsrecht</h2>
            <p className="text-sm leading-relaxed">
              Für Verbraucher (§ 13 BGB) gilt grundsätzlich ein gesetzliches Widerrufsrecht von
              14 Tagen nach Vertragsschluss gemäß §§ 312 ff. BGB.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              <strong className="text-text-primary">Ausschluss des Widerrufsrechts:</strong> Das Widerrufsrecht erlischt bei digitalen
              Dienstleistungen, die auf ausdrücklichen Wunsch des Nutzers vor Ablauf der Widerrufsfrist
              vollständig erbracht werden, wenn der Nutzer vor Beginn der Ausführung ausdrücklich
              zugestimmt hat, dass sein Widerrufsrecht mit Beginn der Vertragsausführung erlischt
              (§ 356 Abs. 5 BGB). Durch Bestätigung der Buchung erklärt der Nutzer diese Zustimmung.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Für Buchungen von Locations, Fahrzeugen oder Requisiten, die als Dienstleistungsverträge
              für einen bestimmten Zeitraum geschlossen werden, besteht gemäß § 312g Abs. 2 Nr. 9 BGB
              kein Widerrufsrecht, wenn im Vertrag ein spezifischer Termin oder Zeitraum zur Erbringung
              der Dienstleistung vereinbart ist.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              <strong className="text-text-primary">Widerrufserklärung:</strong> Den Widerruf kannst du per E-Mail an{" "}
              <a href="mailto:support@cinegenius.co" className="text-gold hover:underline">
                support@cinegenius.co
              </a>{" "}
              oder per Post (Markus Müller, Plinganserstr. 19, 81369 München) erklären.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 8 Stornierungsbedingungen</h2>
            <p className="text-sm leading-relaxed">
              Die folgenden Stornierungsbedingungen gelten für über die Plattform vermittelte
              Buchungen, sofern zwischen Anbieter und Nachfrager keine abweichenden Regelungen
              ausdrücklich vereinbart wurden:
            </p>
            <div className="mt-3 space-y-3">
              <div className="text-sm leading-relaxed bg-bg-elevated rounded-lg p-4">
                <p className="font-medium text-text-primary mb-1">Stornierung durch den Nachfrager</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Bis <strong>72 Stunden vor</strong> dem vereinbarten Termin: vollständige Erstattung des Buchungsbetrags</li>
                  <li>Weniger als 72 Stunden vor dem Termin: keine Erstattung, es sei denn, der Anbieter stimmt einer Rückerstattung ausdrücklich zu</li>
                  <li>Höhere Gewalt (z. B. Naturkatastrophen, behördliche Verbote): Die Plattform vermittelt auf Anfrage eine Lösung; ein gesetzlicher Anspruch besteht nur nach Maßgabe des BGB</li>
                </ul>
              </div>
              <div className="text-sm leading-relaxed bg-bg-elevated rounded-lg p-4">
                <p className="font-medium text-text-primary mb-1">Stornierung durch den Anbieter</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Bei Stornierung durch den Anbieter wird der Buchungsbetrag vollständig erstattet</li>
                  <li>Wiederholte Stornierungen durch Anbieter können zur Einschränkung oder Sperrung des Accounts führen</li>
                </ul>
              </div>
            </div>
            <p className="text-sm leading-relaxed mt-3">
              Die Serviceprovision nach § 6 wird bei Stornierungen gemäß den jeweiligen
              Stripe-Rückerstattungsbedingungen behandelt. Bearbeitungsgebühren von Stripe
              können nicht rückerstattet werden.
            </p>
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
              <a href="mailto:support@cinegenius.co" className="text-gold hover:underline">
                support@cinegenius.co
              </a>
              . Nach der Löschung werden deine personenbezogenen Daten innerhalb von 30 Tagen gelöscht,
              sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen (z. B. steuerrechtliche
              Aufbewahrungspflichten nach § 147 AO von bis zu 10 Jahren).
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber ist berechtigt, Accounts bei schwerwiegenden oder wiederholten Verstößen
              gegen diese AGB fristlos zu sperren oder dauerhaft zu löschen. Im Fall einer Sperrung
              werden laufende Buchungen nach Maßgabe von § 8 abgewickelt.
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber kann die Plattform mit einer Ankündigungsfrist von 30 Tagen einstellen.
              Im Fall der Einstellung werden laufende Buchungen nach Möglichkeit abgewickelt und
              Prepaid-Guthaben erstattet.
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
            <h2 className="text-base font-semibold text-text-primary mb-2">§ 14 Online-Streitbeilegung & Verbraucherschlichtung</h2>
            <p className="text-sm leading-relaxed">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              . Unsere E-Mail-Adresse lautet:{" "}
              <a href="mailto:support@cinegenius.co" className="text-gold hover:underline">
                support@cinegenius.co
              </a>
            </p>
            <p className="text-sm leading-relaxed mt-3">
              Der Betreiber ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
              vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
              Streitigkeiten zwischen Nutzern und dem Betreiber können im ordentlichen Rechtsweg
              geltend gemacht werden.
            </p>
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
                <a href="mailto:support@cinegenius.co" className="text-gold hover:underline">
                  support@cinegenius.co
                </a>
              </p>
            </div>
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
