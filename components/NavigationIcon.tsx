import { Bell, Bookmark, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, CircleHelp, Film, House, Landmark, LifeBuoy, MapPin, Menu, MessageSquare, Newspaper, Settings, ShieldCheck, ShoppingBag, UserRound, Users, Wallet } from "lucide-react";
import type { SVGProps } from "react";
import type { SiteNavigationIcon } from "@/lib/site-navigation";

function WorkIcon({ size = 20, strokeWidth = 1.8, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m13.5 10.5-8.8 8.8a1.8 1.8 0 0 1-2.5-2.5L11 8" />
    <path d="m9 5 3-3 9 9-3 3-9-9Z" />
    <path d="m20 16 1.5 1.5M17 18l.3 2M21 13l1.5.3" />
  </svg>;
}

const icons = { crew: Users, locations: MapPin, messages: MessageSquare, account: UserRound, more: Menu, home: House, marketplace: ShoppingBag, jobs: BriefcaseBusiness, companies: Building2, projects: Film, news: Newspaper, ai: WorkIcon, organizations: Landmark, profile: UserRound, offers: BriefcaseBusiness, saved: Bookmark, contacts: Users, bookings: CalendarDays, notifications: Bell, payments: Wallet, settings: Settings, analytics: ChartNoAxesCombined, security: ShieldCheck, help: CircleHelp, support: LifeBuoy };

export default function NavigationIcon({ name, className, size = 20 }: { name: SiteNavigationIcon; className?: string; size?: number }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={1.8} />;
}
