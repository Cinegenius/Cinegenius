/** Shared catalogue for personal set-catering occupations and company services. */
export const CATERING_DEPARTMENT_ID = "catering-setverpflegung";
export const CATERING_DEPARTMENT_LABEL = "Catering / Setverpflegung";

export type CateringOccupation = {
  id: string;
  label: string;
  labelEn: string;
  aliases: readonly string[];
  description: string;
};

export const CATERING_OCCUPATIONS: readonly CateringOccupation[] = [
  {
    id: "catering-leitung",
    label: "Catering-Leitung",
    labelEn: "Catering Manager",
    aliases: ["Catering Manager", "Catering Coordination", "Catering", "Film-Catering Leitung"],
    description: "Plant Personal, Verpflegung und Ablauf für die Produktion.",
  },
  {
    id: "setkoch",
    label: "Setkoch / Setköchin",
    labelEn: "Set Cook / Chef",
    aliases: ["Caterer (Setkoch)", "Caterer (Setköchin)", "Caterer (Setkoch*Setköchin)", "Chef", "Film Caterer"],
    description: "Kocht und organisiert Mahlzeiten für Cast und Crew am Set.",
  },
  {
    id: "catering-assistenz",
    label: "Catering-Assistenz / Küchenhilfe",
    labelEn: "Catering Assistant / Kitchen Assistant",
    aliases: ["Catering Assistant", "Kitchen Assistant", "Küchenhilfe", "Cateringhilfe"],
    description: "Unterstützt Vorbereitung, Küche und Ausgabe.",
  },
  {
    id: "craft-service",
    label: "Craft Service",
    labelEn: "Craft Service",
    aliases: ["Craft Services", "Craft Service Worker", "Snacks und Getränke am Set"],
    description: "Betreut Snacks und Getränke während der Dreharbeiten; je nach Produktion getrennt vom Hauptcatering.",
  },
  {
    id: "setbetreuung-ausgabe",
    label: "Setbetreuung / Essensausgabe",
    labelEn: "Set Catering / Food Service Attendant",
    aliases: ["Caterer (Setbetreuung)", "Set Caterer", "Catering Attendant", "Service / Ausgabe", "Catering Service"],
    description: "Richtet die Verpflegung her und betreut Ausgabe und Ablauf am Set.",
  },
  {
    id: "catering-fahrer",
    label: "Fahrer/in für Catering und Küchenmobil",
    labelEn: "Catering / Mobile Kitchen Driver",
    aliases: ["Catering Driver", "Mobile Kitchen Driver", "Küchenmobil Fahrer", "Catering-Fahrer/in"],
    description: "Transportiert Catering, Team oder mobile Küchenausstattung zur Produktion.",
  },
] as const;

export const CATERING_COMPANY_CATEGORY = {
  id: "catering-setverpflegung",
  label: CATERING_DEPARTMENT_LABEL,
  color: "text-orange-300",
  bg: "bg-orange-400/10 border-orange-400/20",
  examples: "Setcatering, Foodtruck, Craft Service, Küchenmobil",
  searchTerms: ["catering", "film catering", "filmcatering", "set catering", "setverpflegung", "setkoch", "foodtruck", "food truck", "craft service", "mobile küche", "kuechenmobil"],
} as const;

export const CATERING_COMPANY_SERVICES = [
  { id: "setcatering", label: "Film- und Setcatering" },
  { id: "eventcatering", label: "Eventcatering" },
  { id: "foodtruck", label: "Mobiles Catering / Foodtruck" },
  { id: "craft-service", label: "Craft Service: Snacks und Getränke" },
  { id: "kuechenmobil", label: "Küchenmobil / mobile Küche" },
] as const;

export const CATERING_DIETARY_OPTIONS = [
  "Vegetarisch", "Vegan", "Halal", "Koscher", "Glutenfrei", "Laktosefrei", "Allergikerfreundlich",
] as const;

export const CATERING_MOBILE_EQUIPMENT_OPTIONS = [
  "Foodtruck", "Küchenmobil", "Kühlfahrzeug", "Mobile Ausgabe", "Autarke Stromversorgung",
] as const;

export type CateringCompanyDetails = {
  serviceTypes: string[];
  serviceAreas: string;
  capacity: number | null;
  dietaryOptions: string[];
  mobileEquipment: string[];
};

export const EMPTY_CATERING_COMPANY_DETAILS: CateringCompanyDetails = {
  serviceTypes: [],
  serviceAreas: "",
  capacity: null,
  dietaryOptions: [],
  mobileEquipment: [],
};

export function normalizeCateringCompanyDetails(value: unknown): CateringCompanyDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_CATERING_COMPANY_DETAILS };
  const input = value as Partial<CateringCompanyDetails>;
  const capacity = typeof input.capacity === "number" && Number.isFinite(input.capacity) && input.capacity > 0
    ? Math.min(100_000, Math.floor(input.capacity))
    : null;
  const pick = <T extends readonly string[]>(values: unknown, allowed: T) =>
    Array.isArray(values) ? [...new Set(values.filter((item): item is T[number] => typeof item === "string" && allowed.includes(item as T[number])))].slice(0, allowed.length) : [];
  return {
    serviceTypes: pick(input.serviceTypes, CATERING_COMPANY_SERVICES.map((item) => item.label)),
    serviceAreas: typeof input.serviceAreas === "string" ? input.serviceAreas.trim().slice(0, 240) : "",
    capacity,
    dietaryOptions: pick(input.dietaryOptions, CATERING_DIETARY_OPTIONS),
    mobileEquipment: pick(input.mobileEquipment, CATERING_MOBILE_EQUIPMENT_OPTIONS),
  };
}

export function getCateringCompanySearchTerms(): string[] {
  return [...new Set([
    ...CATERING_COMPANY_CATEGORY.searchTerms,
    ...CATERING_COMPANY_SERVICES.flatMap((service) => [service.label, service.id]),
    ...CATERING_OCCUPATIONS.flatMap((occupation) => [occupation.label, occupation.labelEn, ...occupation.aliases]),
  ])];
}

function normalizeCateringSearch(value: string): string {
  return value.toLocaleLowerCase("de").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Match user-entered German or English search text to the shared catering catalogue. */
export function isCateringSearchQuery(query: string): boolean {
  const needle = normalizeCateringSearch(query.trim());
  if (needle.length < 3) return false;
  return getCateringCompanySearchTerms().some((term) => {
    const candidate = normalizeCateringSearch(term);
    return candidate === needle || candidate.startsWith(needle) || (needle.length >= 4 && candidate.includes(needle)) || (candidate.length >= 5 && needle.includes(candidate));
  });
}

/** Return positions to search in persisted profiles, including historical labels. */
export function getMatchingCateringOccupations(query: string): CateringOccupation[] {
  const needle = normalizeCateringSearch(query.trim());
  if (needle.length < 3) return [];
  if (needle === "catering" || needle === "setverpflegung") return [...CATERING_OCCUPATIONS];
  return CATERING_OCCUPATIONS.filter((occupation) =>
    [occupation.label, occupation.labelEn, ...occupation.aliases].some((term) => {
      const candidate = normalizeCateringSearch(term);
      return candidate === needle || candidate.startsWith(needle) || (needle.length >= 4 && candidate.includes(needle)) || (candidate.length >= 5 && needle.includes(candidate));
    }),
  );
}

export function getCateringProfileSearchValues(query: string): string[] {
  const matches = getMatchingCateringOccupations(query);
  return [...new Set(matches.flatMap((occupation) => [
    occupation.label,
    ...occupation.aliases.filter((alias) => alias.startsWith("Caterer (")),
  ]))];
}
