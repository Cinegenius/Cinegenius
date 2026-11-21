"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

export default function HomeCrewPreference({ checked, disabled = false, onChange }: {
  checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void;
}) {
  const t = useTranslations("PrivacySettings");
  const id = useId();
  return <label className="flex min-h-11 min-w-0 items-center justify-between gap-4">
    <span className="min-w-0">
      <span className="block text-sm font-medium text-text-primary">{t("homeCrew")}</span>
      <span id={id} className="mt-1 block text-xs leading-relaxed text-text-muted">{t("homeCrewHelp")}</span>
    </span>
    <span className="flex h-11 w-11 shrink-0 items-center justify-center">
      <input type="checkbox" className="h-5 w-5 accent-gold" checked={checked} disabled={disabled} aria-describedby={id} onChange={event => onChange(event.target.checked)} />
    </span>
  </label>;
}
