"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function Footer() {
  const pathname = usePathname();
  const tf = useTranslations("footer");
  if (pathname?.startsWith("/dashboard")) return null;

  const columns = [
    {
      titleKey: "col1",
      links: [
        { labelKey: "links_locations", href: "/locations" },
        { labelKey: "links_marketplace", href: "/marketplace" },
        { labelKey: "links_vehicles", href: "/vehicles" },
        { labelKey: "links_customProps", href: "/marketplace/commission" },
      ],
    },
    {
      titleKey: "col2",
      links: [
        { labelKey: "links_filmJobs", href: "/jobs" },
        { labelKey: "links_crewTalent", href: "/creators" },
        { labelKey: "links_postJob", href: "/dashboard" },
        { labelKey: "links_findCrew", href: "/creators" },
      ],
    },
    {
      titleKey: "col3",
      links: [
        { labelKey: "links_about", href: "/about" },
        { labelKey: "links_help", href: "/help" },
        { labelKey: "links_trust", href: "/trust" },
        { labelKey: "links_pricing", href: "/pricing" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-bg-secondary mt-20 pb-14 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Marke */}
          <div className="col-span-2 lg:col-span-2">
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
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-gold transition-colors"
                    >
                      {tf(link.labelKey as Parameters<typeof tf>[0])}
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
              { labelKey: "links_privacy", href: "/datenschutz" },
              { labelKey: "links_terms", href: "/agb" },
              { labelKey: "links_imprint", href: "/impressum" },
            ].map(({ labelKey, href }) => (
              <Link
                key={labelKey}
                href={href}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {tf(labelKey as Parameters<typeof tf>[0])}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
