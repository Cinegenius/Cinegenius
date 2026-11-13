"use client";

import { LayoutGrid, List, Map } from "lucide-react";
import { useTranslations } from "next-intl";

export type DirectoryView = "grid" | "list" | "map";

export default function DirectoryViewControls({ value, onChange }: { value: DirectoryView; onChange: (value: DirectoryView) => void }) {
  const t = useTranslations("MarketplaceNavigation"), locations = useTranslations("locations");
  return <div role="group" aria-label={locations("viewLabel")} className="inline-flex max-w-full shrink-0 flex-wrap rounded-lg border border-border bg-bg-elevated p-1">
    {([{ value: "grid", icon: LayoutGrid, label: t("viewGrid") }, { value: "list", icon: List, label: t("viewList") }, { value: "map", icon: Map, label: locations("viewMap") }] as const).map(option => <button key={option.value} type="button" aria-label={option.label} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${value === option.value ? "bg-gold/10 text-gold ring-1 ring-inset ring-gold/30" : "text-text-muted hover:text-text-primary"}`}><option.icon size={17} aria-hidden="true" />{option.value === "map" && option.label}</button>)}
  </div>;
}
