import { readFileSync, writeFileSync } from "node:fs";
import { departments, getDepartmentRoleFormLabels, getDeptLabel } from "../lib/departments";
import { occupationCatalogue } from "../lib/primary-occupation";
import { SUPPORTED_LOCALES } from "../lib/i18n/locales";
import { occupationTextKey } from "../lib/search-text-key";

// Build-time data only. Requests never load all locale catalogs or translate
// member content. Stable occupation IDs remain the only target identifiers.
const catalogs = SUPPORTED_LOCALES.map(locale => {
  const catalog = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).Taxonomy;
  return { locale, t: (key: string) => key.split(".").reduce((value, part) => value?.[part], catalog) ?? key };
});
const keys = (labels: string[]) => [...new Set(labels.map(occupationTextKey).filter(Boolean))].sort();
const data = {
  departments: departments.map(dept => [dept.id, keys([dept.id, dept.label, ...Object.values(dept.labels),
    ...catalogs.map(({ locale, t }) => getDeptLabel(dept, locale, undefined, t))])]),
  roles: occupationCatalogue.map(role => [role.roleId, keys([...role.aliases,
    ...catalogs.flatMap(({ locale, t }) => getDepartmentRoleFormLabels(role.departmentId, role.label, locale, undefined, t))])]),
};
const output = JSON.stringify(data) + "\n";
const path = new URL("../lib/i18n/smart-language-index.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== output) throw new Error("Smart language index is stale. Run generate-smart-language-index.mts.");
} else writeFileSync(path, output);
console.log(`Smart language index: ${data.roles.length} occupations, ${catalogs.length} languages, ${Buffer.byteLength(output)} bytes.`);
