export const SITE_NAV_MENU_ID = "site-navigation-menu";
export const SITE_NAV_SIGN_OUT_EVENT = "cinegenius:request-sign-out";

export type SiteNavigationIcon = "crew" | "locations" | "messages" | "account" | "more" | "home" | "marketplace" | "jobs" | "companies" | "projects" | "news" | "ai" | "organizations" | "profile" | "offers" | "saved" | "contacts" | "bookings" | "notifications" | "payments" | "settings" | "analytics" | "security" | "help" | "support";
export type PrimaryNavigationId = "crew" | "locations" | "marketplace" | "jobs" | "companies" | "messages" | "news" | "account" | "more";
type NavigationLink = { readonly id: string; readonly href: string; readonly key: string; readonly icon: SiteNavigationIcon };
type PrimaryNavigationItem = { readonly id: PrimaryNavigationId; readonly key: string; readonly icon: SiteNavigationIcon } & ({ readonly kind: "link"; readonly href: string } | { readonly kind: "menu"; readonly href?: never });

/** Stable header destinations; the mobile bar uses direct links without a second menu. */
export const PRIMARY_NAV_ITEMS: readonly PrimaryNavigationItem[] = [
  { id: "crew", kind: "link", href: "/creators", key: "crew", icon: "crew" },
  { id: "locations", kind: "link", href: "/locations", key: "locations", icon: "locations" },
  { id: "marketplace", kind: "link", href: "/props", key: "marketplace", icon: "marketplace" },
  { id: "jobs", kind: "link", href: "/jobs", key: "jobs", icon: "jobs" },
  { id: "companies", kind: "link", href: "/companies", key: "companies", icon: "companies" },
  { id: "news", kind: "link", href: "/news", key: "news", icon: "news" },
  { id: "more", kind: "menu", key: "more", icon: "more" },
];

export const BROWSE_NAV_ITEMS: readonly NavigationLink[] = [
  { id: "home", href: "/", key: "home", icon: "home" },
  { id: "crew", href: "/creators", key: "crew", icon: "crew" },
  { id: "locations", href: "/locations", key: "locations", icon: "locations" },
  { id: "marketplace", href: "/props", key: "marketplace", icon: "marketplace" },
  { id: "jobs", href: "/jobs", key: "jobs", icon: "jobs" },
  { id: "companies", href: "/companies", key: "companies", icon: "companies" },
  { id: "news", href: "/news", key: "news", icon: "news" },
  { id: "organizations", href: "/organizations", key: "organizations", icon: "organizations" },
  { id: "projects", href: "/projects", key: "projects", icon: "projects" },
  { id: "ai", href: "/tools", key: "ai", icon: "ai" },
];

export const MOBILE_NAV_ITEMS: readonly NavigationLink[] = [
  { id: "crew", href: "/creators", key: "crew", icon: "crew" },
  { id: "marketplace", href: "/props", key: "marketplace", icon: "marketplace" },
  { id: "ai", href: "/tools", key: "ai", icon: "ai" },
  { id: "locations", href: "/locations", key: "locations", icon: "locations" },
  { id: "companies", href: "/companies", key: "companies", icon: "companies" },
];

/** Direct desktop links stay reachable from the compact header menu on tablets. */
export function isPrimaryBrowseItem(id: string) {
  return PRIMARY_NAV_ITEMS.some(item => item.kind === "link" && item.id === id);
}

export const ACCOUNT_NAV_ITEMS: readonly NavigationLink[] = [
  { id: "overview", href: "/dashboard", key: "accountOverview", icon: "account" },
  { id: "profile", href: "/profile", key: "myProfile", icon: "profile" },
  { id: "offers", href: "/dashboard?tab=listings", key: "myOffers", icon: "offers" },
  { id: "saved", href: "/dashboard?tab=favorites", key: "savedItems", icon: "saved" },
  { id: "contacts", href: "/dashboard?tab=friends", key: "contacts", icon: "contacts" },
  { id: "bookings", href: "/dashboard?tab=bookings", key: "bookings", icon: "bookings" },
  { id: "company", href: "/company-dashboard", key: "manageCompany", icon: "companies" },
  { id: "notifications", href: "/notifications", key: "notifications", icon: "notifications" },
  { id: "payments", href: "/invoices", key: "payments", icon: "payments" },
  { id: "settings", href: "/dashboard?tab=settings", key: "accountSettings", icon: "settings" },
  { id: "analytics", href: "/dashboard?tab=analytics", key: "analytics", icon: "analytics" },
  { id: "security", href: "/profile?tab=security", key: "securityAndSignIn", icon: "security" },
];

export function routeMatches(pathname: string, route: string) {
  return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));
}

export function activeNavigationId(pathname: string): PrimaryNavigationId {
  if (routeMatches(pathname, "/creators") || routeMatches(pathname, "/person") || pathname.startsWith("/profile/")) return "crew";
  if (routeMatches(pathname, "/props")) return "marketplace";
  if (routeMatches(pathname, "/locations")) return "locations";
  if (routeMatches(pathname, "/jobs")) return "jobs";
  if (routeMatches(pathname, "/companies")) return "companies";
  if (routeMatches(pathname, "/messages")) return "messages";
  if (routeMatches(pathname, "/news")) return "news";
  if (["/dashboard", "/profile", "/favorites", "/notifications", "/invoices", "/company-dashboard", "/organization-dashboard", "/inserat", "/admin"].some(route => routeMatches(pathname, route))) return "account";
  return "more";
}

export function activeMobileNavigationId(pathname: string) {
  if (routeMatches(pathname, "/tools")) return "ai";
  if (routeMatches(pathname, "/jobs")) return "more";
  return activeNavigationId(pathname);
}

export function hideMobileNavigation(pathname: string, chatOpen: boolean) {
  return ["/sign-in", "/sign-up", "/profile-setup"].some(route => routeMatches(pathname, route))
    || (routeMatches(pathname, "/messages") && chatOpen);
}
