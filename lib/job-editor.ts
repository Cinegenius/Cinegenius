import { jobSchedule, parseJobDescription, type JobSchedule } from "./job-metadata";
export type JobEdit = JobSchedule & { roleLabel: string; company: string; projectType: string; payType: string; urgent: boolean; legacyDates: string; contentWarnings: string[] };
export function jobEditValue(description: string, metadata?: Record<string, unknown> | null): JobEdit {
  const parsed = parseJobDescription(description), schedule = jobSchedule(metadata?.job);
  return { roleLabel: parsed.roleLabel ?? "", company: parsed.company ?? "", projectType: parsed.projectType ?? "", payType: parsed.payType ?? "", urgent: parsed.urgent ?? false,
    legacyDates: parsed.shootDates ?? "", contentWarnings: parsed.contentWarnings, employmentType: schedule?.employmentType ?? "", startDate: schedule?.startDate ?? "", endDate: schedule?.endDate ?? "" };
}
export function jobEditDescription(value: JobEdit, description: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const dates = value.startDate ? value.endDate ? formatter.formatRange(new Date(value.startDate), new Date(value.endDate)) : formatter.format(new Date(value.startDate)) : value.legacyDates;
  const header = [value.roleLabel && `Rolle: ${value.roleLabel}`, value.company && `Produktion: ${value.company}`, value.projectType && `Typ: ${value.projectType}`, dates && `Drehtage: ${dates}`, value.payType && `Vergütung: ${value.payType}`, value.urgent && "⚡ Dringend", value.contentWarnings.length && `Inhalt: ${value.contentWarnings.join(", ")}`].filter(Boolean).join(" · ");
  return header ? `${header}\n\n${description}` : description;
}
