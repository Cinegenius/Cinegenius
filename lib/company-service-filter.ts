import { COMPANY_CATEGORIES } from "./companyCategories";
const categories = new Map(COMPANY_CATEGORIES.flatMap(category => [[category.id,category.id],[category.label,category.id]] as [string,string][]));
type CompanyServices = { categories?: readonly string[];services?: readonly string[] };
/** Existing public catalogue IDs and their exact stored labels only. Free-text
 * services stay searchable but never become an inferred professional category. */
export function canonicalCompanyServiceIds(company: CompanyServices): string[] {
  return [...new Set([...(company.categories ?? []),...(company.services ?? [])].flatMap(value => categories.has(value) ? [categories.get(value)!] : []))].sort();
}
export function companyMatchesService(company: CompanyServices,id:string): boolean {
  return !id || Boolean(company.categories?.includes(id)) || canonicalCompanyServiceIds(company).includes(id);
}
