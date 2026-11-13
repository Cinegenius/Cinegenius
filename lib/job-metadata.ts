/** Read the application's existing metadata header without rewriting the member's description. */
export function parseJobDescription(raw: string): {
  roleLabel?: string; company?: string; projectType?: string; shootDates?: string;
  urgent?: boolean; payType?: string; contentWarnings: string[]; description: string;
} {
  const paragraphs = raw.split("\n\n");
  if (paragraphs.length < 2 || !/^(?:Rolle|Produktion|Typ|Projekttyp|Drehtage|Vergütung): /.test(paragraphs[0])) return { contentWarnings: [], description: raw };
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

export const JOB_EMPLOYMENT_TYPES = ["freelance", "festanstellung", "praktikum"] as const;
export type JobEmployment = typeof JOB_EMPLOYMENT_TYPES[number];
export type JobSchedule = { employmentType: JobEmployment | ""; startDate: string; endDate: string };
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function jobSchedule(value: unknown): JobSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["employmentType", "startDate", "endDate"].includes(key))) return null;
  const employmentType = row.employmentType ?? "", startDate = row.startDate ?? "", endDate = row.endDate ?? "";
  if (employmentType !== "" && !JOB_EMPLOYMENT_TYPES.includes(employmentType as JobEmployment)) return null;
  if ((startDate !== "" && !validDate(startDate)) || (endDate !== "" && !validDate(endDate)) || (endDate && (!startDate || String(endDate) < String(startDate)))) return null;
  return { employmentType: employmentType as JobEmployment | "", startDate: String(startDate), endDate: String(endDate) };
}

export type BrowseJob = {
  id: string; title: string; location: string; description?: string; category?: string;
  price?: number | null; createdAt?: string | null; schedule?: JobSchedule | null;
  company?: string; projectType?: string; shootDates?: string; urgent?: boolean; payType?: string;
  roleLabel?: string; jobType?: JobEmployment; ownerId?: string; ownerName?: string;
  rate?: string; tags?: string[]; posted?: string; isReal?: boolean;
};

export function jobFacts(job: BrowseJob) {
  const parsed = parseJobDescription(job.description ?? "");
  return { ...job, ...parsed, company: parsed.company ?? job.company ?? "", projectType: parsed.projectType ?? job.projectType ?? "",
    roleLabel: parsed.roleLabel ?? job.roleLabel ?? "", shootDates: parsed.shootDates ?? job.shootDates ?? "",
    payType: parsed.payType ?? job.payType ?? "", urgent: parsed.urgent ?? job.urgent ?? false,
    jobType: job.schedule?.employmentType || job.jobType || "" };
}

export function jobRateLabel(job: BrowseJob, translate: (key: string) => string, locale: string): string {
  const pay = canonicalJobPayType(jobFacts(job).payType);
  if (pay && pay !== "Paid") return jobPayLabel(pay, translate);
  if (typeof job.price === "number" && Number.isFinite(job.price) && job.price > 0) return `${new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(job.price)}${translate("common.perDay")}`;
  return pay === "Paid" ? `${jobPayLabel(pay, translate)} · ${translate("common.byArrangement")}` : translate("common.byArrangement");
}

export function jobDateLabel(job: BrowseJob, locale: string): string {
  const schedule = job.schedule;
  if (!schedule?.startDate) return jobFacts(job).shootDates;
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  return schedule.endDate && schedule.endDate !== schedule.startDate
    ? dates.formatRange(new Date(schedule.startDate), new Date(schedule.endDate)) : dates.format(new Date(schedule.startDate));
}

export function jobRecord(row: Record<string, unknown>): BrowseJob {
  return { id: String(row.id), title: String(row.title ?? ""), location: String(row.city ?? ""),
    description: String(row.description ?? ""), category: String(row.category ?? ""),
    price: typeof row.price === "number" ? row.price : null, createdAt: typeof row.created_at === "string" ? row.created_at : null,
    schedule: jobSchedule(row.job), ownerId: typeof row.user_id === "string" ? row.user_id : undefined, isReal: true };
}
