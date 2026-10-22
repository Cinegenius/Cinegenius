"use client";

import {
  CATERING_COMPANY_SERVICES,
  CATERING_DIETARY_OPTIONS,
  CATERING_MOBILE_EQUIPMENT_OPTIONS,
  type CateringCompanyDetails,
} from "@/lib/catering-taxonomy";

export default function CateringCompanyFields({
  value,
  onChange,
}: {
  value: CateringCompanyDetails;
  onChange: (value: CateringCompanyDetails) => void;
}) {
  const toggle = (field: "serviceTypes" | "dietaryOptions" | "mobileEquipment", item: string) => {
    const current = value[field];
    onChange({ ...value, [field]: current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item] });
  };

  return (
    <div className="space-y-5 rounded-xl border border-orange-400/20 bg-orange-400/[0.04] p-4">
      <p className="text-sm leading-5 text-text-secondary">Diese freiwilligen Angaben helfen Produktionen, ein passendes Catering zu finden.</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Welche Leistungen bietet ihr an?</legend>
        <div className="flex flex-wrap gap-2">
          {CATERING_COMPANY_SERVICES.map((service) => <Choice key={service.id} label={service.label} selected={value.serviceTypes.includes(service.label)} onClick={() => toggle("serviceTypes", service.label)} />)}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm text-text-primary">
          <span>Einsatzregion</span>
          <input value={value.serviceAreas} onChange={(event) => onChange({ ...value, serviceAreas: event.target.value })} maxLength={240} placeholder="z. B. München und Oberbayern" className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted" />
        </label>
        <label className="space-y-1.5 text-sm text-text-primary">
          <span>Kapazität in Personen</span>
          <input type="number" min={1} max={100000} value={value.capacity ?? ""} onChange={(event) => onChange({ ...value, capacity: event.target.value ? Number(event.target.value) : null })} placeholder="Optional" className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted" />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Ernährungsangebote <span className="font-normal text-text-muted">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">{CATERING_DIETARY_OPTIONS.map((item) => <Choice key={item} label={item} selected={value.dietaryOptions.includes(item)} onClick={() => toggle("dietaryOptions", item)} />)}</div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Mobile Ausstattung <span className="font-normal text-text-muted">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">{CATERING_MOBILE_EQUIPMENT_OPTIONS.map((item) => <Choice key={item} label={item} selected={value.mobileEquipment.includes(item)} onClick={() => toggle("mobileEquipment", item)} />)}</div>
      </fieldset>
    </div>
  );
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-11 max-w-full rounded-full border px-3 py-2 text-left text-xs leading-4 transition-colors ${selected ? "border-orange-300/50 bg-orange-300/10 text-orange-200" : "border-border bg-bg-secondary text-text-secondary hover:border-orange-300/30"}`}>{label}</button>;
}
