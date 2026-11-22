import { routeMatches } from "./site-navigation";
import type { SiteNavigationIcon } from "./site-navigation";

export type NativeAppArea = "shots" | "workspace" | "smart" | "news" | "projects";

/** App destinations are real server routes; the native appearance marker grants no access. */
export const NATIVE_APP_NAV_ITEMS = [
  { id: "shots", href: "/app/shots", labelKey: "NativeAppChrome.shots" },
  { id: "news", href: "/news", labelKey: "nav.news" },
  { id: "smart", href: "/search?smart=1", labelKey: "NativeAppChrome.smart" },
  { id: "projects", href: "/projects", labelKey: "nav.projects" },
  { id: "workspace", href: "/app/workspace", labelKey: "NativeAppChrome.work" },
] as const;

export const NATIVE_APP_MENU_ITEMS: readonly { id: string; href: string; labelKey: string; icon: SiteNavigationIcon }[] = [
  { id: "jobs", href: "/jobs", labelKey: "nav.jobs", icon: "jobs" },
  { id: "board", href: "/community", labelKey: "footer.links_board", icon: "news" },
  { id: "help", href: "/help", labelKey: "nav.help", icon: "help" },
  { id: "support", href: "/support", labelKey: "nav.support", icon: "support" },
];

/** Keep public details in their area without marking unrelated private utilities as Smart. */
export function nativeAppActiveArea(pathname: string): NativeAppArea | null {
  if (routeMatches(pathname, "/app/shots")) return "shots";
  if (routeMatches(pathname, "/app/workspace") || ["/work/teams", "/work/mail"].some(route => routeMatches(pathname, route))) return "workspace";
  if (routeMatches(pathname, "/news") || routeMatches(pathname, "/organizations")) return "news";
  if (pathname === "/projects/neu") return null;
  if (routeMatches(pathname, "/projects")) return "projects";
  if (/^\/companies\/[^/]+\/message\/?$/.test(pathname)) return null;
  if (["/search", "/creators", "/person", "/props", "/vehicles", "/locations", "/companies", "/jobs", "/tiere", "/marketplace"].some(route => routeMatches(pathname, route))) return "smart";
  if (/^\/profile\/[^/]+\/?$/.test(pathname)) return "smart";
  return null;
}
