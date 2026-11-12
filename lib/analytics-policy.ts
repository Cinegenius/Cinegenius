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
