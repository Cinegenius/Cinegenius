/** Public profile views use exactly one path segment; the profile editor is /profile. */
export function isPublicProfilePath(pathname: string): boolean {
  return /^\/profile\/[^/]+$/.test(pathname);
}

/** Creation entry points must override broad public directory matchers. */
export function isProtectedCreatePath(pathname: string): boolean {
  return pathname === "/profile" || pathname === "/projects/neu";
}
