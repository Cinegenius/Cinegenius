"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const columns = [
  {
    titleKey: "col1",
    links: [
      { label: "Locations", href: "/locations" },
      { label: "Marktplatz", href: "/marketplace" },
      { label: "Fahrzeuge", href: "/vehicles" },
      { label: "Custom Requisiten", href: "/marketplace/commission" },
    ],
  },
  {
    titleKey: "col2",
    links: [
      { label: "Film Jobs", href: "/jobs" },
      { label: "Crew & Talente", href: "/creators" },
      { label: "Job ausschreiben", href: "/dashboard" },
      { label: "Crew finden", href: "/creators" },
    ],
  },
  {
    titleKey: "col3",
    links: [
      { label: "Über CineGenius", href: "/about" },
      { label: "Hilfe & FAQ", href: "/help" },
      { label: "Trust & Safety", href: "/trust" },
      { label: "Preise", href: "/pricing" },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  const tf = useTranslations("footer");
  if (pathname?.startsWith("/dashboard")) return null;

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
              {tf("tagline")}
            </p>
          </div>

          {/* Link-Spalten */}
          {columns.map((col) => (
            <div key={col.titleKey}>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                {tf(col.titleKey as "col1" | "col2" | "col3")}
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
            © {new Date().getFullYear()} CineGenius. {tf("rights")}
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
