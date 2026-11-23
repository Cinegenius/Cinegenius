"use client";
import { useLocale, useTranslations } from "next-intl";
import type { OccupationForm } from "@/lib/occupation-form";
import { departments, getDeptLabel, getDepartmentRoleLabel } from "@/lib/departments";
import { occupationChoices, primaryOccupationForPositions, occupationReference, type PrimaryOccupation } from '@/lib/primary-occupation';
import { MAX_PROFILE_OCCUPATIONS, profileOccupationCount, selectedCrewOccupations } from '@/lib/crew-occupations';

export default function PrimaryOccupationPicker({positions,value,onChange,additionalValue=null,onAdditionalChange,selections,showExplanation=true,id='primary-occupation',occupationForm="standard"}:{positions:readonly string[];value:PrimaryOccupation|null;onChange:(value:PrimaryOccupation|null)=>void;additionalValue?:PrimaryOccupation|null;onAdditionalChange?:(value:PrimaryOccupation|null)=>void;selections?:unknown;showExplanation?:boolean;id?:string;occupationForm?:OccupationForm}) {
  const taxonomyText = useTranslations("Taxonomy");

  const t = useTranslations("occupation");
  const locale = useLocale();
  const animals = useTranslations("FilmAnimals");
  const count = profileOccupationCount({positions, crew:{occupations: selections}});
  const selectedIds = new Set(selectedCrewOccupations(positions, selections, null, value).map(option => option.roleId));
  const options = occupationChoices(positions).filter(option => selectedIds.has(option.roleId));
  const selected = primaryOccupationForPositions(value, positions);
  const otherOptions = options.filter(option => option.roleId !== selected?.roleId);
  const secondary = otherOptions.filter(option => option.roleId !== additionalValue?.roleId);
  const label = (option: (typeof options)[number]) => getDepartmentRoleLabel(option.departmentId, option.label, locale, animals, taxonomyText, occupationForm);
  if (!positions.length) return null;
  return <div className="mt-5 space-y-2">
    <p className={showExplanation ? "text-sm leading-6 text-text-secondary" : "sr-only"} id={`${id}-explanation`}>{t("focusExplanation")}</p>
    <label htmlFor={id} className="block text-sm font-semibold text-text-primary">{t("main")}</label>
    <select id={id} aria-describedby={`${id}-explanation`} value={selected?.roleId ?? ''} onChange={event=>{ const next = occupationReference(options.find(option=>option.roleId===event.target.value)??null); if (next?.roleId === additionalValue?.roleId) onAdditionalChange?.(null); onChange(next); }} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary px-3 py-3 text-base text-text-primary">
      <option value="">{t("choose")}</option>
      {options.map(option=><option key={option.roleId} value={option.roleId}>{getDeptLabel(departments.find(department=>department.id===option.departmentId)!, locale, animals, taxonomyText)} → {getDepartmentRoleLabel(option.departmentId, option.label, locale, animals, taxonomyText, occupationForm)}</option>)}
    </select>
    {onAdditionalChange && otherOptions.length > 0 && <>
      <label htmlFor={`${id}-additional`} className="block pt-3 text-sm font-semibold text-text-primary">{t("additional")}</label>
      <select id={`${id}-additional`} value={additionalValue?.roleId ?? ''} onChange={event=>onAdditionalChange(occupationReference(otherOptions.find(option=>option.roleId===event.target.value)??null))} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary px-3 py-3 text-base text-text-primary">
        <option value="">{t("noAdditional")}</option>
        {otherOptions.map(option=><option key={option.roleId} value={option.roleId}>{label(option)}</option>)}
      </select>
      <p className="text-xs leading-5 text-text-muted">{t("additionalHint")}</p>
    </>}
    {selected && secondary.length > 0 && secondary.length <= 2 && <p className="text-sm leading-6 text-text-secondary"><span className="font-semibold">{t("secondary")}:</span> {secondary.map(label).join(' · ')}</p>}
    {count > MAX_PROFILE_OCCUPATIONS && <p role="status" className="text-sm leading-6 text-text-muted">{t("legacyFocus")}</p>}
    {!selected && options.length > 1 && <p className="text-xs leading-5 text-text-muted">{t("legacy")}</p>}
    {!options.length && <p className="text-xs text-text-muted">{t("empty")}</p>}
  </div>;
}
