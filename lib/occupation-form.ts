/** An explicit grammatical preference only; never infer it from personal attributes. */
export const OCCUPATION_FORMS = ["standard", "masculine", "feminine", "neutral"] as const;
export type OccupationForm = typeof OCCUPATION_FORMS[number];

export function isOccupationForm(value: unknown): value is OccupationForm {
  return typeof value === "string" && (OCCUPATION_FORMS as readonly string[]).includes(value);
}

export function normalizeOccupationForm(value: unknown): OccupationForm {
  return isOccupationForm(value) ? value : "standard";
}

function crewRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function occupationFormFromCrew(crew: unknown): OccupationForm {
  const value = crewRecord(crew);
  return value && Object.hasOwn(value, "occupationForm") ? normalizeOccupationForm(value.occupationForm) : "standard";
}

/** Invalid explicitly supplied values must fail before a profile write. */
export function hasInvalidOccupationForm(crew: unknown): boolean {
  const value = crewRecord(crew);
  return !!value && Object.hasOwn(value, "occupationForm") && !isOccupationForm(value.occupationForm);
}

/** Retain only this preference across older full-profile writers. Other crew
 * fields keep their existing replacement/merge behavior at the call site.
 * Explicit standard clears the override; an omitted key or null does not. */
export function preserveOccupationForm(previousCrew: unknown, nextCrew: unknown): unknown {
  const incoming = crewRecord(nextCrew);
  if (hasInvalidOccupationForm(nextCrew)) throw new TypeError("Invalid occupation form");
  const explicit = !!incoming && Object.hasOwn(incoming, "occupationForm");
  const form = explicit ? normalizeOccupationForm(incoming.occupationForm) : occupationFormFromCrew(previousCrew);
  if (incoming) {
    const result = { ...incoming };
    delete result.occupationForm;
    if (form !== "standard") result.occupationForm = form;
    return result;
  }
  if (nextCrew == null && form !== "standard") return { occupationForm: form };
  return nextCrew;
}
