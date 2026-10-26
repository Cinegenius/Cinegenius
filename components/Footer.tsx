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
        { labelKey: "links_marketplace", href: "/props" },
        { labelKey: "links_vehicles", href: "/vehicles" },
        { labelKey: "links_customProps", href: "/marketplace/commission" },
      ],
    },
    {
      titleKey: "col2",
      links: [
        { labelKey: "links_filmJobs", href: "/jobs" },
        { labelKey: "links_crewTalent", href: "/creators" },
        { labelKey: "links_postJob", href: "/inserat" },
        { labelKey: "links_projects", href: "/projects/alle" },
        { labelKey: "links_board", href: "/community" },
      ],
    },
    {
      titleKey: "col3",
      links: [
        { labelKey: "links_companies", href: "/companies" },
        { labelKey: "links_about", href: "/about" },
        { labelKey: "links_help", href: "/help" },
        { labelKey: "links_trust", href: "/trust" },
        { labelKey: "links_pricing", href: "/pricing" },
      ],
    },
  ];

  return (
    <footer id="site-footer" className="relative z-10 border-t border-border bg-bg-secondary mt-12 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-12">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-6 lg:gap-12">
          {/* Marke */}
          <div className="col-span-2 lg:col-span-2">
            <div className="mb-3">
              <Logo />
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
              {tf("tagline")}
            </p>
          </div>

          {/* Link-Spalten */}
          {columns.map((col) => (
            <div key={col.titleKey} className={col.titleKey === "col3" ? "col-span-2 lg:col-span-1" : "min-w-0"}>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1 sm:mb-2">
                {tf(col.titleKey as "col1" | "col2" | "col3")}
              </h4>
              <ul className={col.titleKey === "col3" ? "grid grid-cols-2 gap-x-4 sm:gap-x-6 lg:flex lg:flex-col" : "flex flex-col"}>
                {col.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 sm:min-h-11 items-center text-sm text-text-secondary hover:text-gold transition-colors [overflow-wrap:anywhere]"
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
        <div className="mt-4 pt-3 sm:mt-8 sm:pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} CineGenius. {tf("rights")}
          </p>
          <div className="flex max-w-full flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { labelKey: "links_privacy", href: "/datenschutz" },
              { labelKey: "links_terms", href: "/agb" },
              { labelKey: "links_imprint", href: "/impressum" },
            ].map(({ labelKey, href }) => (
              <Link
                key={labelKey}
                href={href}
                className="inline-flex min-h-11 items-center text-sm text-text-muted hover:text-text-secondary transition-colors"
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
