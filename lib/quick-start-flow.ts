import { departments, getDepartmentRoleSearchTerms, getProfileTypesForDepartment } from "@/lib/departments";
import { gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";
import type { ProfileType } from "@/lib/profile-types";

export const QUICK_START_INTENTS = ["crew", "talent", "location", "equipment", "company", "search"] as const;
export type QuickStartIntent = typeof QUICK_START_INTENTS[number];

export const QUICK_START_SCREENS = [
  "name", "goals", "crew-departments", "crew-roles", "person-city", "talent-roles", "talent-intro",
  "location-category", "location-details", "location-photo", "location-price",
  "equipment-category", "equipment-details", "equipment-photo", "equipment-price",
  "company-details", "company-photo", "review",
] as const;
export type QuickStartScreen = typeof QUICK_START_SCREENS[number];

export type QuickStartRoleSelection = { departmentId: string; role: string };
export type QuickStartIntentData = {
  category: string;
  title: string;
  city: string;
  description: string;
  imageUrl: string;
  price: string;
  priceOnRequest: boolean;
  departmentIds: string[];
  roles: QuickStartRoleSelection[];
};
export type QuickStartDraft = {
  version: 2;
  step: QuickStartScreen;
  intents: QuickStartIntent[];
  name: string;
  personCity: string;
  talentIntro: string;
  sections: Partial<Record<QuickStartIntent, QuickStartIntentData>>;
  completed: { profile: boolean; listings: Partial<Record<"location" | "equipment", string>>; company?: string };
  requestKeys: Partial<Record<"location" | "equipment" | "company", string>>;
};

export const START_QUICK_START_DRAFT: QuickStartDraft = {
  version: 2,
  step: "name",
  intents: [],
  name: "",
  personCity: "",
  talentIntro: "",
  sections: {},
  completed: { profile: false, listings: {} },
  requestKeys: {},
};

export const QUICK_START_INTENT_LABELS: Record<QuickStartIntent, string> = {
  crew: "Als Crewmitglied arbeiten",
  talent: "Als Schauspieler, Model oder Komparse mitmachen",
  location: "Eine Location anbieten",
  equipment: "Equipment, Fahrzeuge oder Requisiten anbieten",
  company: "Eine Firma präsentieren",
  search: "Personen oder Angebote für ein Projekt suchen",
};

export const QUICK_START_CATEGORIES = {
  location: [
    { label: "Wohnung oder Haus", value: "Wohnen", example: "Innenräume, Garten oder Terrasse" },
    { label: "Café oder Gastronomie", value: "Gastronomie", example: "Café, Restaurant, Bar oder Küche" },
    { label: "Büro oder Gewerberaum", value: "Büro", example: "Arbeitsräume, Laden oder Werkstatt" },
    { label: "Außenfläche oder Grundstück", value: "Natur", example: "Hof, Garten, Feld oder freie Fläche" },
    { label: "Filmstudio", value: "Studio", example: "Studio oder Produktionsfläche" },
    { label: "Fotostudio", value: "Fotostudio", example: "Studio für Foto- und Videoaufnahmen" },
    { label: "Etwas anderes", value: "Speziallocation", example: "Ein anderer passender Ort" },
  ],
  equipment: [
    { label: "Kamera und Zubehör", value: "Kameraequipment", example: "Kamera, Objektive oder Zubehör" },
    { label: "Licht", value: "Lichttechnik", example: "Lampen, Leuchten oder Lichtformer" },
    { label: "Möbel und Einrichtung", value: "Möbel / Szenenbild", example: "Möbel und Einrichtungsstücke" },
    { label: "Requisiten und Dekoration", value: "Requisiten", example: "Gegenstände und Dekoration" },
    { label: "Kostüme und Kleidung", value: "Kostüme", example: "Kleidung und Kostümteile" },
    { label: "Ton und Audio", value: "Ton & Audio", example: "Mikrofone, Recorder und Zubehör" },
    { label: "Fahrzeug", value: "Bild-Fahrzeug", example: "Fahrzeug für Bild oder Produktion" },
    { label: "Etwas anderes", value: "Produktionsausstattung", example: "Anderes Equipment oder Setzubehör" },
  ],
} as const;

export type QuickStartRole = { departmentId: string; departmentLabel: string; role: string };
const departmentById = new Map(departments.map((department) => [department.id, department]));
const roleRecords: QuickStartRole[] = departments.flatMap((department) =>
  [...new Set(department.roles)].map((role) => ({ departmentId: department.id, departmentLabel: department.label, role })),
);
const validScreenSet = new Set<string>(QUICK_START_SCREENS);
const validIntentSet = new Set<string>(QUICK_START_INTENTS);

export function getQuickStartDepartments() {
  return departments.filter((department) => department.id !== "cast" && department.roles.length > 0);
}

export function createQuickStartIntentData(): QuickStartIntentData {
  return { category: "", title: "", city: "", description: "", imageUrl: "", price: "", priceOnRequest: true, departmentIds: [], roles: [] };
}

function normalizeIntentData(value: unknown): QuickStartIntentData {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<QuickStartIntentData> : {};
  const departmentIds = Array.isArray(input.departmentIds)
    ? [...new Set(input.departmentIds.filter((id): id is string => typeof id === "string" && departmentById.has(id)))].slice(0, departments.length)
    : [];
  const roles = Array.isArray(input.roles)
    ? input.roles.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const selection = candidate as Partial<QuickStartRoleSelection>;
      const department = typeof selection.departmentId === "string" ? departmentById.get(selection.departmentId) : null;
      if (!department || !departmentIds.includes(department.id) || typeof selection.role !== "string" || !department.roles.includes(selection.role)) return [];
      return [{ departmentId: department.id, role: selection.role }];
    }).filter((item, index, list) => list.findIndex((other) => other.departmentId === item.departmentId && other.role === item.role) === index).slice(0, 100)
    : [];
  return {
    category: typeof input.category === "string" ? input.category.slice(0, 100) : "",
    title: typeof input.title === "string" ? input.title.slice(0, 200) : "",
    city: typeof input.city === "string" ? input.city.slice(0, 100) : "",
    description: typeof input.description === "string" ? input.description.slice(0, 3000) : "",
    imageUrl: typeof input.imageUrl === "string" ? input.imageUrl.slice(0, 1200) : "",
    price: typeof input.price === "string" ? input.price.slice(0, 20) : "",
    priceOnRequest: input.priceOnRequest !== false,
    departmentIds,
    roles,
  };
}

function isQuickStartIntent(value: unknown): value is QuickStartIntent {
  return typeof value === "string" && validIntentSet.has(value);
}

export function normalizeQuickStartDraft(value: unknown): QuickStartDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return START_QUICK_START_DRAFT;
  const input = value as Partial<QuickStartDraft> & Record<string, unknown>;

  // Migrate the previous three-screen quick-start draft without discarding its entries.
  if (input.version !== 2) {
    const oldIntent = input.intent;
    const intent: QuickStartIntent | null = oldIntent === "talent" ? "talent"
      : oldIntent === "location" || oldIntent === "equipment" || oldIntent === "company" || oldIntent === "search" ? oldIntent : null;
    const legacyData = normalizeIntentData({
      category: input.category,
      title: input.title,
      city: input.city,
      departmentIds: typeof input.departmentId === "string" && departmentById.has(input.departmentId) ? [input.departmentId] : [],
      roles: typeof input.departmentId === "string" && typeof input.role === "string" ? [{ departmentId: input.departmentId, role: input.role }] : [],
    });
    const legacyStep = (input as Record<string, unknown>).step;
    const step: QuickStartScreen = legacyStep === 3 ? "review"
      : intent === "talent" ? "talent-roles"
        : intent === "location" ? "location-category"
          : intent === "equipment" ? "equipment-category"
            : "name";
    return {
      ...START_QUICK_START_DRAFT,
      step,
      intents: intent ? [intent] : [],
      name: typeof input.name === "string" ? input.name.slice(0, 120) : "",
      personCity: intent === "talent" ? legacyData.city : "",
      sections: intent ? { [intent]: legacyData } : {},
    };
  }

  const intents = Array.isArray(input.intents) ? [...new Set(input.intents.filter(isQuickStartIntent))].slice(0, QUICK_START_INTENTS.length) : [];
  const rawSections = input.sections && typeof input.sections === "object" && !Array.isArray(input.sections)
    ? input.sections as Partial<Record<QuickStartIntent, unknown>> : {};
  const sections: Partial<Record<QuickStartIntent, QuickStartIntentData>> = {};
  for (const intent of QUICK_START_INTENTS) if (rawSections[intent]) sections[intent] = normalizeIntentData(rawSections[intent]);
  const completedInput: Partial<QuickStartDraft["completed"]> = input.completed && typeof input.completed === "object"
    ? input.completed as Partial<QuickStartDraft["completed"]> : {};
  const listingInput = completedInput.listings && typeof completedInput.listings === "object" ? completedInput.listings : {};
  const rawRequestKeys = input.requestKeys && typeof input.requestKeys === "object" ? input.requestKeys as Record<string, unknown> : {};
  const requestKeys: QuickStartDraft["requestKeys"] = {};
  for (const key of ["location", "equipment", "company"] as const) {
    const value = rawRequestKeys[key];
    if (typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) requestKeys[key] = value;
  }
  return {
    version: 2,
    step: typeof input.step === "string" && validScreenSet.has(input.step) ? input.step as QuickStartScreen : "name",
    intents,
    name: typeof input.name === "string" ? input.name.slice(0, 120) : "",
    personCity: typeof input.personCity === "string" ? input.personCity.slice(0, 100) : "",
    talentIntro: typeof input.talentIntro === "string" ? input.talentIntro.slice(0, 1200) : "",
    sections,
    completed: {
      profile: completedInput.profile === true,
      listings: {
        ...(typeof listingInput.location === "string" ? { location: listingInput.location.slice(0, 80) } : {}),
        ...(typeof listingInput.equipment === "string" ? { equipment: listingInput.equipment.slice(0, 80) } : {}),
      },
      ...(typeof completedInput.company === "string" ? { company: completedInput.company.slice(0, 80) } : {}),
    },
    requestKeys,
  };
}

export type QuickStartScreenDefinition = { id: QuickStartScreen; intent?: QuickStartIntent; optional?: boolean };

export function buildQuickStartScreens(draft: QuickStartDraft): QuickStartScreenDefinition[] {
  const screens: QuickStartScreenDefinition[] = [{ id: "name" }, { id: "goals" }];
  let personCityAdded = false;
  for (const intent of draft.intents) {
    if (intent === "search") continue;
    if (intent === "crew") {
      screens.push({ id: "crew-departments", intent }, { id: "crew-roles", intent });
      if (!personCityAdded) { screens.push({ id: "person-city", intent }); personCityAdded = true; }
    } else if (intent === "talent") {
      screens.push({ id: "talent-roles", intent });
      if (!personCityAdded) { screens.push({ id: "person-city", intent }); personCityAdded = true; }
      screens.push({ id: "talent-intro", intent, optional: true });
    } else if (intent === "location") {
      screens.push({ id: "location-category", intent }, { id: "location-details", intent }, { id: "location-photo", intent, optional: true }, { id: "location-price", intent, optional: true });
    } else if (intent === "equipment") {
      screens.push({ id: "equipment-category", intent }, { id: "equipment-details", intent }, { id: "equipment-photo", intent, optional: true }, { id: "equipment-price", intent, optional: true });
    } else if (intent === "company") {
      screens.push({ id: "company-details", intent }, { id: "company-photo", intent, optional: true });
    }
  }
  screens.push({ id: "review" });
  return screens;
}

export function getFirstScreenForIntent(draft: QuickStartDraft, intent: QuickStartIntent): QuickStartScreen {
  return buildQuickStartScreens(draft).find((screen) => screen.intent === intent)?.id ?? "goals";
}

function termsFor(item: QuickStartRole): string[] {
  const department = departmentById.get(item.departmentId);
  const terms = department ? getDepartmentRoleSearchTerms(department, item.role) : [item.role];
  return item.departmentId === "grip" ? [...new Set([...terms, ...gripSearchTerms(item.role)])] : terms;
}

export function findQuickStartRoles(query: string, limit = 18, departmentIds?: readonly string[]): QuickStartRole[] {
  const needle = normalizeOccupation(query.trim());
  if (!needle) return [];
  const allowed = departmentIds ? new Set(departmentIds) : null;
  return roleRecords
    .filter((item) => !allowed || allowed.has(item.departmentId))
    .map((item) => {
      const terms = termsFor(item).map(normalizeOccupation);
      const exact = terms.some((term) => term === needle);
      const starts = terms.some((term) => term.startsWith(needle));
      const matches = exact || starts || terms.some((term) => term.includes(needle) || (needle.length >= 4 && needle.includes(term)));
      return { item, matches, rank: exact ? 0 : starts ? 1 : 2 };
    })
    .filter((result) => result.matches)
    .sort((a, b) => a.rank - b.rank || a.item.role.localeCompare(b.item.role, "de") || a.item.departmentLabel.localeCompare(b.item.departmentLabel, "de"))
    .slice(0, Math.max(1, limit))
    .map(({ item }) => item);
}

export function getQuickStartProfileTypes(departmentId: string, role: string): ProfileType[] {
  return getProfileTypesForDepartment(departmentId, role ? [role] : []);
}

export function getQuickStartProfileTypesForRoles(roles: readonly QuickStartRoleSelection[]): ProfileType[] {
  const types = new Set<ProfileType>();
  const departmentIds = [...new Set(roles.map((role) => role.departmentId))];
  for (const departmentId of departmentIds) {
    const selectedRoles = roles.filter((role) => role.departmentId === departmentId).map((role) => role.role);
    for (const type of getProfileTypesForDepartment(departmentId, selectedRoles)) types.add(type);
  }
  return [...types];
}

export type QuickStartValidation = { field: string; message: string };

export function validateQuickStartScreen(draft: QuickStartDraft, screen: QuickStartScreen): QuickStartValidation | null {
  if (screen === "name" && !draft.name.trim()) return { field: "name", message: "Wie dürfen wir dich nennen? Bitte gib deinen Namen ein." };
  if (screen === "goals" && draft.intents.length === 0) return { field: "goals", message: "Wähle mindestens einen Bereich aus, damit wir dich passend weiterführen können." };
  if (screen === "crew-departments" && !(draft.sections.crew?.departmentIds.length)) return { field: "crew-departments", message: "Wähle mindestens ein Gewerk aus." };
  if (screen === "crew-roles" && !(draft.sections.crew?.roles.length)) return { field: "crew-roles", message: "Wähle mindestens eine Tätigkeit aus." };
  if (screen === "talent-roles" && !(draft.sections.talent?.roles.length)) return { field: "talent-roles", message: "Wähle mindestens eine passende Tätigkeit aus." };
  if (screen === "person-city" && !draft.personCity.trim()) return { field: "personCity", message: "Bitte gib eine Stadt oder Region an." };
  if (screen === "location-category" && !QUICK_START_CATEGORIES.location.some((item) => item.value === draft.sections.location?.category)) return { field: "location-category", message: "Wähle eine passende Art der Location aus." };
  if (screen === "equipment-category" && !QUICK_START_CATEGORIES.equipment.some((item) => item.value === draft.sections.equipment?.category)) return { field: "equipment-category", message: "Wähle aus, welche Art von Dingen du anbietest." };
  if (screen === "location-details" || screen === "equipment-details") {
    const intent = screen.startsWith("location") ? "location" : "equipment";
    const section = draft.sections[intent];
    if (!section?.title.trim()) return { field: `${intent}-title`, message: "Bitte gib deinem Angebot einen kurzen Namen." };
    if (!section.city.trim()) return { field: `${intent}-city`, message: "Bitte gib die Stadt oder Region an." };
  }
  if (screen === "location-price" || screen === "equipment-price") {
    const intent = screen.startsWith("location") ? "location" : "equipment";
    const section = draft.sections[intent];
    if (section && !section.priceOnRequest && (!section.price.trim() || !Number.isFinite(Number(section.price)) || Number(section.price) < 0)) {
      return { field: `${intent}-price`, message: "Gib einen gültigen Preis in Euro an oder wähle ‚Preis auf Anfrage‘." };
    }
  }
  if (screen === "company-details") {
    const company = draft.sections.company;
    if (!company?.title.trim()) return { field: "company-title", message: "Bitte gib den Namen deiner Firma ein." };
    if (!company.city.trim()) return { field: "company-city", message: "Bitte gib den Firmenstandort an." };
  }
  return null;
}

export function validateQuickStartDraft(draft: QuickStartDraft): QuickStartValidation | null {
  for (const screen of buildQuickStartScreens(draft)) {
    if (screen.id === "review" || screen.optional) continue;
    const validation = validateQuickStartScreen(draft, screen.id);
    if (validation) return validation;
  }
  return null;
}
