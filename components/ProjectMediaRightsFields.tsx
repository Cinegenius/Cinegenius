"use client";
import { useTranslations } from "next-intl";
import { PROJECT_MEDIA_RIGHTS_BASES, type ProjectMediaRights } from "@/lib/project-media-rights";

export default function ProjectMediaRightsFields({ value, onChange, disabled = false }: { value: ProjectMediaRights; onChange: (value: ProjectMediaRights) => void; disabled?: boolean }) {
  const t = useTranslations("ProjectMediaRights");
  return <fieldset disabled={disabled} className="mt-6 space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
    <legend className="px-1 text-sm font-semibold text-text-primary">{t("title")}</legend>
    <p className="text-xs leading-6 text-text-secondary">{t("explanation")}</p>
    <label className="block text-xs font-medium text-text-secondary">{t("basis")}<select value={value.basis} onChange={event => onChange({ ...value, basis: event.target.value, confirmed: false })} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary"><option value="">{t("choose")}</option>{PROJECT_MEDIA_RIGHTS_BASES.map(basis => <option key={basis} value={basis}>{t("bases." + basis)}</option>)}</select></label>
    <label className="block text-xs font-medium text-text-secondary">{t("holder")}<input value={value.holder} maxLength={300} onChange={event => onChange({ ...value, holder: event.target.value, confirmed: false })} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /></label>
    {value.basis !== "own" && <label className="block text-xs font-medium text-text-secondary">{t("source")}<textarea value={value.source} maxLength={1000} rows={2} onChange={event => onChange({ ...value, source: event.target.value, confirmed: false })} className="mt-1 w-full rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-primary" /><span className="mt-1 block font-normal leading-5 text-text-muted">{t("sourceHint")}</span></label>}
    <label className="block text-xs font-medium text-text-secondary">{t("credit")}<input value={value.credit} maxLength={300} onChange={event => onChange({ ...value, credit: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /></label>
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6 text-text-primary"><input type="checkbox" checked={value.confirmed} onChange={event => onChange({ ...value, confirmed: event.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-gold" /><span>{t("confirm")}</span></label>
  </fieldset>;
}
