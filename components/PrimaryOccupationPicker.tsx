"use client";
import { useLocale, useTranslations } from "next-intl";
import { departments, getDeptLabel, getDepartmentRoleLabel } from "@/lib/departments";
import { occupationChoices, primaryOccupationForPositions, occupationReference, type PrimaryOccupation } from '@/lib/primary-occupation';

export default function PrimaryOccupationPicker({positions,value,onChange,id='primary-occupation'}:{positions:readonly string[];value:PrimaryOccupation|null;onChange:(value:PrimaryOccupation|null)=>void;id?:string}) {
  const t = useTranslations("occupation");
  const locale = useLocale();
  const animals = useTranslations("FilmAnimals");
  const options = occupationChoices(positions);
  const selected = primaryOccupationForPositions(value, positions);
  if (!positions.length) return null;
  return <div className="mt-5 space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold text-text-primary">{t("main")}</label>
    <select id={id} value={selected?.roleId ?? ''} onChange={event=>onChange(occupationReference(options.find(option=>option.roleId===event.target.value)??null))} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary px-3 py-3 text-base text-text-primary">
      <option value="">{t("choose")}</option>
      {options.map(option=><option key={option.roleId} value={option.roleId}>{getDeptLabel(departments.find(department=>department.id===option.departmentId)!, locale, animals)} → {getDepartmentRoleLabel(option.departmentId, option.label, locale, animals)}</option>)}
    </select>
    <p className="text-xs leading-5 text-text-muted">{t("hint")}</p>
    {!selected && options.length > 1 && <p className="text-xs leading-5 text-text-muted">{t("legacy")}</p>}
    {!options.length && <p className="text-xs text-text-muted">{t("empty")}</p>}
  </div>;
}
