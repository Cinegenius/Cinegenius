"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { OCCUPATION_FORMS, isOccupationForm, normalizeOccupationForm, type OccupationForm } from "@/lib/occupation-form";

/** Optional grammatical presentation, independent of identity or pronouns. */
export default function OccupationFormSelect({ value, onChange, disabled = false, id, className = "" }: {
  value?: OccupationForm; onChange: (value: OccupationForm) => void; disabled?: boolean; id?: string; className?: string;
}) {
  const t = useTranslations("OccupationForm");
  const generatedId = useId();
  const selectId = id ?? `occupation-form-${generatedId}`;
  const current = normalizeOccupationForm(value);
  return <div className={`min-w-0 ${className}`}>
    <label htmlFor={selectId} className="mb-2 block text-sm font-semibold text-text-primary">{t("title")}</label>
    <div className="relative min-w-0">
      <select id={selectId} value={current} disabled={disabled} aria-describedby={`${selectId}-help`}
        onChange={event => { const next = event.target.value; if (isOccupationForm(next) && next !== current) onChange(next); }}
        className="h-11 min-h-11 w-full min-w-0 appearance-none rounded-xl border border-border bg-bg-primary py-2 pl-3 pr-10 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-60">
        {OCCUPATION_FORMS.map(form => <option key={form} value={form}>{t(form)}</option>)}
      </select>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"><path d="m6 9 6 6 6-6" /></svg>
    </div>
    <p id={`${selectId}-help`} className="mt-2 text-xs leading-5 text-text-muted">{t("help")}</p>
  </div>;
}
