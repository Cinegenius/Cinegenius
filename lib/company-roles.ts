export const COMPANY_PERMISSION_ROLES = ["owner", "admin", "editor", "member"] as const;
export type CompanyPermissionRole = (typeof COMPANY_PERMISSION_ROLES)[number];
export type CompanyCapability = "read" | "edit_company" | "edit_offers" | "manage_team" | "manage_permissions";

export function normalizeCompanyPermissionRole(role: string | null | undefined): CompanyPermissionRole | null {
  if (role === "manager") return "editor"; // Legacy manager entries keep their edit access.
  return COMPANY_PERMISSION_ROLES.includes(role as CompanyPermissionRole)
    ? role as CompanyPermissionRole
    : null;
}

/** Keep the pre-existing database value for editors; legacy installations use `manager`. */
export function companyPermissionRoleForStorage(role: string): Exclude<CompanyPermissionRole, "owner"> | "manager" | null {
  const normalized = normalizeCompanyPermissionRole(role);
  if (!normalized || normalized === "owner") return null;
  return normalized === "editor" ? "manager" : normalized;
}

export function canCompanyRole(role: string | null | undefined, capability: CompanyCapability): boolean {
  const normalized = normalizeCompanyPermissionRole(role);
  if (!normalized) return false;
  if (capability === "read") return true;
  if (normalized === "owner") return true;
  if (capability === "edit_company" || capability === "edit_offers") return normalized === "admin" || normalized === "editor";
  if (capability === "manage_team") return normalized === "admin";
  if (capability === "manage_permissions") return false;
  return false;
}

export function canCompanyRoleManageTarget(actorRole: string | null | undefined, targetRole: string | null | undefined, nextRole?: string | null): boolean {
  const actor = normalizeCompanyPermissionRole(actorRole);
  const target = normalizeCompanyPermissionRole(targetRole);
  const next = nextRole == null ? null : normalizeCompanyPermissionRole(nextRole);
  if (!actor || !target || target === "owner") return false;
  if (actor === "owner") return next !== "owner";
  if (actor !== "admin") return false;
  return target !== "admin" && next !== "admin" && next !== "owner";
}

export const COMPANY_PUBLIC_TITLE_SUGGESTIONS = [
  "Gründer/in", "Mitgründer/in", "Geschäftsführer/in", "Inhaber/in", "Abteilungsleitung",
  "Projektleitung", "Produktion", "Vertrieb / Kundenbetreuung", "Mitarbeiter/in", "Freie Mitarbeit",
] as const;

export function normalizeCompanyPublicTitles(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const titles: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const title = item.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (title && !titles.some((existing) => existing.toLocaleLowerCase() === title.toLocaleLowerCase())) titles.push(title);
    if (titles.length === 5) break;
  }
  return titles;
}

export function publicTitlesForMember(publicTitles: unknown, legacyTitle: string | null | undefined): string[] {
  const titles = normalizeCompanyPublicTitles(publicTitles);
  if (titles.length) return titles;
  return normalizeCompanyPublicTitles(legacyTitle);
}
