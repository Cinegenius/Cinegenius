"use client";

import { LayoutGrid, List, Map } from "lucide-react";
import { useTranslations } from "next-intl";

export type DirectoryView = "grid" | "list" | "map";

export default function DirectoryViewControls({ value, onChange }: { value: DirectoryView; onChange: (value: DirectoryView) => void }) {
  const t = useTranslations("MarketplaceNavigation"), locations = useTranslations("locations");
  return <div role="group" aria-label={locations("viewLabel")} className="directory-view-controls">
    {([{ value: "grid", icon: LayoutGrid, label: t("viewGrid") }, { value: "list", icon: List, label: t("viewList") }, { value: "map", icon: Map, label: locations("viewMap") }] as const).map(option => <button key={option.value} type="button" aria-label={option.label} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className="directory-view-button"><option.icon size={17} aria-hidden="true" />{option.value === "map" && option.label}</button>)}
  </div>;
}
