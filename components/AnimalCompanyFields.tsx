"use client";
import { useTranslations } from "next-intl";
import { ANIMAL_SERVICE_IDS, ANIMAL_SPECIES, normalizeAnimalCompanyDetails, type AnimalCompanyDetails } from "@/lib/animal-taxonomy";
export default function AnimalCompanyFields({ value, onChange }: { value: AnimalCompanyDetails; onChange: (value: AnimalCompanyDetails) => void }) {
  const t = useTranslations("FilmAnimals");
  const toggle = (field: "serviceTypes" | "species", id: string) => onChange({ ...value, [field]: value[field].includes(id as never) ? value[field].filter(item => item !== id) : [...value[field], id] });
  return <div className="space-y-4 rounded-xl border border-border bg-bg-primary p-4">
    <fieldset><legend className="mb-2 text-sm font-medium text-text-primary">{t("servicesLabel")}</legend><div className="flex flex-wrap gap-2">{ANIMAL_SERVICE_IDS.map(id => <button key={id} type="button" aria-pressed={value.serviceTypes.includes(id)} onClick={() => toggle("serviceTypes", id)} className={`min-h-11 max-w-full rounded-full border px-3 py-2 text-left text-sm ${value.serviceTypes.includes(id) ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{t(`services.${id}`)}</button>)}</div></fieldset>
    <fieldset><legend className="mb-2 text-sm font-medium text-text-primary">{t("speciesLabel")}</legend><div className="flex flex-wrap gap-2">{ANIMAL_SPECIES.map(({id}) => <button key={id} type="button" aria-pressed={value.species.includes(id)} onClick={() => toggle("species", id)} className={`min-h-11 max-w-full rounded-full border px-3 py-2 text-left text-sm ${value.species.includes(id) ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{t(`species.${id}`)}</button>)}</div></fieldset>
    <label className="block text-sm text-text-primary"><span className="mb-1 block">{t("otherSpeciesLabel")}</span><input maxLength={120} value={value.otherSpecies} onChange={event => onChange({...value,otherSpecies:event.target.value})} className="min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3" /></label>
    <p className="text-xs leading-5 text-text-muted">{t("selfReported")}</p>
  </div>;
}
export function AnimalCompanySummary({ value }: { value: unknown }) {
  const t = useTranslations("FilmAnimals");
  const data = normalizeAnimalCompanyDetails(value);
  if (!data.serviceTypes.length && !data.species.length && !data.otherSpecies) return null;
  return <div className="space-y-2 text-sm text-text-secondary"><h3 className="font-medium text-text-primary">{t("department")}</h3><p>{data.serviceTypes.map(id => t(`services.${id}`)).join(" · ")}</p><p>{data.species.map(id => t(`species.${id}`)).join(" · ")}</p>{data.otherSpecies && <p className="break-words">{data.otherSpecies}</p>}<p className="text-xs text-text-muted">{t("selfReported")}</p></div>;
}
