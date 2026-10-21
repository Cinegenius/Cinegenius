import { departments, getDepartmentRoleSearchTerms, getProfileTypesForDepartment } from "@/lib/departments";
import { gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";
import type { ProfileType } from "@/lib/profile-types";

export const QUICK_START_INTENTS = ["location", "equipment", "talent", "search", "company"] as const;
export type QuickStartIntent = typeof QUICK_START_INTENTS[number];
export type QuickStartDraft = {
  step: 1 | 2 | 3;
  intent: QuickStartIntent | null;
  name: string;
  city: string;
  category: string;
  title: string;
  departmentId: string;
  role: string;
};

export const START_QUICK_START_DRAFT: QuickStartDraft = {
  step: 1,
  intent: null,
  name: "",
  city: "",
  category: "",
  title: "",
  departmentId: "",
  role: "",
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

const roleRecords: QuickStartRole[] = departments.flatMap((department) =>
  department.roles.map((role) => ({ departmentId: department.id, departmentLabel: department.label, role })),
);

function searchTerms(item: QuickStartRole): string[] {
  const department = departments.find((candidate) => candidate.id === item.departmentId);
  const terms = department ? getDepartmentRoleSearchTerms(department, item.role) : [item.role];
  return item.departmentId === "grip" ? [...new Set([...terms, ...gripSearchTerms(item.role)])] : terms;
}

export function findQuickStartRoles(query: string, limit = 18): QuickStartRole[] {
  const needle = normalizeOccupation(query.trim());
  if (!needle) return [];
  return roleRecords
    .map((item) => {
      const terms = searchTerms(item).map(normalizeOccupation);
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

export function normalizeQuickStartDraft(value: unknown): QuickStartDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return START_QUICK_START_DRAFT;
  const input = value as Partial<QuickStartDraft>;
  const intent = QUICK_START_INTENTS.includes(input.intent as QuickStartIntent) ? input.intent as QuickStartIntent : null;
  const roleIsValid = roleRecords.some((item) => item.departmentId === input.departmentId && item.role === input.role);
  return {
    step: input.step === 3 ? 3 : input.step === 2 ? 2 : 1,
    intent,
    name: typeof input.name === "string" ? input.name.slice(0, 120) : "",
    city: typeof input.city === "string" ? input.city.slice(0, 100) : "",
    category: typeof input.category === "string" ? input.category.slice(0, 100) : "",
    title: typeof input.title === "string" ? input.title.slice(0, 200) : "",
    departmentId: roleIsValid ? input.departmentId! : "",
    role: roleIsValid ? input.role! : "",
  };
}

export function validateQuickStartDetails(draft: QuickStartDraft): { field: keyof QuickStartDraft; message: string } | null {
  if (!draft.intent || draft.intent === "search") return null;
  if (draft.intent === "talent") {
    if (!draft.name.trim()) return { field: "name", message: "Bitte gib den Namen an, unter dem man dich finden darf." };
    if (!draft.role || !departments.some((department) => department.id === draft.departmentId && department.roles.includes(draft.role))) {
      return { field: "role", message: "Bitte wähle eine Tätigkeit aus der Liste aus." };
    }
    if (!draft.city.trim()) return { field: "city", message: "Bitte gib deinen Wohnort oder deine Region an." };
    return null;
  }
  if (draft.intent === "company" && !draft.name.trim()) return { field: "name", message: "Bitte gib den Firmennamen an." };
  if ((draft.intent === "location" || draft.intent === "equipment")
    && !QUICK_START_CATEGORIES[draft.intent].some((item) => item.value === draft.category)) {
    return { field: "category", message: "Bitte wähle aus, was du anbieten möchtest." };
  }
  if ((draft.intent === "location" || draft.intent === "equipment") && !draft.title.trim()) {
    return { field: "title", message: "Bitte gib deinem Angebot einen kurzen Namen." };
  }
  if (!draft.city.trim()) return { field: "city", message: "Bitte gib einen Ort oder eine Stadt an." };
  return null;
}
