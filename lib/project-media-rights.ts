export const PROJECT_MEDIA_RIGHTS_BASES = ["own", "permission", "press", "license"] as const;
export type ProjectMediaRights = { confirmed: boolean; basis: string; holder: string; source: string; credit: string };
export const EMPTY_PROJECT_MEDIA_RIGHTS: ProjectMediaRights = { confirmed: false, basis: "", holder: "", source: "", credit: "" };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, limit = 300) => typeof value === "string" ? value.trim().slice(0, limit) : "";
export function projectMediaUrls(project: Record<string, unknown>): string[] {
  return [...new Set([project.poster_url, ...(Array.isArray(project.images) ? project.images : [])].filter((url): url is string => typeof url === "string" && !!url.trim()).map(url => url.trim()))];
}
export function normalizeProjectMediaRights(value: unknown): ProjectMediaRights {
  const input = record(value);
  return { confirmed: input.confirmed === true, basis: text(input.basis, 30), holder: text(input.holder), source: text(input.source, 1000), credit: text(input.credit) };
}
export function projectMediaGrant(project: Record<string, unknown>, input: unknown, userId: string, now = new Date().toISOString()) {
  const rights = normalizeProjectMediaRights(input);
  if (!rights.confirmed || !PROJECT_MEDIA_RIGHTS_BASES.includes(rights.basis as typeof PROJECT_MEDIA_RIGHTS_BASES[number]) || !rights.holder
    || (rights.basis !== "own" && !rights.source)) return null;
  return { version: 1, confirmed_by: userId, confirmed_at: now, basis: rights.basis, holder: rights.holder, source: rights.source, credit: rights.credit, urls: projectMediaUrls(project) };
}
/** Public projections never expose unconfirmed artwork or private licensing notes. No originals are deleted. */
export function publicProjectMedia<T extends Record<string, unknown>>(project: T) {
  const grant = record(record(project.metadata).media_rights);
  const valid = grant.version === 1 && !!text(grant.confirmed_by) && !!text(grant.confirmed_at) && !!text(grant.holder)
    && PROJECT_MEDIA_RIGHTS_BASES.includes(grant.basis as typeof PROJECT_MEDIA_RIGHTS_BASES[number])
    && (grant.basis === "own" || !!text(grant.source))
    && (typeof project.created_by === "string" && project.created_by === grant.confirmed_by);
  const allowed = new Set(valid && Array.isArray(grant.urls) ? grant.urls.filter((url): url is string => typeof url === "string") : []);
  const { metadata: _metadata, created_by: _creator, ...safe } = project;
  void _metadata; void _creator;
  return { ...safe, poster_url: typeof project.poster_url === "string" && allowed.has(project.poster_url) ? project.poster_url : null,
    images: Array.isArray(project.images) ? project.images.filter((url): url is string => typeof url === "string" && allowed.has(url)) : [],
    image_credit: valid ? text(grant.credit) || null : null };
}
export function publicProjectCredits<T extends { projects?: unknown }>(credits: T[]) {
  return credits.map(credit => ({ ...credit, projects: Array.isArray(credit.projects)
    ? credit.projects.map(project => publicProjectMedia(record(project)))
    : credit.projects && typeof credit.projects === "object" ? publicProjectMedia(record(credit.projects)) : null }));
}
