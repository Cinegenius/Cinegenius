"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { COMPANY_RESPONSIBLE_FUNCTIONS, OFFER_RESPONSIBLE_FUNCTIONS, responsiblePersonErrors, type ResponsiblePerson } from "@/lib/responsible-person";

export default function ResponsiblePersonFields({ value, onChange, company = false, errors = {}, accountPrefill = false, disabled = false, compactWhenProfile = false }: {
  value: ResponsiblePerson; onChange: (value: ResponsiblePerson) => void; company?: boolean;
  errors?: Record<string, string>; accountPrefill?: boolean; disabled?: boolean; compactWhenProfile?: boolean;
}) {
  const t = useTranslations("responsiblePerson");
  const invalid = responsiblePersonErrors(value, company);
  const fieldErrors = Object.fromEntries(Object.entries(errors).filter(([field]) => invalid[field]));
  const id = useId();
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  const hasName = Boolean(value.firstName || value.lastName || value.profileName);
  const shouldPrefill = accountPrefill && !disabled && (compactWhenProfile || !hasName);
  const [prefilling, setPrefilling] = useState(accountPrefill && compactWhenProfile && !value.profileName);
  useEffect(() => {
    if (!shouldPrefill) return;
    const controller = new AbortController();
    fetch("/api/responsible-person", { cache: "no-store", signal: controller.signal }).then(async response => response.ok ? response.json() : null).then(data => {
      if (!data?.person || controller.signal.aborted) return;
      const current = latest.current;
      if (data.person.profileName || (!current.value.firstName && !current.value.lastName)) current.onChange({ ...current.value,
        firstName: current.value.firstName || data.person.firstName, lastName: current.value.lastName || data.person.lastName,
        ...(data.person.profileName ? { profileName: data.person.profileName } : {}) });
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setPrefilling(false); });
    return () => controller.abort();
  }, [shouldPrefill]);
  if (compactWhenProfile && (prefilling || (value.profileName && !fieldErrors.function && !fieldErrors.customFunction))) return null;
  const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary px-3 py-2 text-base text-text-primary focus:border-gold outline-none";
  return <fieldset data-responsible-person className="min-w-0 space-y-3 rounded-xl border border-border p-4" disabled={disabled}>
    <legend className="px-1 text-sm font-semibold text-text-primary">{t("title")}</legend>
    <p className="text-sm text-text-muted">{t("help")}</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(["firstName", "lastName"] as const).map(field => <div key={field}>
      <label className="mb-1 block text-sm text-text-primary" htmlFor={`${id}-${field}`}>{t(field)} *</label>
      <input id={`${id}-${field}`} name={`responsible-${field}`} autoComplete={field === "firstName" ? "given-name" : "family-name"} maxLength={field === "firstName" ? 80 : 100} value={value[field]} onChange={e => onChange({ ...value, [field]: e.target.value })} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `${id}-${field}-error` : undefined} className={inputClass} />
      {fieldErrors[field] && <p id={`${id}-${field}-error`} role="alert" className="mt-1 text-sm text-red-400">{t(fieldErrors[field])}</p>}
    </div>)}</div>
    <label className="block text-sm text-text-primary" htmlFor={`${id}-function`}>{t("function")}</label>
    <select id={`${id}-function`} value={value.function} onChange={e => onChange({ ...value, function: e.target.value })} aria-invalid={Boolean(fieldErrors.function)} className={inputClass}>
      <option value="">{t("none")}</option>{(company ? COMPANY_RESPONSIBLE_FUNCTIONS : OFFER_RESPONSIBLE_FUNCTIONS).map(key => <option key={key} value={key}>{t(`functions.${key}`)}</option>)}
    </select>
    {value.function === "other" && <div><label htmlFor={`${id}-custom`} className="mb-1 block text-sm text-text-primary">{t("customFunction")}</label><input id={`${id}-custom`} maxLength={80} value={value.customFunction} aria-invalid={Boolean(fieldErrors.customFunction)} onChange={e => onChange({ ...value, customFunction: e.target.value })} className={inputClass} />{fieldErrors.customFunction && <p className="text-sm text-red-400" role="alert">{t("invalidFunction")}</p>}</div>}
    <p className="text-xs text-text-muted">{t("noRights")}</p>
    <label className="flex min-h-11 items-start gap-3 text-sm text-text-primary"><input type="checkbox" checked={value.public} onChange={e => onChange({ ...value, public: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-gold" />{t("public")}</label>
    <p className="text-xs leading-5 text-text-muted">{t("visibility")}</p>
  </fieldset>;
}

export function focusResponsiblePerson() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[data-responsible-person] [aria-invalid="true"]')
      ?? document.querySelector<HTMLElement>('[data-responsible-person] input');
    field?.scrollIntoView({ block: "center", behavior: "smooth" }); field?.focus({ preventScroll: true });
  });
}
