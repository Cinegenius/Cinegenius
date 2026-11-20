/** Only public directory categories, never member IDs, queries, hashes or private routes. */
const DIRECTORIES = new Set(["locations", "props", "vehicles", "creators", "companies", "projects", "jobs", "organizations", "news", "photo", "marketplace"]);
export function analyticsPage(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (!pathname.startsWith("/") || pathname.includes("?") || pathname.includes("#")) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (!DIRECTORIES.has(parts[0]) || parts.length > 2) return null;
  if (parts.length === 1) return `/${parts[0]}`;
  // Unknown subroutes may be editors or account paths: don't capture them.
  if (["suche", "alle"].includes(parts[1])) return `/${parts[0]}/${parts[1]}`;
  return null;
}

export function analyticsProperties(page: string) {
  return { $current_url: `https://www.cinegenius.co${page}`, $pathname: page, $ip: null };
}

export const NEWS_ANALYTICS_EVENTS = ["news_impression", "news_view"] as const;
export type NewsAnalyticsEvent = (typeof NEWS_ANALYTICS_EVENTS)[number];
export type NewsAnalyticsSurface = "home" | "news" | "organization" | "article";
export function newsAnalyticsSurface(path: string): NewsAnalyticsSurface | null {
  if (path === "/") return "home";
  if (path === "/news") return "news";
  if (/^\/organizations\/[^/?#]+$/.test(path)) return "organization";
  if (/^\/news\/[^/?#]+\/[^/?#]+$/.test(path)) return "article";
  return null;
}
export function newsAnalyticsProperties(event: string, values: Record<string, unknown>, path: string) {
  const surface = newsAnalyticsSurface(path);
  if (!(NEWS_ANALYTICS_EVENTS as readonly string[]).includes(event) || !surface || values.surface !== surface ||
    typeof values.article_id !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(values.article_id) ||
    (event === "news_view") !== (surface === "article")) return null;
  return {...analyticsProperties(surface === "home" ? "/" : "/news"), article_id: values.article_id, surface, measurement_version: 1};
}
