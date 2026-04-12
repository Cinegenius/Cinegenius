import Link from "next/link";
import {
  CheckCircle, Zap, Shield, DollarSign, Percent,
  MapPin, Car, Package, Users, Sparkles, Briefcase, ArrowRight,
} from "lucide-react";

const categories = [
  { icon: MapPin, name: "Drehorte", rate: 10 },
  { icon: Car, name: "Fahrzeuge", rate: 10 },
  { icon: Package, name: "Requisiten & Equipment", rate: 10 },
  { icon: Users, name: "Filmschaffende & Crew", rate: 10 },
  { icon: Briefcase, name: "Film Jobs", rate: 10 },
  { icon: Sparkles, name: "Custom Props", rate: 10 },
];

const faqs = [
  {
    q: "Ist CineGenius wirklich komplett kostenlos?",
    a: "Ja. Registrierung, Profilerstellung, Inserate schalten und Angebote durchsuchen sind vollständig kostenlos — ohne Zeitlimit und ohne versteckte Gebühren. Du zahlst ausschließlich dann, wenn eine Transaktion erfolgreich abgeschlossen wird.",
  },
  {
    q: "Wie hoch ist die Provision genau?",
    a: "CineGenius berechnet 10% auf den Buchungs- oder Kaufbetrag. Diese werden automatisch abgezogen. Beispiel: Bei einer Buchung über 500 € erhält der Anbieter 450 €, CineGenius behält 50 €.",
  },
  {
    q: "Wann wird die Provision abgezogen?",
    a: "Die Provision wird automatisch bei der Zahlung einbehalten. Der Käufer zahlt den Gesamtbetrag, das Geld wird treuhänderisch gehalten und nach Abschluss wird 90% an den Anbieter ausgezahlt.",
  },
  {
    q: "Wie funktioniert das Treuhand-System?",
    a: "Nach der Zahlung hält CineGenius den Betrag sicher in einem Treuhandkonto. Erst wenn die Buchung abgeschlossen und bestätigt ist, wird die Auszahlung an den Anbieter freigegeben. Das schützt beide Seiten.",
  },
  {
    q: "Was passiert bei einer Stornierung?",
    a: "Stornierungen bis 48 Stunden vor dem Buchungsdatum sind kostenlos. Bei späteren Stornierungen fällt eine Stornogebühr von 50% an. Die Provision wird nur bei abgeschlossenen Transaktionen einbehalten.",
  },
  {
    q: "Gibt es Gebühren für Käufer / Produktionsteams?",
    a: "Nein. Käufer zahlen ausschließlich den vereinbarten Buchungsbetrag. Es gibt keine zusätzliche Servicegebühr für die suchende Seite.",
  },
  {
    q: "Kann ich die Plattform ohne Buchung testen?",
    a: "Selbstverständlich. Du kannst dich registrieren, ein Profil anlegen, Inserate erstellen und alle Angebote durchsuchen — ohne jemals etwas bezahlen zu müssen, solange keine Buchung zustande kommt.",
  },
];

export default function PricingPage() {
  return (
    <div className="pt-20 min-h-screen">
      {/* Hero */}
      <div className="text-center py-20 px-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/30 bg-success/10 text-success text-xs font-semibold uppercase tracking-widest mb-6">
          <CheckCircle size={12} /> Kein Abo. Keine Monatsgebühr.
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-text-primary mb-5 leading-tight">
          Kostenlos nutzen —
          <br />
          <span className="text-gradient-gold">zahlen nur wenn du verdienst.</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          CineGenius ist für alle vollständig kostenlos. Wir verdienen nur dann, wenn du
          erfolgreich buchst oder vermietest — durch eine transparente Provision von 10%.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/sign-up" className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-md hover:bg-gold-light transition-colors flex items-center justify-center gap-2">
            Kostenlos registrieren <ArrowRight size={16} />
          </Link>
          <Link href="/locations" className="px-8 py-3.5 border border-border text-text-primary font-semibold rounded-md hover:border-gold hover:text-gold transition-all flex items-center justify-center gap-2">
            Angebote entdecken
          </Link>
        </div>
      </div>

      {/* Das Modell */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Zap,
              title: "Kostenlos starten",
              desc: "Registrierung, Profil, Inserate schalten und Angebote durchsuchen — alles ohne Kosten, ohne Zeitlimit.",
              color: "border-gold/30 bg-gold-subtle",
              iconColor: "text-gold",
            },
            {
              icon: Percent,
              title: "10% Provision",
              desc: "Nur bei erfolgreichen Transaktionen. CineGenius behält 10%, du erhältst 90% — automatisch, transparent, fair.",
              color: "border-gold bg-gold-subtle shadow-lg",
              iconColor: "text-gold",
              featured: true,
            },
            {
              icon: Shield,
              title: "Sicher & geschützt",
              desc: "Alle Zahlungen über Treuhand. Geld wird erst nach Abschluss freigegeben. Voller Schutz für beide Seiten.",
              color: "border-success/30 bg-success/5",
              iconColor: "text-success",
            },
          ].map(({ icon: Icon, title, desc, color, iconColor, featured }) => (
            <div key={title} className={`relative p-7 rounded-2xl border ${color} flex flex-col items-center text-center`}>
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-gold text-bg-primary text-xs font-bold rounded-full uppercase tracking-widest">
                    Unser Modell
                  </span>
                </div>
              )}
              <div className={`w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center mb-4`}>
                <Icon size={22} className={iconColor} />
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary mb-2">{title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Provisions-Beispiel */}
      <div className="bg-bg-secondary border-y border-border py-16 mb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Transparenz</p>
            <h2 className="font-display text-3xl font-bold text-text-primary">So funktioniert die Provision</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Beispiel-Rechnung */}
            <div className="p-6 rounded-2xl border border-border bg-bg-elevated">
              <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4">Beispiel: Drehort-Buchung</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2.5 border-b border-border">
                  <span className="text-sm text-text-secondary">Buchungsbetrag</span>
                  <span className="text-sm font-semibold text-text-primary font-mono">1.000 €</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-border">
                  <span className="text-sm text-text-muted">CineGenius Provision (10%)</span>
                  <span className="text-sm font-semibold text-crimson-light font-mono">− 100 €</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-success/10 rounded-lg px-3 mt-2">
                  <span className="text-sm font-bold text-text-primary">Du erhältst</span>
                  <span className="text-xl font-bold text-success font-display">900 €</span>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-4 text-center">
                Auszahlung innerhalb von 3–5 Werktagen nach Abschluss
              </p>
            </div>

            {/* Erklärung */}
            <div className="space-y-4">
              {[
                { step: "1", title: "Käufer bucht & zahlt", desc: "Der Käufer zahlt den vollen Betrag sicher über CineGenius." },
                { step: "2", title: "Geld in Treuhand", desc: "Die Plattform hält das Geld treuhänderisch bis zur Bestätigung." },
                { step: "3", title: "Buchung abgeschlossen", desc: "Nach erfolgreichem Abschluss wird die Zahlung freigegeben." },
                { step: "4", title: "Auszahlung: 90%", desc: "Du erhältst 90% — CineGenius behält 10% als Provision." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 text-gold text-sm font-bold flex items-center justify-center shrink-0">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-0.5">{title}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Provision per Kategorie */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Alle Kategorien</p>
          <h2 className="font-display text-3xl font-bold text-text-primary mb-2">Einheitliche 10% für alle</h2>
          <p className="text-text-muted text-sm">Keine versteckten Unterschiede — dieselbe faire Provision in jeder Kategorie.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {categories.map(({ icon: Icon, name, rate }) => (
            <div key={name} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-secondary">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{name}</p>
                <p className="text-xs text-gold font-semibold">{rate}% Provision</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Was ist kostenlos */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="p-8 rounded-2xl border border-border bg-bg-secondary">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-6 text-center">
            Was ist alles kostenlos?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Registrierung & Profilerstellung",
              "Unbegrenzte Inserate erstellen",
              "Alle Kategorien durchsuchen",
              "Plattform-Nachrichten senden",
              "Buchungsanfragen stellen",
              "Buchungsanfragen empfangen",
              "Bewertungen hinterlassen",
              "Auf Film-Jobs bewerben",
              "Crew & Talente kontaktieren",
              "Dashboard & Analysen nutzen",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-success shrink-0" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="font-display text-2xl font-bold text-text-primary text-center mb-8">
          Häufige Fragen
        </h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="p-5 rounded-xl border border-border bg-bg-secondary">
              <h3 className="font-semibold text-text-primary mb-2">{faq.q}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center p-8 rounded-2xl border border-gold/20 bg-gold-subtle">
          <h3 className="font-display text-2xl font-bold text-text-primary mb-3">
            Bereit? Es kostet nichts.
          </h3>
          <p className="text-text-muted text-sm mb-6">
            Melde dich an, erstelle dein Profil und fang an — ohne Risiko.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-md hover:bg-gold-light transition-colors"
          >
            Jetzt kostenlos starten <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
