"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { PROFILE_PRESENTATIONS, type ProfilePresentation } from "@/lib/profile-presentation";

/** A small schematic preview, deliberately independent of optional uploads. */
function LayoutPreview({ mode }: { mode: ProfilePresentation }) {
  return <span aria-hidden="true" className="relative block h-16 w-full overflow-hidden rounded-md border border-border bg-bg-primary">
    {(mode === "cover" || mode === "auto") && <span className="absolute inset-x-0 top-0 h-7 bg-gold/20" />}
    <span className={`absolute rounded bg-text-muted/40 ${mode === "portrait" ? "inset-y-2 left-2 w-9" : mode === "compact" ? "left-2 top-5 h-6 w-6" : "bottom-2 left-2 h-6 w-6 ring-2 ring-bg-primary"}`} />
    <span className={`absolute right-2 h-1 rounded bg-text-muted/50 ${mode === "portrait" ? "left-14 top-6" : mode === "compact" ? "left-10 top-6" : "bottom-6 left-10"}`} />
    <span className={`absolute right-5 h-1 rounded bg-text-muted/25 ${mode === "portrait" ? "left-14 top-9" : mode === "compact" ? "left-10 top-9" : "bottom-3 left-10"}`} />
  </span>;
}

export default function ProfilePresentationPicker({ value, onChange, disabled = false }: {
  value: ProfilePresentation; onChange: (value: ProfilePresentation) => void; disabled?: boolean;
}) {
  const t = useTranslations("ProfilePresentation");
  const id = useId();
  return <fieldset disabled={disabled} aria-describedby={`${id}-help`} className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold text-text-primary">{t("question")}</legend>
    <p id={`${id}-help`} className="text-xs leading-5 text-text-muted">{t("hint")}</p>
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
      {PROFILE_PRESENTATIONS.map(mode => <label key={mode} className={`relative flex min-h-11 min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 focus-within:ring-2 focus-within:ring-gold disabled:opacity-50 ${value === mode ? "border-gold bg-gold/10" : "border-border bg-bg-secondary"} ${disabled ? "cursor-default opacity-50" : "hover:border-gold/50"}`}>
        <LayoutPreview mode={mode} />
        <span className="flex items-start gap-2">
          <input type="radio" name={`${id}-presentation`} value={mode} checked={value === mode} onChange={() => onChange(mode)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
          <span className="min-w-0 break-words text-xs font-medium leading-5 text-text-primary">{t(mode)}</span>
        </span>
      </label>)}
    </div>
  </fieldset>;
}
