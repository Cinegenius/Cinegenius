export type CompanyDashboardTab = "overview" | "services" | "equipment" | "team";

export function companyDashboardTab(value: string | null): CompanyDashboardTab {
  return value === "services" || value === "equipment" || value === "team" ? value : "overview";
}

export function companyDashboardUrl(companyId: string, tab: CompanyDashboardTab = "overview") {
  return `/company-dashboard?company_id=${encodeURIComponent(companyId)}${tab === "overview" ? "" : `&tab=${tab}`}`;
}

export function companyEditorUrl(companyId: string) {
  return `/company-setup?company_id=${encodeURIComponent(companyId)}`;
}

export const NEW_COMPANY_URL = "/company-setup?new=1";
