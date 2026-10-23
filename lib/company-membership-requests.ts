import { normalizeCompanyPublicTitles } from "./company-roles";

export function isPublicCompanyMembership(status: unknown): boolean {
  return status === "accepted";
}

export function normalizeCompanyRequestMessage(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
    : "";
}

export function companyPublicTitlesDiffer(before: unknown, after: unknown): boolean {
  return normalizeCompanyPublicTitles(before).join("\u0000")
    !== normalizeCompanyPublicTitles(after).join("\u0000");
}

export function companyDashboardRequestsUrl(companyId: string): string {
  return `/company-dashboard?company_id=${encodeURIComponent(companyId)}&tab=team&team_view=requests`;
}
