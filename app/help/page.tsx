"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp, MessageSquare, Mail, BookOpen, Film, MapPin, Package, Briefcase, CreditCard, Shield } from "lucide-react";

const categories = [
  {
    icon: BookOpen,
    label: "Erste Schritte",
    items: [
      {
        q: "Was ist CineGenius?",
        a: "CineGenius ist der All-in-One-Marktplatz für die Film- und Medienbranche. Du kannst Locations finden, Crew und Talente buchen, Requisiten und Equipment mieten und Custom Props in Auftrag geben — alles an einem Ort, speziell für Produktionen entwickelt.",
      },
      {
        q: "Brauche ich ein Konto zum Stöbern?",
        a: "Nein — du kannst alle Locations, Requisiten, Jobs und Filmschaffenden ohne Registrierung durchsuchen. Ein Konto brauchst du nur, um eine Buchungsanfrage zu stellen, dich auf Jobs zu bewerben oder eigene Angebote einzustellen.",
      },
      {
        q: "Ist CineGenius kostenlos?",
        a: "Ja — vollständig kostenlos. Registrierung, Profilerstellung, Inserate schalten und Angebote durchsuchen sind ohne Zeitlimit kostenlos. CineGenius verdient ausschließlich durch eine Provision von 10% auf erfolgreiche Transaktionen. Du zahlst nur, wenn du verdienst.",
      },
      {
        q: "Was ist der Unterschied zwischen Anbieter- und Produktionskonto?",
        a: "Anbieter sind Location-Inhaber, Requisiten-Häuser, Crew-Mitglieder oder Hersteller, die ihre Angebote einstellen. Produktionen sind Unternehmen oder Einzelpersonen, die mieten oder buchen möchten. Du kannst in deinen Kontoeinstellungen zwischen beiden Moden wechseln.",
      },
    ],
  },
  {
    icon: MapPin,
    label: "Locations",
    items: [
      {
        q: "Wie werden Locations geprüft?",
        a: "Jede Location wird vor der Veröffentlichung manuell geprüft. Wir verifizieren Eigentumsrechte, prüfen die Angemessenheit der Preise und bestätigen, dass Fotos und Beschreibung übereinstimmen. Verifizierte Locations erhalten ein Häkchen-Badge.",
      },
      {
        q: "Was ist Sofortbuchung?",
        a: "Locations mit Sofortbuchung können ohne Wartezeit auf Bestätigung des Anbieters gebucht werden. Die Daten werden automatisch blockiert und der Vertrag wird automatisch erstellt. Nicht alle Locations bieten Sofortbuchung an.",
      },
      {
        q: "Was deckt die Kaution ab?",
        a: "Die Kaution (30% des Mietwerts) wird treuhänderisch gehalten und innerhalb von 5 Werktagen nach dem Drehtag zurückerstattet, sofern keine Schäden entstanden sind. Gemeldete Schäden werden vor der Rückzahlung gegen die Kaution aufgerechnet.",
      },
      {
        q: "Kann ich eine Location vor der Buchung besichtigen?",
        a: "Ja — die meisten Location-Inhaber bieten einen kurzen Scout-Besuch oder eine Video-Besichtigung vor der Buchung an. Nutze den Kontakt-Button in jedem Inserat, um einen Termin zu vereinbaren.",
      },
    ],
  },
  {
    icon: Package,
    label: "Requisiten & Verleih",
    items: [
      {
        q: "Wie funktioniert der Requisiten-Verleih?",
        a: "Finde den gewünschten Artikel, wähle Startdatum und Mietdauer und sende eine Anfrage. Der Anbieter bestätigt die Verfügbarkeit innerhalb von 24 Stunden. Du zahlst Anzahlung und Servicegebühr vorab, den Restbetrag bei Abholung.",
      },
      {
        q: "Was passiert, wenn eine Requisite während meiner Miete beschädigt wird?",
        a: "Schäden müssen innerhalb von 4 Stunden nach Lieferung/Abholung gemeldet werden. Der Mieter haftet für Schadenskosten laut Anbietereinschätzung. Beim Checkout bieten wir optional einen Schadenschutz, der Versehen bis zu einem festgelegten Betrag abdeckt.",
      },
      {
        q: "Kann ich Requisiten ans Set liefern lassen?",
        a: "Viele Anbieter bieten Lieferung an. Achte auf das grüne 'Lieferung verfügbar'-Badge bei Requisiten. Lieferangebote werden separat vom Anbieter je nach deinem Standort erstellt.",
      },
    ],
  },
  {
    icon: Briefcase,
    label: "Jobs & Crew",
    items: [
      {
        q: "Wie bewerbe ich mich auf einen Job?",
        a: "Gehe zu einem beliebigen Job-Inserat, scrolle zum Bewerbungsformular, füge eine Kurzbewerbung und deinen Portfolio-Link hinzu und sende ab. Das Produktionsteam antwortet in der Regel innerhalb von 3–5 Tagen.",
      },
      {
        q: "Werden meine persönlichen Daten bei einer Bewerbung weitergegeben?",
        a: "Nur Name und Kontaktdaten aus deinem CineGenius-Profil werden mit der buchenden Produktion geteilt. Dein vollständiges Profil (inkl. Portfolio und Credits) ist für sie erst nach deiner Bewerbung sichtbar.",
      },
      {
        q: "Können Produktionen Jobs kostenlos ausschreiben?",
        a: "Ja — vollständig kostenlos und ohne Limit. Alle Stellenausschreibungen, Crew-Suche und Bewerbungen sind kostenlos. CineGenius verdient nur durch Provision auf erfolgreiche Buchungen und Transaktionen.",
      },
    ],
  },
  {
    icon: CreditCard,
    label: "Zahlungen & Abrechnung",
    items: [
      {
        q: "Wann werde ich belastet?",
        a: "Du wirst zum Zeitpunkt der Buchungsbestätigung mit Anzahlung und Servicegebühr belastet. Der verbleibende Mietbetrag ist zum Zeitpunkt der Abholung oder Lieferung fällig. Du wirst nie belastet, bevor der Anbieter bestätigt hat.",
      },
      {
        q: "Welche Zahlungsmethoden werden akzeptiert?",
        a: "Wir akzeptieren alle gängigen Kredit- und Debitkarten (Visa, Mastercard, Amex) sowie Banküberweisung für Buchungen über 5.000 €. Zahlungen werden über Stripe verarbeitet und sind vollständig verschlüsselt.",
      },
      {
        q: "Was ist die Stornierungsrichtlinie?",
        a: "Standard: volle Rückerstattung bei Stornierung 72 Stunden vor Beginn. Bei Stornierung innerhalb von 72 Stunden verfällt die Anzahlung. Einzelne Inserate können strengere Regelungen haben — prüfe immer die Konditionen des Inserats.",
      },
      {
        q: "Wie werden Anbieter bezahlt?",
        a: "Anbieter-Auszahlungen werden innerhalb von 2 Werktagen nach Buchungsbestätigung verarbeitet. Gelder werden per Banküberweisung auf dein hinterlegtes Konto überwiesen. CineGenius behält eine Plattformgebühr von 10%.",
      },
    ],
  },
  {
    icon: Shield,
    label: "Sicherheit & Vertrauen",
    items: [
      {
        q: "Ist CineGenius sicher?",
        a: "Alle Transaktionen werden über Stripe abgewickelt und durch Treuhandschutz gesichert. Wir verifizieren Anbieteridentitäten, prüfen alle Inserate und bieten ein Streitschlichtungsverfahren für auftretende Probleme.",
      },
      {
        q: "Was passiert, wenn ein Anbieter meine Buchung storniert?",
        a: "Wenn ein Anbieter eine bestätigte Buchung storniert, erhältst du innerhalb von 5 Werktagen eine vollständige Rückerstattung und ein Service-Guthaben für deine nächste Buchung. Wir helfen auch bei der Suche nach einer Alternative.",
      },
      {
        q: "Wie melde ich ein betrügerisches Inserat?",
        a: "Nutze den 'Melden'-Button bei jedem Inserat oder schreibe an trust@cinegenius.com. Wir untersuchen alle Meldungen innerhalb von 24 Stunden und entfernen betrügerische Inserate sofort.",
      },
    ],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));

  const filtered = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          !query.trim() ||
          item.q.toLowerCase().includes(query.toLowerCase()) ||
          item.a.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter(
      (cat) =>
        (!activeCategory || cat.label === activeCategory) && cat.items.length > 0
    );

  return (
    <div className="pt-16 min-h-screen">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">
            Hilfe-Center
          </h1>
          <p className="text-text-muted mb-8">
            Alles, was du über die Nutzung von CineGenius wissen musst.
          </p>
          <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-4 focus-within:border-gold transition-colors">
            <Search size={16} className="text-text-muted" />
            <input
              type="text"
              placeholder="Antworten suchen..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none py-3.5 text-sm w-full focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Category tabs */}
        {!query && (
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                !activeCategory
                  ? "bg-gold text-bg-primary border-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >
              Alle Themen
            </button>
            {categories.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActiveCategory(activeCategory === label ? null : label)}
                className={`px-4 py-2 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  activeCategory === label
                    ? "bg-gold text-bg-primary border-gold"
                    : "border-border text-text-secondary hover:border-gold hover:text-gold"
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* FAQ Sections */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-2">Keine Ergebnisse für &ldquo;{query}&rdquo;</p>
            <button
              onClick={() => setQuery("")}
              className="text-gold text-sm hover:text-gold-light transition-colors"
            >
              Suche zurücksetzen
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map(({ label, icon: Icon, items }) => (
              <section key={label}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon size={16} className="text-gold" />
                  <h2 className="font-display text-lg font-bold text-text-primary">{label}</h2>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const key = `${label}-${item.q}`;
                    const isOpen = openItems[key];
                    return (
                      <div key={key} className="border border-border rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-bg-elevated transition-colors"
                        >
                          <span className="text-sm font-medium text-text-primary">{item.q}</span>
                          {isOpen ? (
                            <ChevronUp size={15} className="text-gold shrink-0" />
                          ) : (
                            <ChevronDown size={15} className="text-text-muted shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed border-t border-border pt-4">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="mt-16 p-8 bg-bg-secondary border border-border rounded-2xl text-center">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
            Noch Fragen?
          </h2>
          <p className="text-text-muted mb-6 text-sm">
            Unser Support-Team ist montags bis freitags von 9–18 Uhr MEZ erreichbar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:support@cinegenius.com"
              className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
            >
              <Mail size={15} /> E-Mail Support
            </a>
            <Link
              href="/dashboard"
              className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare size={15} /> Ticket öffnen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
