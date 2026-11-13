import { Bell, Bookmark, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, CircleHelp, Film, House, Landmark, LifeBuoy, MapPin, Menu, MessageSquare, Newspaper, Settings, ShieldCheck, ShoppingBag, Sparkles, UserRound, Users, Wallet } from "lucide-react";
import type { SiteNavigationIcon } from "@/lib/site-navigation";

const icons = { crew: Users, locations: MapPin, messages: MessageSquare, account: UserRound, more: Menu, home: House, marketplace: ShoppingBag, jobs: BriefcaseBusiness, companies: Building2, projects: Film, news: Newspaper, ai: Sparkles, organizations: Landmark, profile: UserRound, offers: BriefcaseBusiness, saved: Bookmark, contacts: Users, bookings: CalendarDays, notifications: Bell, payments: Wallet, settings: Settings, analytics: ChartNoAxesCombined, security: ShieldCheck, help: CircleHelp, support: LifeBuoy };

export default function NavigationIcon({ name, className, size = 20 }: { name: SiteNavigationIcon; className?: string; size?: number }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={1.8} />;
}
