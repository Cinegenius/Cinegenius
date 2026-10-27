"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { COMPANY_LOGO_BACKGROUNDS, type CompanyLogoBackground } from "@/lib/company-logo";

export default function CompanyLogoBackgroundSelect({ value, onChange }: {
  value: CompanyLogoBackground;
  onChange: (value: CompanyLogoBackground) => void;
}) {
  const t = useTranslations("companyLogo");
  const hintId = useId();
  return <fieldset className="w-full min-w-0 space-y-2" aria-describedby={hintId}>
    <legend className="text-sm font-medium text-text-primary">{t("background")}</legend>
    <div className="flex flex-wrap gap-2">
      {COMPANY_LOGO_BACKGROUNDS.map((option) => <label key={option}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === option ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>
        <input type="radio" name={hintId} value={option} checked={value === option}
          onChange={() => onChange(option)} className="accent-[var(--color-gold)]" />
        {t(option)}
      </label>)}
    </div>
    <p id={hintId} className="text-xs leading-relaxed text-text-muted">{t("hint")}</p>
  </fieldset>;
}
