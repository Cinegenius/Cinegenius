export type EquipmentCategory = { id: string; label: string; emoji: string };

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  { id: "kamera",    label: "Kamera",       emoji: "🎥" },
  { id: "objektive", label: "Objektive",    emoji: "🔭" },
  { id: "licht",     label: "Licht",        emoji: "💡" },
  { id: "grip",      label: "Grip",         emoji: "🎚️" },
  { id: "ton",       label: "Ton",          emoji: "🎧" },
  { id: "kostuem",   label: "Kostüm",       emoji: "👗" },
  { id: "requisite", label: "Requisite",    emoji: "🎭" },
  { id: "fahrzeuge", label: "Fahrzeuge",    emoji: "🚗" },
  { id: "studio",    label: "Studio",       emoji: "🏢" },
  { id: "it_video",  label: "IT / Video",   emoji: "💻" },
  { id: "sonstiges", label: "Sonstiges",    emoji: "📦" },
];

export const EQUIPMENT_CATEGORY_BY_ID = Object.fromEntries(
  EQUIPMENT_CATEGORIES.map((c) => [c.id, c])
);

export const CONDITION_LABELS: Record<string, string> = {
  neu:       "Neu",
  sehr_gut:  "Sehr gut",
  gut:       "Gut",
  gebraucht: "Gebraucht",
  wartung:   "In Wartung",
};

export const CONDITION_COLORS: Record<string, string> = {
  neu:       "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  sehr_gut:  "text-sky-400 bg-sky-500/10 border-sky-500/20",
  gut:       "text-blue-400 bg-blue-500/10 border-blue-500/20",
  gebraucht: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  wartung:   "text-red-400 bg-red-500/10 border-red-500/20",
};

export const SERVICE_TYPES = [
  { id: "full_production",    label: "Full Production" },
  { id: "service_production", label: "Service Production" },
  { id: "equipment_rental",   label: "Equipment Rental" },
  { id: "crew_supply",        label: "Crew Vermittlung" },
  { id: "post_production",    label: "Postproduktion" },
  { id: "studio_rental",      label: "Studio Vermietung" },
  { id: "location_supply",    label: "Location Vermittlung" },
  { id: "sfx",                label: "SFX" },
  { id: "stunts",             label: "Stunts" },
  { id: "catering",           label: "Catering" },
  { id: "transport",          label: "Transport" },
  { id: "custom",             label: "Sonstiges" },
];

export const SERVICE_TYPE_BY_ID = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s.id, s])
);
