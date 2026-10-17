/** Accept only same-origin path redirects so auth entry points cannot become open redirects. */
export function safeAuthRedirect(
  value: string | string[] | undefined,
  fallback: string,
  blockedPaths: string[] = [],
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) return fallback;

  try {
    const target = new URL(candidate, "https://cinegenius.co");
    if (target.origin !== "https://cinegenius.co") return fallback;
    if (blockedPaths.some((path) => target.pathname === path || target.pathname.startsWith(`${path}/`))) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
