"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Users, Briefcase, ShoppingBag, Film, Building2 } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // Dashboard has its own internal bottom nav — don't double up
  if (pathname.startsWith("/dashboard")) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const items = [
    { href: "/locations", icon: MapPin,      label: "Locations"  },
    { href: "/creators",  icon: Users,       label: "Crew"       },
    { href: "/jobs",      icon: Briefcase,   label: "Jobs"       },
    { href: "/props",     icon: ShoppingBag, label: "Marktplatz" },
    { href: "/projects",  icon: Film,        label: "Projekte"   },
    { href: "/companies", icon: Building2,   label: "Firmen"     },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-border safe-area-pb">
      <div className="flex items-stretch h-14">
        {items.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                active ? "text-gold" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[9px] font-medium leading-none ${active ? "text-gold" : ""}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gold rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
