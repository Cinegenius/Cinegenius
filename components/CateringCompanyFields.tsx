"use client";

import {
  CATERING_COMPANY_SERVICES,
  CATERING_DIETARY_OPTIONS,
  CATERING_MOBILE_EQUIPMENT_OPTIONS,
  type CateringCompanyDetails,
} from "@/lib/catering-taxonomy";
import { useTranslations } from "next-intl";


export default function CateringCompanyFields({
  value,
  onChange,
}: {
  value: CateringCompanyDetails;
  onChange: (value: CateringCompanyDetails) => void;
}) {
  const uiText = useTranslations();

  const toggle = (field: "serviceTypes" | "dietaryOptions" | "mobileEquipment", item: string) => {
    const current = value[field];
    onChange({ ...value, [field]: current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item] });
  };

  return (
    <div className="space-y-5 rounded-xl border border-green-400/20 bg-green-400/[0.04] p-4">
      <p className="text-sm leading-5 text-text-secondary">{uiText("Ui.text_7f4ec6adbce116")}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">{uiText("Ui.text_83a4b1fc501a62")}</legend>
        <div className="flex flex-wrap gap-2">
          {CATERING_COMPANY_SERVICES.map((service) => <Choice key={service.id} label={service.label} selected={value.serviceTypes.includes(service.label)} onClick={() => toggle("serviceTypes", service.label)} />)}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm text-text-primary">{uiText.rich("Ui.text_a8f832ca6c4865", { part1: chunks => (<span>{chunks}</span>), part2: () => (<input value={value.serviceAreas} onChange={(event) => onChange({ ...value, serviceAreas: event.target.value })} maxLength={240} placeholder={uiText("Ui.text_5b4f3e2005c375")} className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted" />) })}</label>
        <label className="space-y-1.5 text-sm text-text-primary">{uiText.rich("Ui.text_23d02131f202fc", { part1: chunks => (<span>{chunks}</span>), part2: () => (<input type="number" min={1} max={100000} value={value.capacity ?? ""} onChange={(event) => onChange({ ...value, capacity: event.target.value ? Number(event.target.value) : null })} placeholder={uiText("setup.copy38")} className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted" />) })}</label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">{uiText.rich("Ui.text_58b99ed1ae83b8", { part1: chunks => (<span className="font-normal text-text-muted">{chunks}</span>) })}</legend>
        <div className="flex flex-wrap gap-2">{CATERING_DIETARY_OPTIONS.map((item) => <Choice key={item} label={item} selected={value.dietaryOptions.includes(item)} onClick={() => toggle("dietaryOptions", item)} />)}</div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">{uiText.rich("Ui.text_617f73cce94d7a", { part1: chunks => (<span className="font-normal text-text-muted">{chunks}</span>) })}</legend>
        <div className="flex flex-wrap gap-2">{CATERING_MOBILE_EQUIPMENT_OPTIONS.map((item) => <Choice key={item} label={item} selected={value.mobileEquipment.includes(item)} onClick={() => toggle("mobileEquipment", item)} />)}</div>
      </fieldset>
    </div>
  );
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-11 max-w-full rounded-full border px-3 py-2 text-left text-xs leading-4 transition-colors ${selected ? "border-green-300/50 bg-green-300/10 text-green-200" : "border-border bg-bg-secondary text-text-secondary hover:border-green-300/30"}`}>{label}</button>;
}
