/** Read the application's existing metadata header without rewriting the member's description. */
export function parseJobDescription(raw: string): {
  roleLabel?: string; company?: string; projectType?: string; shootDates?: string;
  urgent?: boolean; payType?: string; contentWarnings: string[]; description: string;
} {
  const paragraphs = raw.split("\n\n");
  if (paragraphs.length < 2) return { contentWarnings: [], description: raw };
  const header = paragraphs[0];
  const warnings = header.match(/Inhalt: ([^·\n]+)/)?.[1]?.trim();
  return {
    roleLabel: header.match(/Rolle: ([^·\n]+)/)?.[1]?.trim(),
    company: header.match(/Produktion: ([^·\n]+)/)?.[1]?.trim(),
    projectType: header.match(/Typ: ([^·\n]+)/)?.[1]?.trim() ?? header.match(/Projekttyp: ([^·\n]+)/)?.[1]?.trim(),
    shootDates: header.match(/Drehtage: ([^·\n]+)/)?.[1]?.trim(),
    urgent: header.includes("⚡ Dringend"),
    payType: header.match(/Vergütung: ([^·\n]+)/)?.[1]?.trim(),
    contentWarnings: warnings ? warnings.split(",").map(value => value.trim()).filter(Boolean) : [],
    description: paragraphs.slice(1).join("\n\n"),
  };
}

/** Preserve the existing filter/URL IDs and explicitly recognize values written by the job form. */
export const JOB_PAY_FILTER_VALUES = ["Paid", "Deferred", "Ehrenamtlich", "Expenses Only"] as const;

const PAY_FILTER_ALIASES: Readonly<Record<string, string>> = {
  Paid: "Paid", Bezahlt: "Paid",
  Deferred: "Deferred", "Deferred Pay": "Deferred",
  Ehrenamtlich: "Ehrenamtlich", "Ehrenamtlich / Übung": "Ehrenamtlich",
  "Expenses Only": "Expenses Only", "Spesen & Reise": "Expenses Only",
};

export function canonicalJobPayType(value: string): string {
  return Object.hasOwn(PAY_FILTER_ALIASES, value) ? PAY_FILTER_ALIASES[value] : value;
}

const PAY_LABEL_KEYS: Readonly<Record<string, string>> = {
  Paid: "Ui.text_057b27bdbc5519", Bezahlt: "Ui.text_057b27bdbc5519",
  Deferred: "Ui.text_6bd179a0682616", "Deferred Pay": "Ui.text_6bd179a0682616",
  Ehrenamtlich: "jobs.payVoluntary", "Ehrenamtlich / Übung": "Ui.text_7c904bff597cd2",
  "Expenses Only": "Ui.text_ab1fbdf891ea96", "Spesen & Reise": "Ui.text_ab1fbdf891ea96",
};

export function jobPayLabel(value: string, translate: (key: string) => string): string {
  return Object.hasOwn(PAY_LABEL_KEYS, value) ? translate(PAY_LABEL_KEYS[value]) : value;
}
