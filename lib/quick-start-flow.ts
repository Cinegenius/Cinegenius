import { primaryOccupationForPositions, occupationReference, type PrimaryOccupation } from "./primary-occupation";
import { departments, getDepartmentRoleSearchTerms, getProfileTypesForDepartment } from "@/lib/departments";
import { gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";
import type { ProfileType } from "@/lib/profile-types";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { CATERING_COMPANY_CATEGORY, normalizeCateringCompanyDetails, type CateringCompanyDetails } from "@/lib/catering-taxonomy";

export const QUICK_START_INTENTS = ["crew", "talent", "location", "equipment", "company", "search"] as const;
export type QuickStartIntent = typeof QUICK_START_INTENTS[number];
export type QuickStartProviderIntent = Exclude<QuickStartIntent, "search">;

/** The registration wizard always has the same six named steps. Intent-specific
 * detail panels are subviews within steps 4 and 5, not extra progress steps. */
export const QUICK_START_SCREENS = ["name", "location", "goals", "details", "intro", "review"] as const;
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
  priceNegotiable?: boolean;
  departmentIds: string[];
  roles: QuickStartRoleSelection[];
  categoryIds: string[];
  contactEmail: string;
  contactPhone: string;
  website: string;
  cateringDetails: CateringCompanyDetails;
};
export type QuickStartDraft = {
  version: 3;
  welcomeAcknowledged?: boolean;
  step: QuickStartScreen;
  intents: QuickStartIntent[];
  name: string;
  personCity: string;
  personCountry: string;
  activeIntent: QuickStartIntent | null;
  talentIntro: string;
  primaryOccupation?: PrimaryOccupation | null;
  sections: Partial<Record<QuickStartIntent, QuickStartIntentData>>;
  completed: { profile: boolean; listings: Partial<Record<"location" | "equipment", string>>; company?: string };
  requestKeys: Partial<Record<"location" | "equipment" | "company", string>>;
};

export const START_QUICK_START_DRAFT: QuickStartDraft = {
  version: 3,
  welcomeAcknowledged: false,
  step: "name",
  intents: [],
  name: "",
  personCity: "",
  personCountry: "Deutschland",
  activeIntent: null,
  talentIntro: "",
  sections: {},
  completed: { profile: false, listings: {} },
  requestKeys: {},
};

export const QUICK_START_INTENT_LABELS: Record<QuickStartIntent, string> = {
  crew: "Als Crewmitglied arbeiten",
  talent: "Vor der Kamera mitmachen: Schauspiel, Model oder Komparserie",
  location: "Eine Location oder ein Studio anbieten",
  equipment: "Etwas im Marktplatz anbieten: Equipment, Fahrzeuge oder Requisiten",
  company: "Eine Firma oder Dienstleistung anbieten, zum Beispiel Catering",
  search: "Für ein Projekt suchen oder Unterstützung finden",
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
  company: COMPANY_CATEGORIES.map(({ label, id, examples }) => ({ label, value: id, example: examples })),
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
  return { category: "", title: "", city: "", description: "", imageUrl: "", price: "", priceOnRequest: true, departmentIds: [], roles: [], categoryIds: [], contactEmail: "", contactPhone: "", website: "", cateringDetails: { serviceTypes: [], serviceAreas: "", capacity: null, dietaryOptions: [], mobileEquipment: [] } };
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
    priceNegotiable: input.priceNegotiable === true,
    departmentIds,
    roles,
    categoryIds: Array.isArray(input.categoryIds)
      ? [...new Set(input.categoryIds.filter((id): id is string => typeof id === "string" && COMPANY_CATEGORIES.some((category) => category.id === id)))].slice(0, COMPANY_CATEGORIES.length)
      : [],
    contactEmail: typeof input.contactEmail === "string" ? input.contactEmail.slice(0, 200) : "",
    contactPhone: typeof input.contactPhone === "string" ? input.contactPhone.slice(0, 80) : "",
    website: typeof input.website === "string" ? input.website.slice(0, 300) : "",
    cateringDetails: normalizeCateringCompanyDetails(input.cateringDetails),
  };
}

function isQuickStartIntent(value: unknown): value is QuickStartIntent {
  return typeof value === "string" && validIntentSet.has(value);
}

export function normalizeQuickStartDraft(value: unknown): QuickStartDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return START_QUICK_START_DRAFT;
  const input = value as Partial<QuickStartDraft> & Record<string, unknown>;
  const inputVersion = (input as Record<string, unknown>).version;

  // Migrate the older single-intent draft without discarding its entries.
  if (inputVersion !== 2 && inputVersion !== 3) {
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
    const step: QuickStartScreen = legacyStep === 3 ? "review" : "name";
    return {
      ...START_QUICK_START_DRAFT,
      welcomeAcknowledged: true,
      step,
      intents: intent ? [intent] : [],
      name: typeof input.name === "string" ? input.name.slice(0, 120) : "",
      personCity: intent === "talent" ? legacyData.city : "",
      activeIntent: intent,
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
  const rawStep = (input as Record<string, unknown>).step;
  const legacyStep = typeof rawStep === "string" ? rawStep : "name";
  const migratedStep: QuickStartScreen = validScreenSet.has(legacyStep)
    ? legacyStep as QuickStartScreen
    : legacyStep === "goals" ? "goals"
      : legacyStep === "person-city" ? "location"
        : legacyStep === "review" ? "review"
          : ["talent-intro", "location-photo", "location-price", "equipment-photo", "equipment-price", "company-photo", "company-catering"].includes(legacyStep) ? "intro"
            : ["crew-departments", "crew-roles", "talent-roles", "location-category", "location-details", "equipment-category", "equipment-details", "company-details", "company-categories"].includes(legacyStep) ? "details"
              : "name";
  const rawActiveIntent = input.activeIntent;
  const oldStepIntent = legacyStep.startsWith("crew-") ? "crew"
    : legacyStep.startsWith("talent-") ? "talent"
      : legacyStep.startsWith("location-") ? "location"
        : legacyStep.startsWith("equipment-") ? "equipment"
          : legacyStep.startsWith("company-") ? "company" : null;
  const activeIntent = isQuickStartIntent(rawActiveIntent)
    ? rawActiveIntent
    : oldStepIntent && intents.includes(oldStepIntent) ? oldStepIntent
      : intents.find((intent) => intent !== "search") ?? null;
  return {
    version: 3,
    welcomeAcknowledged: input.welcomeAcknowledged !== false,
    step: migratedStep,
    intents,
    name: typeof input.name === "string" ? input.name.slice(0, 120) : "",
    personCity: typeof input.personCity === "string" ? input.personCity.slice(0, 100) : "",
    personCountry: typeof input.personCountry === "string" ? input.personCountry.slice(0, 100) : "Deutschland",
    activeIntent,
    talentIntro: typeof input.talentIntro === "string" ? input.talentIntro.slice(0, 1200) : "",
    sections,
    primaryOccupation: occupationReference(primaryOccupationForPositions(input.primaryOccupation, [...(sections.crew?.roles ?? []), ...(sections.talent?.roles ?? [])].map(item=>item.role))),
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
  void draft;
  return QUICK_START_SCREENS.map((id) => ({ id, optional: id === "intro" }));
}

/** A person may choose both crew and talent, but their profile photo and short
 * introduction are shared. Keep one personal-profile panel in step five. */
export function getQuickStartIntroIntents(intents: readonly QuickStartIntent[]): QuickStartIntent[] {
  const selected = new Set(intents);
  const result: QuickStartIntent[] = [];
  if (selected.has("crew")) result.push("crew");
  else if (selected.has("talent")) result.push("talent");
  for (const intent of intents) {
    if (intent !== "crew" && intent !== "talent" && intent !== "search" && !result.includes(intent)) result.push(intent);
  }
  return result;
}

export function getFirstScreenForIntent(draft: QuickStartDraft, intent: QuickStartIntent): QuickStartScreen {
  return draft.intents.includes(intent) ? "details" : "goals";
}

function termsFor(item: QuickStartRole): string[] {
  const department = departmentById.get(item.departmentId);
  const terms = department ? getDepartmentRoleSearchTerms(department, item.role) : [item.role];
  return item.departmentId === "grip" ? [...new Set([...terms, ...gripSearchTerms(item.role)])] : terms;
}

export function findQuickStartRoles(query: string, limit = 18, departmentIds?: readonly string[]): QuickStartRole[] {
  const needle = normalizeOccupation(query.trim());
  if (!needle) return [];
  const cateringDepartmentSearch = ["catering", "setverpflegung"].includes(needle);
  const allowed = departmentIds ? new Set(departmentIds) : null;
  return roleRecords
    .filter((item) => !allowed || allowed.has(item.departmentId))
    .map((item) => {
      const terms = termsFor(item).map(normalizeOccupation);
      const exact = terms.some((term) => term === needle);
      const starts = terms.some((term) => term.startsWith(needle));
      const matches = (cateringDepartmentSearch && item.departmentId === CATERING_COMPANY_CATEGORY.id)
        || exact || starts || terms.some((term) => term.includes(needle) || (needle.length >= 4 && needle.includes(term)));
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

export function validateQuickStartIntentDetails(draft: QuickStartDraft, intent: QuickStartIntent): QuickStartValidation | null {
  if (intent === "search") return null;
  const section = draft.sections[intent];
  if (intent === "crew") {
    if (!section?.departmentIds.length) return { field: "crew-departments", message: "Wähle mindestens ein Gewerk aus." };
    if (!section.roles.length) return { field: "crew-roles", message: "Wähle mindestens eine passende Tätigkeit aus." };
  }
  if (intent === "talent" && !section?.roles.length) return { field: "talent-roles", message: "Wähle mindestens eine passende Tätigkeit aus." };
  if (intent === "location" || intent === "equipment") {
    const choices = QUICK_START_CATEGORIES[intent];
    if (!choices.some((item) => item.value === section?.category)) {
      return { field: `${intent}-category`, message: intent === "location" ? "Wähle eine passende Art der Location aus." : "Wähle eine passende Angebotskategorie aus." };
    }
    if (!section?.title.trim()) return { field: `${intent}-title`, message: "Bitte gib deinem Angebot einen kurzen Namen." };
    if (!section.city.trim()) return { field: `${intent}-city`, message: "Bitte gib den Standort des Angebots an." };
  }
  if (intent === "company") {
    if (!section?.title.trim()) return { field: "company-title", message: "Bitte gib den Namen deiner Firma ein." };
    if (!section.city.trim()) return { field: "company-city", message: "Bitte gib den Firmenstandort an." };
    if (!section.categoryIds.length) return { field: "company-categories", message: "Wähle mindestens eine passende Firmenkategorie aus." };
  }
  return null;
}

export function validateQuickStartScreen(draft: QuickStartDraft, screen: QuickStartScreen, activeIntent?: QuickStartIntent | null): QuickStartValidation | null {
  if (screen === "name" && !draft.name.trim()) return { field: "name", message: "Wie dürfen wir dich nennen? Bitte gib deinen Namen ein." };
  if (screen === "goals" && draft.intents.length === 0) return { field: "goals", message: "Wähle mindestens einen Bereich aus, damit wir dich passend weiterführen können." };
  if (screen === "location" && (draft.intents.includes("crew") || draft.intents.includes("talent"))) {
    if (!draft.personCity.trim()) return { field: "personCity", message: "Bitte gib deine Stadt oder Region an." };
    if (!draft.personCountry.trim()) return { field: "personCountry", message: "Bitte wähle dein Land aus." };
  }
  if (screen === "details") {
    const intent = activeIntent && draft.intents.includes(activeIntent)
      ? activeIntent
      : draft.intents.find((item) => item !== "search");
    if (intent) return validateQuickStartIntentDetails(draft, intent);
  }
  if (screen === "intro") {
    for (const intent of ["location", "equipment"] as const) {
      const section = draft.sections[intent];
      if (draft.intents.includes(intent) && section && !section.priceOnRequest && !(section.priceNegotiable && !section.price.trim()) && (!section.price.trim() || !Number.isFinite(Number(section.price)) || Number(section.price) < 0)) {
        return { field: `${intent}-price`, message: "Gib einen gültigen Preis in Euro an oder wähle ‚Preis auf Anfrage‘." };
      }
    }
  }
  return null;
}

export function validateQuickStartDraft(draft: QuickStartDraft, { requirePrimary = true } = {}): QuickStartValidation | null {
  const name = validateQuickStartScreen(draft, "name");
  if (name) return name;
  const goals = validateQuickStartScreen(draft, "goals");
  if (goals) return goals;
  const location = validateQuickStartScreen(draft, "location");
  if (location) return location;
  for (const intent of draft.intents) {
    const details = validateQuickStartIntentDetails(draft, intent);
    if (details) return details;
  }
  const personalRoles = [...(draft.sections.crew?.roles ?? []), ...(draft.sections.talent?.roles ?? [])];
  if (requirePrimary && personalRoles.length && !primaryOccupationForPositions(draft.primaryOccupation, personalRoles.map(item=>item.role))) return {field: "primaryOccupation", message: "Bitte wähle deine Haupttätigkeit aus."};
  const intro = validateQuickStartScreen(draft, "intro");
  if (intro) return intro;
  return null;
}
