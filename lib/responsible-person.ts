export type ResponsiblePerson = {
  firstName: string; lastName: string; function: string; customFunction: string; public: boolean; profileName?: string;
};
export type StoredResponsiblePerson = ResponsiblePerson & { userId: string };
export const EMPTY_RESPONSIBLE_PERSON: ResponsiblePerson = { firstName: "", lastName: "", function: "", customFunction: "", public: false };
/** New forms disclose the contact name before an explicit save/submission.
 * Existing snapshots keep their original public flag, including explicit false. */
export const NEW_RESPONSIBLE_PERSON: ResponsiblePerson = { ...EMPTY_RESPONSIBLE_PERSON, public: true };
export const ACCOUNT_RESPONSIBLE_PERSON_KEY = "cinegeniusResponsiblePerson";
export function responsibleAccountName(value: unknown): { firstName: string; lastName: string } | null {
  const v = responsiblePersonDraft(value);
  const errors = responsiblePersonErrors({ ...v, profileName: undefined, function: "", customFunction: "" });
  return errors.firstName || errors.lastName ? null : { firstName: v.firstName.trim(), lastName: v.lastName.trim() };
}
export const COMPANY_RESPONSIBLE_FUNCTIONS = ["owner", "founder", "cofounder", "director", "department", "employee", "contact", "other"] as const;
export const OFFER_RESPONSIBLE_FUNCTIONS = ["propertyOwner", "operator", "management", "rental", "contact", "other"] as const;
export function responsiblePersonDraft(value: unknown): ResponsiblePerson {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: string, max: number) => typeof v[key] === "string" ? v[key].slice(0, max) : "";
  return { firstName: text("firstName", 80), lastName: text("lastName", 100), function: text("function", 30), customFunction: text("customFunction", 80), public: v.public === true, ...(typeof v.profileName === "string" && v.profileName.trim() ? { profileName: v.profileName.slice(0, 200) } : {}) };
}
export function responsiblePersonErrors(value: unknown, company = false): Record<string, string> {
  const v = responsiblePersonDraft(value);
  const errors: Record<string, string> = {};
  // Accept international names, apostrophes, hyphens and spaces. Do not split or guess names.
  const name = (s: string) => /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u.test(s.trim());
  if (!v.profileName && !name(v.firstName)) errors.firstName = "invalidFirstName";
  if (!v.profileName && !name(v.lastName)) errors.lastName = "invalidLastName";
  const functions: readonly string[] = company ? COMPANY_RESPONSIBLE_FUNCTIONS : OFFER_RESPONSIBLE_FUNCTIONS;
  if (v.function && !functions.includes(v.function)) errors.function = "invalidFunction";
  if (v.function === "other" && (!v.customFunction.trim() || /[\u0000-\u001f\u007f]/.test(v.customFunction))) errors.customFunction = "invalidFunction";
  return errors;
}
export function bindResponsiblePerson(value: unknown, userId: string): StoredResponsiblePerson {
  const v = responsiblePersonDraft(value);
  return { function: v.function, public: v.public, firstName: v.firstName.trim(), lastName: v.lastName.trim(), customFunction: v.function === "other" ? v.customFunction.trim() : "", userId };
}

/** The server re-resolves this name from the authenticated profile before saving. */
export function marketplaceResponsibleErrors(value: unknown): Record<string, string> {
  const v = responsiblePersonDraft(value);
  const errors = responsiblePersonErrors(v);
  if (v.profileName) { delete errors.firstName; delete errors.lastName; }
  return errors;
}
