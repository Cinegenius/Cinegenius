import { createTranslator } from "next-intl";
import { parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import notificationIndex from "./notification-index.json" with { type: "json" };

type Values = Record<string, string | number>;
type Translate = (key: string, values?: Values) => string;
// Immutable version-1 fallback templates also validate archived structured records after display-copy edits.
const source = Object.fromEntries(Object.entries(notificationIndex).map(([key, entry]) => [key, entry.template]));
const canonical = createTranslator({ locale: "de", messages: { NotificationCopy: source }, namespace: "NotificationCopy", onError(error) { throw error; } });

/** Keep existing, human-readable storage compatible. Presentation always uses the reader's catalogue. */
export function canonicalNotification(key: string, values?: Values): string {
  if (!Object.hasOwn(source, key)) throw new Error("unknown_notification_template");
  return canonical(key, values);
}

export type NotificationLocalization = {
  version: 1;
  title?: { key: string; values?: Values };
  body?: { key: string; values?: Values };
};

/** Store stable template keys and opaque interpolation values separately from fallback copy. */
export function localizedNotification(fields: Omit<NotificationLocalization, "version">) {
  const content: Partial<Record<"title" | "body", string>> = {};
  for (const field of ["title", "body"] as const) {
    const copy = fields[field];
    if (copy) content[field] = canonicalNotification(copy.key, copy.values);
  }
  return { ...content, localization: { version: 1 as const, ...fields } };
}

function structuredCopy(metadata: unknown, field: "title" | "body", type: string, original: string): {key: string; values: Values} | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const envelope = metadata as Record<string, unknown>;
  const copy = envelope[field];
  if (envelope.version !== 1 || !copy || typeof copy !== "object" || Array.isArray(copy)) return null;
  const item = copy as Record<string, unknown>;
  if (typeof item.key !== "string" || !Object.hasOwn(notificationIndex, item.key)) return null;
  const spec = notificationIndex[item.key as keyof typeof notificationIndex];
  if (spec.field !== field || !(spec.types as string[]).includes(type)) return null;
  if (item.values !== undefined && (!item.values || typeof item.values !== "object" || Array.isArray(item.values))) return null;
  const values = item.values as Values | undefined ?? {};
  if (Object.keys(values).length > 12 || Object.values(values).some(value => typeof value !== "string" && typeof value !== "number" || typeof value === "number" && !Number.isFinite(value) || typeof value === "string" && value.length > 16_000)) return null;
  try {
    if (canonicalNotification(item.key, values) !== original) return null;
    return { key: item.key, values };
  } catch { return null; }
}

type Capture = { name: string; numeric?: boolean };
type Variant = { pattern: string; captures: Capture[]; fixed: Values };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const empty = (): Variant => ({ pattern: "", captures: [], fixed: {} });
function variants(nodes: MessageFormatElement[], plural?: string): Variant[] {
  let result = [empty()];
  for (const node of nodes) {
    let next: Variant[];
    if (node.type === 0) next = [{ ...empty(), pattern: escape(node.value) }];
    else if (node.type === 1) next = [{ ...empty(), pattern: "([\\s\\S]*?)", captures: [{ name: node.value }] }];
    else if (node.type === 7 && plural) next = [{ ...empty(), pattern: "(-?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+))", captures: [{ name: plural, numeric: true }] }];
    else if (node.type === 6) {
      next = Object.entries(node.options).flatMap(([choice, option]) => variants(option.value, node.value).map(part => ({
        ...part, fixed: { ...(choice.startsWith("=") ? { [node.value]: Number(choice.slice(1)) } : choice === "one" ? { [node.value]: 1 } : {}), ...part.fixed },
      })));
    } else return [];
    result = result.flatMap(prefix => next.map(suffix => ({
      pattern: prefix.pattern + suffix.pattern, captures: [...prefix.captures, ...suffix.captures], fixed: { ...prefix.fixed, ...suffix.fixed },
    })));
  }
  return result;
}
function numericArguments(nodes: MessageFormatElement[], names = new Set<string>()) {
  for (const node of nodes) {
    if (node.type === 6) names.add(node.value);
    if (node.type === 5 || node.type === 6) for (const option of Object.values(node.options)) numericArguments(option.value, names);
  }
  return names;
}
const rules = Object.entries(notificationIndex as Record<string, {field: string; types: string[]; legacy: string; legacyVariants?: string[]}>).flatMap(([key, entry]) => {
  const ast = parse(source[key]);
  const numbers = numericArguments(ast);
  const templates = [...variants(ast), ...[entry.legacy, ...(entry.legacyVariants ?? [])].filter(template => template !== source[key]).flatMap(template => variants(parse(template)))];
  return templates.map(template => ({ key, field: entry.field as "title" | "body", types: entry.types as string[], numbers, ...template, regex: new RegExp("^" + template.pattern + "$"), greedy: new RegExp("^" + template.pattern.replaceAll("([\\s\\S]*?)", "([\\s\\S]*)") + "$") }));
});

/** Recognize only documented application templates. Opaque values and unknown/admin-written copy are preserved. */
export function localizeNotification<T extends { type: string; title: string; body: string; localization?: unknown }>(notification: T, translate: Translate): T {
  const result = { ...notification };
  for (const field of ["title", "body"] as const) {
    const text = notification[field];
    if (typeof text !== "string" || text.length > 16_000) continue;
    const structured = structuredCopy(notification.localization, field, notification.type, text);
    if (structured) { result[field] = translate(structured.key, structured.values); continue; }
    if (notification.localization && typeof notification.localization === "object" && field in notification.localization) continue;
    for (const rule of rules) {
      if (rule.field !== field || !rule.types.includes(notification.type)) continue;
      const match = rule.regex.exec(text);
      if (!match) continue;
      const alternate = rule.greedy.exec(text);
      // Multiple valid splits can move words from a member/company name into another value.
      if (!alternate || JSON.stringify(match.slice(1)) !== JSON.stringify(alternate.slice(1))) continue;
      const values = { ...rule.fixed };
      let valid = true;
      rule.captures.forEach(({ name, numeric }, index) => {
        const value = match[index + 1];
        if (name === "legacySuffix") { if (value !== "" && value !== "e" && value !== "en") valid = false; return; }
        if (numeric || rule.numbers.has(name)) {
          const number = Number(value.replaceAll(".", ""));
          if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)$/.test(value) || !Number.isSafeInteger(number)) valid = false;
          else values[name] = number;
        } else values[name] = value;
      });
      if (!valid) continue;
      result[field] = translate(rule.key, values);
      break;
    }
  }
  return result;
}
