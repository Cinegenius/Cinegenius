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

/** Keep new accounts in the resumable setup wizard before honoring a return path. */
export function getSignUpSetupDestination(destination: string): string {
  const params = new URLSearchParams({ welcome: "1" });
  if (destination !== "/dashboard") params.set("redirect", destination);
  return `/profile-setup?${params.toString()}`;
}

/** Preserve the intended destination when switching between sign-in and sign-up. */
export function getAuthSwitchDestination(mode: "sign-in" | "sign-up", destination: string): string {
  const params = new URLSearchParams({ redirect_url: destination });
  return `/${mode}?${params.toString()}`;
}
