import Link from "next/link";
import {
  CheckCircle, Zap, Shield, Users, MapPin, Car, Package, Briefcase, Sparkles, ArrowRight,
} from "lucide-react";

const freeFeatures = [
  "Registrierung & Profilerstellung",
  "Unbegrenzte Inserate erstellen",
  "Alle Kategorien durchsuchen",
  "Plattform-Nachrichten senden",
  "Buchungsanfragen stellen & empfangen",
  "Bewertungen hinterlassen",
  "Auf Film-Jobs bewerben",
  "Crew & Talente kontaktieren",
  "Dashboard & Analysen nutzen",
  "Für immer kostenlos — kein Abo",
];

const categories = [
  { icon: MapPin, name: "Drehorte" },
  { icon: Car, name: "Fahrzeuge" },
  { icon: Package, name: "Requisiten & Equipment" },
  { icon: Users, name: "Filmschaffende & Crew" },
  { icon: Briefcase, name: "Film Jobs" },
  { icon: Sparkles, name: "Custom Props" },
];

const faqs = [
  {
    q: "Ist CineGenius wirklich kostenlos?",
    a: "Ja — vollständig und ohne Einschränkungen. Registrierung, Profil, Inserate schalten, suchen, Nachrichten, Buchungen — alles kostenlos. Es gibt keine Provision, keine Transaktionsgebühr und kein Abo.",
  },
  {
    q: "Wie verdient CineGenius Geld?",
    a: "Derzeit konzentrieren wir uns vollständig auf Wachstum und Community-Aufbau. Zukünftige Monetarisierung (z.B. optionale Premium-Features) wird transparent kommuniziert — Kernfunktionen bleiben kostenlos.",
  },
  {
    q: "Gibt es versteckte Kosten?",
    a: "Nein. Keine Provision, keine Servicegebühr, keine Plattformgebühr. Was du siehst ist der Preis, den Anbieter und Käufer direkt miteinander vereinbaren.",
  },
  {
    q: "Was passiert bei einer Buchung?",
    a: "Buchungen werden direkt zwischen den Parteien abgewickelt. Die Zahlungsintegration (Stripe) ist noch in Entwicklung — bis dahin erfolgt die Abwicklung nach individueller Vereinbarung.",
  },
  {
    q: "Kann ich auch als Firma CineGenius nutzen?",
    a: "Ja. Produktionsfirmen, Verleiher und Studios können Profile und Inserate kostenlos anlegen — ohne Limit.",
  },
];

export default function PricingPage() {
  return (
    <div className="pt-20 min-h-screen">
      {/* Hero */}
      <div className="text-center py-20 px-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/30 bg-success/10 text-success text-xs font-semibold uppercase tracking-widest mb-6">
          <CheckCircle size={12} /> Kein Abo. Keine Gebühren. Keine Provision.
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-text-primary mb-5 leading-tight">
          CineGenius ist
          <br />
          <span className="text-gradient-gold">komplett kostenlos.</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          Keine versteckten Gebühren, keine Provision, kein Abo. Registriere dich, erstelle dein Profil und fang sofort an.
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

      {/* 3 Pillar */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Zap,
              title: "Sofort loslegen",
              desc: "Registrierung dauert 2 Minuten. Profil anlegen, Inserat erstellen — ohne Kreditkarte, ohne Trial.",
              color: "border-gold/30 bg-gold-subtle",
              iconColor: "text-gold",
            },
            {
              icon: CheckCircle,
              title: "0 % Gebühren",
              desc: "Keine Provision, keine Transaktionsgebühr. Was vereinbart wird, bleibt zwischen Anbieter und Käufer.",
              color: "border-gold bg-gold-subtle shadow-lg",
              iconColor: "text-gold",
              featured: true,
            },
            {
              icon: Shield,
              title: "Sicher & direkt",
              desc: "Verifizierte Profile, direkte Kommunikation — keine Agentur als Zwischenhändler.",
              color: "border-success/30 bg-success/5",
              iconColor: "text-success",
            },
          ].map(({ icon: Icon, title, desc, color, iconColor, featured }) => (
            <div key={title} className={`relative p-7 rounded-2xl border ${color} flex flex-col items-center text-center`}>
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-gold text-bg-primary text-xs font-bold rounded-full uppercase tracking-widest">
                    Immer so
                  </span>
                </div>
              )}
              <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center mb-4">
                <Icon size={22} className={iconColor} />
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary mb-2">{title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Was ist alles kostenlos */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="p-8 rounded-2xl border border-border bg-bg-secondary">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-6 text-center">
            Was ist alles kostenlos?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {freeFeatures.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-success shrink-0" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alle Kategorien */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Alle Kategorien</p>
          <h2 className="font-display text-3xl font-bold text-text-primary mb-2">Kostenlos in jeder Kategorie</h2>
          <p className="text-text-muted text-sm">Kein Unterschied — dieselbe kostenlose Nutzung überall.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {categories.map(({ icon: Icon, name }) => (
            <div key={name} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-secondary">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{name}</p>
                <p className="text-xs text-success font-semibold">Kostenlos</p>
              </div>
            </div>
          ))}
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
            Melde dich an, erstelle dein Profil und fang an — ohne Risiko, ohne Kosten.
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
