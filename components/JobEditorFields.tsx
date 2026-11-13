"use client";
import { useTranslations } from "next-intl";
import RoleDropdown from "@/components/RoleDropdown";
import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import { canonicalJobPayType, jobPayLabel, JOB_PAY_FILTER_VALUES, type JobEmployment } from "@/lib/job-metadata";
import type { JobEdit } from "@/lib/job-editor";
const input = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-elevated px-3 text-base text-text-primary";
export default function JobEditorFields({ value, onChange }: { value: JobEdit; onChange: (value: JobEdit) => void }) {
  const t = useTranslations(), change = (patch: Partial<JobEdit>) => onChange({ ...value, ...patch });
  const roles = [...new Set([value.roleLabel, ...FILM_DEPARTMENTS.flatMap(dept => dept.roles.map(role => role.label))].filter(Boolean))];
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <div className="text-sm text-text-secondary"><p className="mb-1">{t("JobsRefresh.role")}</p><RoleDropdown value={value.roleLabel} onChange={roleLabel => change({ roleLabel })} options={roles} placeholder={t("JobsRefresh.role")} /></div>
    <label className="min-w-0 text-sm text-text-secondary">{t("Ui.text_d5c91f555547df")}<input maxLength={200} className={input} value={value.company} onChange={event => change({ company: event.target.value })} /></label>
    <label className="min-w-0 text-sm text-text-secondary">{t("jobs.filterProjectType")}<input maxLength={100} className={input} value={value.projectType} onChange={event => change({ projectType: event.target.value })} /></label>
    <label className="min-w-0 text-sm text-text-secondary">{t("JobsRefresh.employment")}<select className={input} value={value.employmentType} onChange={event => change({ employmentType: event.target.value as JobEmployment | "" })}><option value="">{t("JobsRefresh.unspecified")}</option>{(["freelance", "festanstellung", "praktikum"] as const).map((type, i) => <option key={type} value={type}>{t(`jobs.${["filterFreelance", "filterFulltime", "filterInternship"][i]}`)}</option>)}</select></label>
    <label className="min-w-0 text-sm text-text-secondary">{t("Ui.text_03b7919b5c9612")}<input type="date" className={input} value={value.startDate} onChange={event => change({ startDate: event.target.value })} />{!value.startDate && value.legacyDates && <span className="mt-1 block text-xs text-text-muted">{value.legacyDates}</span>}</label>
    <label className="min-w-0 text-sm text-text-secondary">{t("Ui.text_999c5a7a759bc3")}<input type="date" min={value.startDate || undefined} className={input} value={value.endDate} onChange={event => change({ endDate: event.target.value })} /></label>
    <label className="min-w-0 text-sm text-text-secondary">{t("jobs.filterPay")}<select className={input} value={canonicalJobPayType(value.payType)} onChange={event => change({ payType: event.target.value })}><option value="">{t("JobsRefresh.unspecified")}</option>{[...new Set<string>([...JOB_PAY_FILTER_VALUES, canonicalJobPayType(value.payType)].filter(Boolean))].map(pay => <option key={pay} value={pay}>{jobPayLabel(pay, t)}</option>)}</select></label>
    <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={value.urgent} onChange={event => change({ urgent: event.target.checked })} />{t("jobs.filterUrgentLabel")}</label>
  </div>;
}
