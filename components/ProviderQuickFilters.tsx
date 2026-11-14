"use client";

import { MapPin, ShoppingBag, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { CREW_PROVIDER_FILTER, LOCATION_PROVIDER_FILTER, MARKETPLACE_PROVIDER_FILTER } from "@/lib/profile-provider-filters";

export default function ProviderQuickFilters({ value, crew, locations, marketplace, onChange }: {
  value: string | null; crew: boolean; locations: boolean; marketplace: boolean; onChange: (value: string | null) => void;
}) {
  const t = useTranslations();
  if (!crew && !locations && !marketplace) return null;
  return <span role="group" aria-label={t("creators.deptFilter")} className="inline-flex shrink-0">
    {[
      { value: CREW_PROVIDER_FILTER, available: crew, label: t("nav.crew"), icon: Users },
      { value: MARKETPLACE_PROVIDER_FILTER, available: marketplace, label: t("Ui.text_47ce00e52d872a"), icon: ShoppingBag },
      { value: LOCATION_PROVIDER_FILTER, available: locations, label: t("Ui.text_e05308bad64468"), icon: MapPin },
    ].filter(option => option.available).map(option => <button
      key={option.value} type="button" title={option.label} aria-label={option.label} aria-pressed={value === option.value}
      onClick={() => onChange(value === option.value ? null : option.value)}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${value === option.value ? "bg-gold/10 text-gold" : "text-text-muted hover:text-gold hover:bg-bg-elevated"}`}
    ><option.icon size={18} aria-hidden="true" /></button>)}
  </span>;
}
