import Link from "next/link";
import { Globe, X, Link2, Film } from "lucide-react";
import { Logo } from "./Logo";

const columns = [
  {
    title: "Marktplatz",
    links: [
      { label: "Drehorte", href: "/locations" },
      { label: "Marktplatz", href: "/marketplace" },
      { label: "Fahrzeuge", href: "/vehicles" },
      { label: "Custom Requisiten", href: "/marketplace/commission" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Film Jobs", href: "/jobs" },
      { label: "Crew & Talente", href: "/creators" },
      { label: "Job ausschreiben", href: "/dashboard" },
      { label: "Crew finden", href: "/creators" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { label: "Über CineGenius", href: "/about" },
      { label: "Wie es funktioniert", href: "/pricing" },
      { label: "Trust & Safety", href: "/trust" },
      { label: "Impressum", href: "/impressum" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-secondary mt-20 pb-14 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Marke */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <Logo />
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
              Der All-in-One-Marktplatz für Film- und Medienproduktion.
              Drehorte, Crew, Requisiten, Equipment — alles an einem Ort.
            </p>
            <div className="flex gap-4 mt-6">
              {[
                { Icon: Globe, href: "#" },
                { Icon: X, href: "#" },
                { Icon: Link2, href: "#" },
                { Icon: Film, href: "#" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-9 h-9 border border-border rounded-md flex items-center justify-center text-text-secondary hover:border-gold hover:text-gold transition-all"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link-Spalten */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-gold transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Unterzeile */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} CineGenius. Alle Rechte vorbehalten.
          </p>
          <div className="flex gap-6">
            {[
              { label: "Datenschutz", href: "/datenschutz" },
              { label: "AGB", href: "/agb" },
              { label: "Impressum", href: "/impressum" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
