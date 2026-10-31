"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { COMPANY_RESPONSIBLE_FUNCTIONS, OFFER_RESPONSIBLE_FUNCTIONS, responsibleAccountName, responsiblePersonErrors, type ResponsiblePerson } from "@/lib/responsible-person";

export default function ResponsiblePersonFields({ value, onChange, company = false, errors = {}, accountPrefill = false, disabled = false, compactWhenProfile = false, identityOnly = false }: {
  value: ResponsiblePerson; onChange: (value: ResponsiblePerson) => void; company?: boolean;
  errors?: Record<string, string>; accountPrefill?: boolean; disabled?: boolean; compactWhenProfile?: boolean; identityOnly?: boolean;
}) {
  const t = useTranslations("responsiblePerson");
  const invalid = responsiblePersonErrors(value, company);
  const fieldErrors = Object.fromEntries(Object.entries(errors).filter(([field]) => invalid[field]));
  const id = useId();
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  const [editingName, setEditingName] = useState(!responsibleAccountName(value) && !value.profileName);
  const [prefilling, setPrefilling] = useState(accountPrefill && !disabled);
  const [accountState, setAccountState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [retry, setRetry] = useState(0);
  const savedName = useRef("");
  const nameEdited = useRef(false);
  const accountUserId = useRef<string | null>(null);
  const nameSaveQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (!accountPrefill || disabled) return;
    const controller = new AbortController();
    fetch("/api/responsible-person", { cache: "no-store", signal: controller.signal }).then(async response => response.ok ? response.json() : null).then(data => {
      if (!data?.person || controller.signal.aborted) return;
      if (accountUserId.current && accountUserId.current !== data.userId) { setAccountState("error"); return; }
      accountUserId.current = typeof data.userId === "string" ? data.userId : null;
      const accountName = responsibleAccountName(data.person);
      savedName.current = accountName ? JSON.stringify(accountName) : "";
      const current = latest.current;
      if (!current.value.firstName && !current.value.lastName && accountName) {
        current.onChange({ ...current.value, ...accountName, ...(compactWhenProfile && data.person.profileName ? { profileName: data.person.profileName } : {}) });
        setEditingName(false);
      } else if (data.person.profileName && (!current.value.firstName && !current.value.lastName || compactWhenProfile)) {
        current.onChange({ ...current.value, profileName: data.person.profileName });
        setEditingName(false);
      }
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setPrefilling(false); });
    return () => controller.abort();
  }, [accountPrefill, disabled, compactWhenProfile, retry]);

  const name = responsibleAccountName(value);
  const nameKey = name ? JSON.stringify(name) : "";
  useEffect(() => {
    if (!accountPrefill || disabled || identityOnly || prefilling || !nameEdited.current || !nameKey || nameKey === savedName.current) return;
    // This separate private save cannot publish anything or change old offers.
    let active = true;
    const timer = setTimeout(async () => {
      setAccountState("saving");
      try {
        const request = nameSaveQueue.current.catch(() => {}).then(async () => {
          if (!accountUserId.current) throw new Error();
          const response = await fetch("/api/responsible-person", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(nameKey), userId: accountUserId.current }) });
          const result = await response.json();
          if (!response.ok || result.saved !== true) throw new Error();
          savedName.current = nameKey;
        });
        nameSaveQueue.current = request;
        await request;
        if (active) setAccountState("saved");
      } catch { if (active) setAccountState("error"); }
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [accountPrefill, disabled, identityOnly, prefilling, nameKey, retry]);

  const displayName = (compactWhenProfile && value.profileName) || (name ? `${name.firstName} ${name.lastName}` : value.profileName || "");
  const showInputs = identityOnly || editingName || !displayName || Boolean(fieldErrors.firstName || fieldErrors.lastName);
  const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary px-3 py-2 text-base text-text-primary focus:border-gold outline-none";
  const nameInputs = <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(["firstName", "lastName"] as const).map(field => <div key={field}>
    <label className="mb-1 block text-sm text-text-primary" htmlFor={`${id}-${field}`}>{t(field)} *</label>
    <input id={`${id}-${field}`} name={`responsible-${field}`} autoComplete={field === "firstName" ? "given-name" : "family-name"} maxLength={field === "firstName" ? 80 : 100} value={value[field]} onChange={e => { nameEdited.current = true; onChange({ ...value, [field]: e.target.value, profileName: undefined }); }} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `${id}-${field}-error` : undefined} className={inputClass} />
    {fieldErrors[field] && <p id={`${id}-${field}-error`} role="alert" className="mt-1 text-sm text-red-400">{t(fieldErrors[field])}</p>}
  </div>)}</div>;
  return <fieldset data-responsible-person className="min-w-0 space-y-3 rounded-xl border border-border p-4" disabled={disabled}>
    <legend className="px-1 text-sm font-semibold text-text-primary">{t(identityOnly ? "accountName" : "title")}</legend>
    {showInputs ? <>{nameInputs}{!identityOnly && name && <button type="button" onClick={() => { nameEdited.current = true; setRetry(v => v + 1); setEditingName(false); }} className="min-h-11 text-sm font-semibold text-gold">{t("useName")}</button>}</> : <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words font-semibold text-text-primary">{displayName}</p><button type="button" onClick={() => setEditingName(true)} className="min-h-11 text-sm text-gold">{t("editName")}</button></div>}
    <p className="text-xs leading-5 text-text-muted">{t("accountReuse")}</p>
    {!identityOnly && <>
      {value.public ? <p className="break-words text-sm leading-6 text-text-primary">{displayName ? t("publicPreview", { name: displayName }) : t("publicBeforeSave")}</p> : <div className="space-y-1"><p className="text-sm text-text-secondary">{t("keptPrivate")}</p><button type="button" onClick={() => onChange({ ...value, public: true })} className="min-h-11 text-left text-sm font-semibold text-gold">{t("showName")}</button></div>}
      <p className="text-xs leading-5 text-text-muted">{t("contactPrivacy")}</p>
      <details open={Boolean(value.function || fieldErrors.function || fieldErrors.customFunction)} className="min-w-0">
        <summary className="min-h-11 cursor-pointer py-3 text-sm text-text-secondary">{t("functionOptions")}</summary>
        <div className="space-y-3 pt-1"><label className="block text-sm text-text-primary" htmlFor={`${id}-function`}>{t("function")}</label>
          <select id={`${id}-function`} value={value.function} onChange={e => onChange({ ...value, function: e.target.value })} aria-invalid={Boolean(fieldErrors.function)} className={inputClass}>
            <option value="">{t("none")}</option>{(company ? COMPANY_RESPONSIBLE_FUNCTIONS : OFFER_RESPONSIBLE_FUNCTIONS).map(key => <option key={key} value={key}>{t(`functions.${key}`)}</option>)}
          </select>
          {value.function === "other" && <div><label htmlFor={`${id}-custom`} className="mb-1 block text-sm text-text-primary">{t("customFunction")}</label><input id={`${id}-custom`} maxLength={80} value={value.customFunction} aria-invalid={Boolean(fieldErrors.customFunction)} onChange={e => onChange({ ...value, customFunction: e.target.value })} className={inputClass} />{fieldErrors.customFunction && <p className="text-sm text-red-400" role="alert">{t("invalidFunction")}</p>}</div>}
          <p className="text-xs text-text-muted">{t("noRights")}</p>
          {value.public && <button type="button" onClick={() => onChange({ ...value, public: false })} className="min-h-11 text-left text-xs text-text-muted">{t("hideName")}</button>}
        </div>
      </details>
    </>}
    {accountState !== "idle" && <div role="status" className="text-xs text-text-muted">{t(accountState === "saving" ? "accountSaving" : accountState === "saved" ? "accountSaved" : "accountSaveError")}{accountState === "error" && <button type="button" onClick={() => setRetry(v => v + 1)} className="ml-2 min-h-11 text-gold">{t("retry")}</button>}</div>}
  </fieldset>;
}

export function focusResponsiblePerson() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[data-responsible-person] [aria-invalid="true"]')
      ?? document.querySelector<HTMLElement>('[data-responsible-person] input');
    field?.scrollIntoView({ block: "center", behavior: "smooth" }); field?.focus({ preventScroll: true });
  });
}
