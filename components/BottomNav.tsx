"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Users, Briefcase, ShoppingBag, Film, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  if (pathname.startsWith("/dashboard")) return null;
  if (pathname.startsWith("/profile-setup")) return null;
  if (pathname.startsWith("/sign-in")) return null;
  if (pathname.startsWith("/sign-up")) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const items = [
    { href: "/locations", icon: MapPin,      key: "locations"   },
    { href: "/creators",  icon: Users,       key: "crew"        },
    { href: "/jobs",      icon: Briefcase,   key: "jobs"        },
    { href: "/props",     icon: ShoppingBag, key: "marketplace" },
    { href: "/projects",  icon: Film,        key: "projects"    },
    { href: "/companies", icon: Building2,   key: "companies"   },
  ] as const;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-border safe-area-pb">
      <div className="flex items-stretch h-14">
        {items.map(({ href, icon: Icon, key }) => {
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
                {t(key)}
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
