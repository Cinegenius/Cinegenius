export const COMPANY_LOGO_BACKGROUNDS = ["auto", "light", "dark"] as const;
export type CompanyLogoBackground = typeof COMPANY_LOGO_BACKGROUNDS[number];

export function isCompanyLogoBackground(value: unknown): value is CompanyLogoBackground {
  return typeof value === "string" && COMPANY_LOGO_BACKGROUNDS.some((option) => option === value);
}

export function normalizeCompanyLogoBackground(value: unknown): CompanyLogoBackground {
  return isCompanyLogoBackground(value) ? value : "auto";
}

/** Predictable SSR default; white marks can explicitly choose the dark surface. */
export function companyLogoSurface(value: unknown): string {
  return normalizeCompanyLogoBackground(value) === "dark" ? "#171b25" : "#f3f3f0";
}
