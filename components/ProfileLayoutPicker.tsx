"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { PROFILE_LAYOUTS, type ProfileLayout } from "@/lib/profile-layout";

/** Changes the recoverable form only; the parent owns the explicit save. */
export default function ProfileLayoutPicker({ value, onChange, disabled = false, unavailable = false }: {
  value: ProfileLayout | null; onChange: (value: ProfileLayout) => void; disabled?: boolean; unavailable?: boolean;
}) {
  const t = useTranslations("ProfileLayout");
  const id = useId();
  return <fieldset disabled={disabled || unavailable} aria-describedby={`${id}-hint`} className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold text-text-primary">{t("title")}</legend>
    <div className="grid min-w-0 grid-cols-2 gap-3">
      {PROFILE_LAYOUTS.map(layout => <label key={layout} className="relative min-w-0 cursor-pointer">
        <input type="radio" name={id} value={layout} checked={value === layout} onChange={() => onChange(layout)} className="peer sr-only" />
        <span className="flex min-h-11 h-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-bg-secondary p-3 text-sm text-text-secondary transition-colors peer-checked:border-gold/60 peer-checked:bg-gold/10 peer-checked:text-gold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold peer-disabled:cursor-default peer-disabled:opacity-50">
          <span aria-hidden="true" className={`relative flex h-16 overflow-hidden rounded-lg bg-bg-elevated ${layout === "compact" ? "items-center gap-2 p-2" : "items-end px-2 pb-1 pt-7"}`}>
            {layout === "large-photo" && <span className="absolute inset-0 bg-gradient-to-br from-gold/25 to-bg-elevated" />}
            <span className={`relative flex items-center gap-2 ${layout === "large-photo" ? "w-full rounded-md bg-bg-primary p-2" : "w-full"}`}><span className="h-6 w-6 shrink-0 rounded-md bg-gold/40" /><span className="flex-1 space-y-1"><span className="block h-1 w-3/4 rounded bg-current/60" /><span className="block h-1 w-1/2 rounded bg-current/30" /></span></span>
          </span>
          <span className="break-words font-medium">{t(layout)}</span>
        </span>
      </label>)}
    </div>
    <p id={`${id}-hint`} className="text-xs leading-5 text-text-muted">{t(unavailable ? "unavailable" : value === null ? "legacyHint" : "hint")}</p>
  </fieldset>;
}
