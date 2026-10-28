/** Stable catalogue IDs. Display copy lives in the existing FilmAnimals messages. */
export const ANIMAL_DEPARTMENT_ID = "filmtiere-tiertraining";
export const ANIMAL_DEPARTMENT_LABEL = "Filmtiere & Tiertraining";
export const ANIMAL_OCCUPATIONS = [
  { id: "tiertrainer", label: "Filmtiertrainer/in", labelEn: "Animal Trainer", aliases: ["Tiertrainer*in", "Tiertrainer/in", "Filmtiertrainer*in", "Tiertrainer/in für Film, Fernsehen und Werbung", "Tiertrainer für Film", "Filmtiertraining"] },
  { id: "filmhundetrainer", label: "Filmhundetrainer/in", labelEn: "Film Dog Trainer", aliases: ["Filmhundetrainer*in", "Filmhundetraining", "Film Dog Training"] },
  { id: "tierbetreuer", label: "Tierhandler/in / Animal Handler", labelEn: "Animal Handler", aliases: ["Tierbetreuer*in", "Animal Handler / Wrangler", "Tierhandler/in", "Animal Wrangler"] },
  { id: "tierkoordination", label: "Tierkoordination / Animal Coordinator", labelEn: "Animal Coordinator", aliases: ["Tierkoordinator/in", "Tierkoordination"] },
  { id: "set-tierbetreuung", label: "Set-Tierbetreuung", labelEn: "On-Set Animal Care", aliases: ["Tierbetreuung am Set", "Set Animal Care"] },
  { id: "horse-master", label: "Horse Master", labelEn: "Horse Master", aliases: ["Pferdekoordination", "Pferdekoordinator/in"] },
  { id: "assistant-horse-master", label: "Assistant Horse Master", labelEn: "Assistant Horse Master", aliases: ["Assistenz der Pferdekoordination"] },
  { id: "horse-trainer", label: "Horse Trainer", labelEn: "Horse Trainer", aliases: ["Filmpferdetrainer/in", "Pferdetrainer/in für Film"] },
  { id: "horse-wrangler", label: "Horse Wrangler", labelEn: "Horse Wrangler", aliases: ["Pferdehandler/in", "Pferdebetreuung am Set"] },
] as const;

export const ANIMAL_COMPANY_CATEGORIES = [
  { id: "tiervermittlung", label: "Filmtieragentur", messageKey: "agency", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", examples: "Filmtiere und betreute Tiereinsätze" },
  { id: "filmhundagentur", label: "Filmhundagentur", messageKey: "dogAgency", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", examples: "Filmhunde, Training und Setbetreuung" },
  { id: "tiertraining-film-medien", label: "Tiertraining für Film und Medien", messageKey: "trainingCompany", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", examples: "Training, Handling und Tierkoordination" },
] as const;
export const ANIMAL_COMPANY_CATEGORY_IDS: readonly string[] = ANIMAL_COMPANY_CATEGORIES.map(category => category.id);
export const ANIMAL_SERVICE_IDS = ["animal-agency", "dog-agency", "animal-training", "dog-training", "animal-handling", "animal-coordination", "set-care"] as const;
export const ANIMAL_SPECIES = [
  { id: "dogs", category: "Hunde", aliases: ["Hund", "Filmhund"] },
  { id: "horses", category: "Pferde", aliases: ["Pferde & Ponys", "Pferd", "Pony"] },
  { id: "cats", category: "Katzen", aliases: ["Katze"] },
  { id: "birds", category: "Vögel", aliases: ["Vogel"] },
  { id: "reptiles", category: "Reptilien", aliases: [] },
  { id: "livestock", category: "Nutztiere", aliases: [] },
  { id: "exotics", category: "Exoten", aliases: [] },
  { id: "other", category: "Sonstige Tiere", aliases: ["Weitere Tierarten"] },
] as const;
export type AnimalSpecies = typeof ANIMAL_SPECIES[number]["id"];
export type AnimalCompanyDetails = { serviceTypes: string[]; species: AnimalSpecies[]; otherSpecies: string };
export const EMPTY_ANIMAL_COMPANY_DETAILS: AnimalCompanyDetails = { serviceTypes: [], species: [], otherSpecies: "" };
export function normalizeAnimalCompanyDetails(value: unknown): AnimalCompanyDetails {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const pick = <T extends string>(values: unknown, allowed: readonly T[]): T[] => Array.isArray(values) ? [...new Set(values.filter((item): item is T => typeof item === "string" && allowed.includes(item as T)))] : [];
  return { serviceTypes: pick(input.serviceTypes, ANIMAL_SERVICE_IDS), species: pick(input.species, ANIMAL_SPECIES.map(item => item.id)), otherSpecies: typeof input.otherSpecies === "string" ? input.otherSpecies.trim().slice(0, 120) : "" };
}
export const isAnimalCompany = (categories: readonly string[] = []) => categories.some(category => ANIMAL_COMPANY_CATEGORY_IDS.includes(category));
const key = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("de");
export function animalOccupation(value: string) {
  return ANIMAL_OCCUPATIONS.find(role => [role.id, role.label, role.labelEn, ...role.aliases].some(alias => key(alias) === key(value))) ?? null;
}
export function animalSpecies(value: string) {
  return ANIMAL_SPECIES.find(species => [species.id, species.category, ...species.aliases].some(alias => key(alias) === key(value))) ?? null;
}
export function animalSearchTerms() {
  return [...new Set(["Filmtier", "Filmtiere", "Tiertrainer", "Tiertraining", "Filmhund", "Filmhunde", "Animal Trainer", "Animal Handler", "Animal Coordinator", ...ANIMAL_OCCUPATIONS.flatMap(role => [role.label, role.labelEn, ...role.aliases]), ...ANIMAL_COMPANY_CATEGORIES.map(category => category.label)])];
}
export function isAnimalSearchQuery(query: string): boolean {
  const needle = key(query);
  return needle.length >= 3 && animalSearchTerms().some(term => key(term).includes(needle) || (key(term).length >= 5 && needle.includes(key(term))));
}
/** Static filter values only; never interpolate an untrusted query into JSON paths. */
export function animalCompanySearchFilter(query: string): string {
  const needle = key(query);
  const species = /filmhund|film dog|dog trainer|dog agency/.test(needle) ? "dogs" : /horse|pferd/.test(needle) ? "horses" : null;
  if (species) return `${species === "dogs" ? "categories.cs.{filmhundagentur}," : ""}animal_details->species.cs.["${species}"]`;
  return isAnimalSearchQuery(query) ? `categories.ov.{${ANIMAL_COMPANY_CATEGORY_IDS.join(",")}}` : "";
}
export function animalProfileSearchValues(query: string): string[] {
  const needle = key(query);
  if (needle.length < 3) return [];
  const generic = ["filmtier", "filmtiere", "tiertraining", "tiertrainer"].includes(needle);
  return [...new Set(ANIMAL_OCCUPATIONS.filter(role => generic || [role.label, role.labelEn, ...role.aliases].some(term => key(term).includes(needle))).flatMap(role => [role.label, role.labelEn, ...role.aliases]))];
}

/** Exact old references only: never confuse a data/cable/vehicle wrangler with animal work. */
export const ANIMAL_LEGACY_REFERENCES = ANIMAL_OCCUPATIONS.flatMap(role => {
  const departmentId = ["tiertrainer", "tierbetreuer"].includes(role.id) ? "set-logistik" : role.id.startsWith("horse-") || role.id === "assistant-horse-master" ? "cast" : null;
  return departmentId ? [role.label, ...role.aliases].map(label => ({ departmentId, roleId: `${departmentId}/${encodeURIComponent(label)}`, targetLabel: role.label })) : [];
});

export type AnimalTranslator = (key: string) => string;
export function animalCategoryLabel(id: string, fallback: string, t: AnimalTranslator) { return ANIMAL_COMPANY_CATEGORY_IDS.includes(id) ? t(`categories.${id}`) : fallback; }
export function animalRoleLabel(value: string, t: AnimalTranslator) { const role = animalOccupation(value); return role ? t(`roles.${role.id}`) : value; }
export function animalCompanySearchText(details: unknown, categories: readonly string[] = []) {
  const data = normalizeAnimalCompanyDetails(details);
  return [...ANIMAL_COMPANY_CATEGORIES.filter(category => categories.includes(category.id)).flatMap(category => [category.label, ...(category.id === "filmhundagentur" ? ["Filmhund", "Film Dog Agency"] : ["Filmtier", "Tiertrainer", "Animal Trainer", "Animal Handler"])]), ...data.serviceTypes, ...data.species.flatMap(id => { const item = animalSpecies(id)!; return [item.category, ...item.aliases]; }), data.otherSpecies].join(' ');
}

/** Animal entries are production portfolios, never objects for sale or rental. */
export function animalPortfolioMetadata(category: unknown, value: unknown, rentalType?: unknown) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const species = typeof category === "string" ? animalSpecies(category) : null;
  if (!species || rentalType === "kauf" || metadata.rental_type === "kauf" || metadata.offer_kind === "sale") return null;
  const text = (key: string, limit: number) => typeof metadata[key] === "string" ? metadata[key].trim().slice(0,limit) : null;
  return { offer_kind: "animal_portfolio", species: species.id, training_level: text("training_level",120),
    handler_included: metadata.handler_included === true, count: String(metadata.count ?? "1").slice(0,40),
    special_skills: text("special_skills",2000), delivery: metadata.delivery === true,
    ...(metadata.focal_point ? {focal_point:metadata.focal_point} : {}) };
}
