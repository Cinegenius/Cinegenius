"use client";

import { useTranslations } from "next-intl";
import { SAFETY_MEDICAL_COMPANY_SERVICES } from "@/lib/safety-medical-taxonomy";

type Props = { value: string[]; onChange: (value: string[]) => void };

export default function SafetyMedicalServiceFields({ value, onChange }: Props) {
  const t = useTranslations("SafetyMedical");
  const toggle = (label: string) => onChange(value.includes(label) ? value.filter(item => item !== label) : [...value, label]);

  return <fieldset className="space-y-3 rounded-xl border border-border bg-bg-primary p-4">
    <legend className="px-1 text-sm font-semibold text-text-primary">{t("servicesLabel")}</legend>
    <p className="text-xs leading-5 text-text-muted">{t("servicesHelp")}</p>
    <div className="flex flex-wrap gap-2">
      {SAFETY_MEDICAL_COMPANY_SERVICES.map(service => {
        const active = value.includes(service.label);
        return <button key={service.id} type="button" aria-pressed={active} onClick={() => toggle(service.label)} className={`min-h-11 rounded-full border px-3 py-2 text-sm ${active ? "border-gold/50 bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40"}`}>{t(`services.${service.id}`)}</button>;
      })}
    </div>
    <p className="rounded-lg border border-border bg-bg-secondary p-3 text-xs leading-5 text-text-muted">{t("qualificationNotice")}</p>
  </fieldset>;
}
