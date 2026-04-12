import Link from "next/link";
import { Film, Users, MapPin, Package, Briefcase, Star, Globe, ArrowRight, CheckCircle } from "lucide-react";

const stats = [
  { value: "12.000+", label: "Filmschaffende" },
  { value: "3.400+", label: "Drehorte" },
  { value: "8.200+", label: "Requisiten & Verleih" },
  { value: "94%", label: "Buchungszufriedenheit" },
];

const team = [
  {
    name: "Elena Vasquez",
    role: "Mitgründerin & CEO",
    bio: "Ehemalige Line Producerin mit 15 Jahren Erfahrung in Spielfilmen, Werbung und Dokumentarfilmen. Gründete CineGenius, nachdem sie zu viele Stunden mit Tabellenkalkulationen und Kaltakquise verbracht hatte.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
  },
  {
    name: "Marcus Holt",
    role: "Mitgründer & CTO",
    bio: "Ex-Google-Ingenieur und unabhängiger Filmemacher. Verbindet technische Tiefe mit direktem Wissen darüber, was Produktionen wirklich von Tools brauchen.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  },
  {
    name: "Simone Park",
    role: "Head of Locations",
    bio: "Location Managerin, die für Netflix, A24 und BBC scouted hat. Kennt jeden Winkel der Branche und weiß genau, wie Location-Deals für beide Seiten funktionieren.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80",
  },
  {
    name: "David Osei",
    role: "Head of Creator Relations",
    bio: "Dokumentarfilmer und Produzent. Leidenschaftlich darin, aufstrebende Talente mit den richtigen Produktionen zu verbinden und faire, transparente Vergütung sicherzustellen.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
  },
];

const values = [
  {
    icon: Film,
    title: "Für Film gebaut",
    description: "Jede Funktion existiert, weil jemand am Set sie brauchte. Wir fügen keine Komplexität hinzu — wir reduzieren sie.",
  },
  {
    icon: Users,
    title: "Community zuerst",
    description: "Produktionen gelingen, wenn alle faire Chancen haben. Wir schützen Käufer und Anbieter durch transparente Bedingungen.",
  },
  {
    icon: Globe,
    title: "Global vernetzt, lokal verwurzelt",
    description: "Von Hollywood bis Helsinki verbinden wir Produktionen weltweit und bewahren dabei lokales Marktwissen.",
  },
  {
    icon: Star,
    title: "Qualität vor Quantität",
    description: "Jedes Inserat wird geprüft. Wir bevorzugen 3.000 außergewöhnliche Locations gegenüber 30.000 mittelmäßigen.",
  },
];

const milestones = [
  { year: "2021", event: "CineGenius wird in Los Angeles von Elena und Marcus gegründet — nach einer frustrierend schwierigen Location-Suche für einen Kurzfilm." },
  { year: "2022", event: "Beta-Launch mit 200 Locations und 50 geprüften Crew-Profilen. Erste Buchung über die Plattform: eine BMW-Werbekampagne in Chicago." },
  { year: "2023", event: "1.000 Locations erreicht. Start des Requisiten-Marktplatzes. Über 500.000 € Transaktionsvolumen im ersten Jahr." },
  { year: "2024", event: "Expansion nach Europa. Start des Custom-Prop-Marktplatzes. Über 2 Mio. USD Transaktionsvolumen pro Jahr." },
  { year: "2025", event: "12.000+ Filmschaffende, 3.400+ Locations. Launch der interaktiven Kartensuche und KI-gestütztem Matching (Beta)." },
  { year: "2026", event: "Weiteres Wachstum — Mobile Apps in Entwicklung, neue Märkte im Asien-Pazifik-Raum geplant." },
];

const press = [
  { outlet: "Variety", quote: "Die Plattform, auf die die Filmindustrie gewartet hat.", logo: "V" },
  { outlet: "IndieWire", quote: "CineGenius verändert, wie unabhängige Produktionen Locations und Crew finden.", logo: "IW" },
  { outlet: "ProductionHub", quote: "Eine All-in-One-Lösung, die Produktionsabläufe wirklich versteht.", logo: "PH" },
  { outlet: "The Hollywood Reporter", quote: "Wird still und leise zur unverzichtbaren Infrastruktur moderner Produktionen.", logo: "HR" },
];

export default function AboutPage() {
  return (
    <div className="pt-16 min-h-screen">

      {/* ── HERO ── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-crimson/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gold/3 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 border border-gold/20 rounded-full text-gold text-xs font-medium mb-6">
            <Film size={12} /> Unsere Geschichte
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-text-primary mb-6 leading-tight">
            Die Plattform, gebaut
            <br />
            <span className="text-gradient-gold">von Filmemachern,</span>
            <br />
            für Filmemacher.
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            CineGenius existiert, um die Reibung zwischen kreativer Vision und praktischer Realität zu beseitigen.
            Wir haben den Marktplatz gebaut, den wir uns selbst gewünscht hätten — einen, der die Sprache der Produktion spricht.
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

      {/* ── STATS ── */}
      <section className="py-16 px-4 border-y border-border bg-bg-secondary">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="font-display text-4xl font-bold text-gold mb-1">{value}</div>
              <div className="text-text-muted text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-5">
              Warum CineGenius existiert
            </h2>
            <div className="space-y-4 text-text-secondary leading-relaxed">
              <p>
                Jede Produktion stößt irgendwann an dieselben Wände. Eine perfekte Location, die unmöglich zu finden ist.
                Ein Crew-Mitglied, das man nicht erreicht. Eine Requisite, von der man weiß, dass sie irgendwo existiert — aber wo?
              </p>
              <p>
                Die Filmindustrie läuft auf Beziehungen und institutionellem Wissen, das seit Jahrzehnten in
                Tabellenkalkulationen und Rolodexen eingesperrt ist. Das ändern wir.
              </p>
              <p>
                CineGenius bringt Locations, Crew, Requisiten und Custom-Builds in einen transparenten, durchsuchbaren
                Marktplatz — mit echten Preisen, echter Verfügbarkeit und echten Tools für echte Produktionen.
              </p>
            </div>
            <div className="mt-8 space-y-3">
              {[
                "Verifizierte Inserate mit echten Preisen und Verfügbarkeit",
                "Integrierte Buchung und Zahlungsschutz",
                "Branchenübliche Konditionen und transparente Gebühren",
                "Dedizierter Support von Menschen mit Set-Erfahrung",
              ].map((point) => (
                <div key={point} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <CheckCircle size={15} className="text-gold mt-0.5 shrink-0" />
                  {point}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border">
              <img
                src="https://images.unsplash.com/photo-1524712245354-2c4e5e7121c0?w=800&q=80"
                alt="Filmproduktion"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-5 p-4 bg-bg-elevated border border-border rounded-xl shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
                  <Star size={16} className="text-gold fill-gold" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">4,9 / 5 Durchschnittsbewertung</div>
                  <div className="text-xs text-text-muted">Aus 6.800+ verifizierten Bewertungen</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-20 px-4 bg-bg-secondary border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">
              Wofür wir stehen
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Die Grundsätze, die jede unserer Produktentscheidungen leiten.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-6 bg-bg-primary border border-border rounded-xl hover:border-gold/30 transition-colors">
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

      {/* ── TIMELINE ── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">Unsere Geschichte</h2>
            <p className="text-text-muted">Von einer frustrierenden Location-Suche zum vollständigsten Produktionsmarktplatz der Branche.</p>
          </div>
          <div className="relative">
            <div className="absolute left-[72px] top-0 bottom-0 w-px bg-border" />
            <div className="space-y-8">
              {milestones.map(({ year, event }) => (
                <div key={year} className="flex gap-6 items-start">
                  <div className="w-16 shrink-0 text-right">
                    <span className="font-display text-sm font-bold text-gold">{year}</span>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-gold border-2 border-bg-primary mt-1 shrink-0 relative z-10" />
                  <p className="text-text-secondary text-sm leading-relaxed pt-0.5">{event}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TEAM ── */}
      <section className="py-20 px-4 bg-bg-secondary border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">Das Team</h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Filmemacher, Ingenieure und Branchenveteranen, die die Tools bauen, die wir immer haben wollten.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map(({ name, role, bio, image }) => (
              <div key={name} className="group">
                <div className="aspect-square rounded-xl overflow-hidden mb-4 border border-border">
                  <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3 className="font-semibold text-text-primary">{name}</h3>
                <p className="text-gold text-xs font-medium mb-2">{role}</p>
                <p className="text-text-muted text-xs leading-relaxed">{bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRESS ── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-text-primary mb-3">Presse & Medien</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {press.map(({ outlet, quote, logo }) => (
              <div key={outlet} className="p-5 bg-bg-secondary border border-border rounded-xl hover:border-gold/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center mb-4">
                  <span className="font-display text-xs font-bold text-gold">{logo}</span>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed italic mb-3">&ldquo;{quote}&rdquo;</p>
                <p className="text-text-muted text-xs font-semibold">— {outlet}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 bg-bg-secondary border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold text-text-primary mb-4">
            Bereit, der Community beizutreten?
          </h2>
          <p className="text-text-muted mb-8 text-lg">
            Ob Location-Inhaber, Crew-Mitglied, Requisiten-Anbieter oder Produktionsfirma —
            auf CineGenius ist Platz für dich.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/sign-up"
              className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-2"
            >
              Kostenloses Konto erstellen <ArrowRight size={15} />
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3.5 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors font-medium"
            >
              Wie es funktioniert
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
