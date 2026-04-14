import Link from "next/link";
import { Film, Users, MapPin, Package, Star, ArrowRight, CheckCircle, Zap } from "lucide-react";

const values = [
  {
    icon: Film,
    title: "Für Kreative gebaut",
    description: "Jede Funktion entstand aus echtem Bedarf am Set, beim Shooting oder beim Content-Dreh — nicht aus dem Lehrbuch.",
  },
  {
    icon: Users,
    title: "Community zuerst",
    description: "Faire Chancen für alle Beteiligten. Transparente Bedingungen schützen sowohl Anbieter als auch Suchende.",
  },
  {
    icon: Zap,
    title: "Direkt & ohne Agentur",
    description: "Keine Zwischenhändler, keine versteckten Gebühren. Du kontaktierst direkt — und wirst direkt gebucht.",
  },
  {
    icon: Star,
    title: "Qualität vor Quantität",
    description: "Lieber wenige gute Inserate als tausende mittelmäßige. Wir wachsen bewusst langsam und gründlich.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-16 min-h-screen">

      {/* ── HERO ── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 border border-gold/20 rounded-full text-gold text-xs font-medium mb-6">
            <Film size={12} /> Über CineGenius
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-text-primary mb-6 leading-tight">
            Der Marktplatz für<br />
            <span className="text-gradient-gold">Film, Foto & Content.</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            CineGenius verbindet Kreative mit Locations, Crew, Equipment und Jobs —
            für Film, Fotografie, Social Media und Werbung in der DACH-Region.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/locations" className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-2">
              Plattform entdecken <ArrowRight size={15} />
            </Link>
            <Link href="/sign-up" className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors font-medium">
              Kostenlos registrieren
            </Link>
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-20 px-4 bg-bg-secondary border-y border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-6">
            Warum CineGenius?
          </h2>
          <div className="space-y-4 text-text-secondary leading-relaxed text-left">
            <p>
              Wer schon mal eine Location gesucht hat, kennt das Problem: Stundenlange Google-Suche,
              Instagram-DMs, Telefonketten — und am Ende vielleicht eine Antwort.
            </p>
            <p>
              Wer Crew buchen wollte, landete bei teuren Agenturen oder kannte zufällig die richtigen Leute.
              Equipment leihen war Kopfsache und Vertrauenssache gleichzeitig.
            </p>
            <p>
              CineGenius löst genau das: Ein Ort, alles transparent, direkt buchbar — ohne Agentur dazwischen.
              Für Film, Foto, Social Media und Werbung. Für Profis und Einsteiger gleichermaßen.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-left">
            {[
              "Locations, Crew, Equipment und Jobs an einem Ort",
              "Direkte Kommunikation — keine Agentur, keine Provision",
              "Sicher bezahlen über Treuhand — erst nach Abschluss",
              "Kostenlos inserieren und gefunden werden",
            ].map((point) => (
              <div key={point} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <CheckCircle size={15} className="text-gold mt-0.5 shrink-0" />
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">
              Wofür wir stehen
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Die Grundsätze hinter jeder Entscheidung, die wir treffen.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-6 bg-bg-secondary border border-border rounded-xl hover:border-gold/30 transition-colors">
                <div className="w-10 h-10 bg-gold/10 border border-gold/20 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={18} className="text-gold" />
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 bg-bg-secondary border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold text-text-primary mb-4">
            Teil der Community werden
          </h2>
          <p className="text-text-muted mb-8 text-lg">
            Ob Location-Inhaber, Freelancer, Firma oder Suchender —
            CineGenius ist für alle, die kreativ arbeiten.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/sign-up"
              className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-2"
            >
              Kostenloses Konto erstellen <ArrowRight size={15} />
            </Link>
            <Link
              href="/locations"
              className="px-8 py-3.5 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors font-medium"
            >
              Plattform entdecken
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
