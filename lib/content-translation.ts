import { isAppLocale, type AppLocale } from "@/lib/i18n/locales";
import { maskNewsDates } from "@/lib/news-translation";

export const TRANSLATION_KINDS = ["news", "organization", "listing", "company", "profile", "project", "community", "reply", "service", "person"] as const;
export type TranslationKind = typeof TRANSLATION_KINDS[number];
export type ContentReference = { kind: TranslationKind; id: string };
export type TranslationFields = Record<string, string>;
export type TranslationSource = { fields: TranslationFields; names: string[]; policy?: "news-v2" };
export type ContentTranslation = ContentReference & {
  locale: AppLocale;
  fingerprint: string;
  fields: TranslationFields;
  /** Exact original field values bind the response to the currently rendered revision. */
  originals: TranslationFields;
  status: "translated" | "original" | "pending" | "unavailable";
};
export const TRANSLATABLE_FIELDS: Record<TranslationKind, readonly string[]> = {
  news: ["title", "summary", "description", ...Array.from({length: 8}, (_, index) => [`image_${index}_caption`, `image_${index}_altText`]).flat()], organization: ["description"],
  listing: ["title", "description", "access_notes", "availability_notes", "special_skills"],
  company: ["description", "tagline", "bio_short", "usp"], profile: ["bio", "tagline"],
  project: ["description", "logline", "synopsis"], community: ["title", "body"], reply: ["body"],
  service: ["title", "description", "price_note"], person: ["bio"],
};
export const MAX_TRANSLATION_BATCH = 3;
export const MAX_TRANSLATION_CHARACTERS = 24000;
export const contentReferenceKey = (ref: ContentReference) => `${ref.kind}:${ref.id}`;
export function isContentReference(value: unknown): value is ContentReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!(TRANSLATION_KINDS as readonly unknown[]).includes(item.kind) || typeof item.id !== "string") return false;
  return item.kind === "profile" ? /^user_[A-Za-z0-9]{1,120}$/.test(item.id)
    : /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(item.id);
}
export function translationRequest(value: unknown): { locale: AppLocale; items: ContentReference[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!isAppLocale(input.locale) || !Array.isArray(input.items) || !input.items.length || input.items.length > MAX_TRANSLATION_BATCH || !input.items.every(isContentReference)) return null;
  return {locale: input.locale, items: [...new Map(input.items.map(item => [contentReferenceKey(item), {kind: item.kind, id: item.id}])).values()]};
}
export function publicTranslationFields(kind: TranslationKind, value: Record<string, unknown>): TranslationFields {
  const fields: TranslationFields = {};
  // Only public descriptive image prose enters the existing translation cache.
  // Original titles, creators, credits, URLs and license statements stay exact.
  if (kind === "news") {
    const gallery = Array.isArray(value.image_gallery) ? value.image_gallery.slice(0, 8) : [];
    const prose: Record<string, unknown> = {};
    gallery.forEach((image, index) => {
      if (!image || typeof image !== "object") return;
      for (const field of ["caption", "altText"] as const) {
        if (typeof image[field] === "string" && image[field].length <= (field === "caption" ? 800 : 300)) prose[`image_${index}_${field}`] = image[field];
      }
    });
    value = {...value, ...prose};
  }
  let length = 0;
  for (const key of TRANSLATABLE_FIELDS[kind]) {
    const text = value[key];
    if (typeof text !== "string" || !text.trim()) continue;
    length += text.length;
    if (text.length > 20000 || length > MAX_TRANSLATION_CHARACTERS || text.includes("[[CG_LOCK_")) throw new Error("content_limit");
    fields[key] = text;
  }
  return fields;
}
const LOCKS = /\[\[CG_LOCK_[^\]]+\]\]/g;
const FACTS = /https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d ()/-]{6,}\d)|\d+(?:[.,:/–—-]\d+)*(?:\s*(?:%|€|EUR|USD|CHF|Uhr))?/giu;
/** Structured names, links and numeric/contact facts never go to the provider unmasked. */
export function protectTranslationFields(fields: TranslationFields, namespace: string, names: readonly string[] = [], newsLocale?: AppLocale) {
  const tokens = new Map<string, string>();
  const escapedNames = [...new Set(names.filter(name => name.trim().length >= 2))].sort((a,b) => b.length-a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const namesPattern = escapedNames.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${escapedNames.join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  const mask = (original: string) => { const token = `[[CG_LOCK_${namespace}_${tokens.size}]]`; tokens.set(token, original); return token; };
  const protectedFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    // Process original segments only: do not mask the numeric suffixes of our own tokens.
    const text = namesPattern ? value.replace(namesPattern, mask) : value;
    const dated = newsLocale ? text.split(/(\[\[CG_LOCK_[^\]]+\]\])/g).map(part => part.startsWith("[[CG_LOCK_") ? part : maskNewsDates(part, newsLocale, mask)).join("") : text;
    return [key, dated.split(/(\[\[CG_LOCK_[^\]]+\]\])/g).map(part => part.startsWith("[[CG_LOCK_") ? part : part.replace(FACTS, mask)).join("")];
  }));
  return {fields: protectedFields, tokens};
}
export function validateTranslationFields(value: unknown, original: TranslationFields): value is TranslationFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(fields).sort()) === JSON.stringify(Object.keys(original).sort()) && Object.keys(original).every(key =>
    typeof fields[key] === "string" && fields[key].trim().length > 0 && fields[key].length <= Math.max(4000, original[key].length * 4));
}
export function restoreTranslationFields(value: unknown, protectedFields: TranslationFields, tokens: Map<string, string>): TranslationFields {
  if (!validateTranslationFields(value, protectedFields)) throw new Error("invalid_translation");
  const restored: TranslationFields = {};
  for (const key of Object.keys(protectedFields)) {
    let text = value[key];
    const expected = protectedFields[key].match(LOCKS) ?? [];
    const actual = text.match(LOCKS) ?? [];
    if (JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())) throw new Error("changed_facts");
    const prose = text.replace(LOCKS, "");
    if (/\d|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(prose) || /<\/?[a-z][^>]*>/i.test(prose)) throw new Error("invented_facts");
    for (const token of actual) {
      const original = tokens.get(token);
      if (original === undefined) throw new Error("changed_facts");
      text = text.replace(token, () => original);
    }
    restored[key] = text;
  }
  return restored;
}
