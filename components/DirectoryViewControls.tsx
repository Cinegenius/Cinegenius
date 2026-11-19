"use client";

import { LayoutGrid, List, Map } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNativeSegmentDrag } from "@/lib/use-native-segment-drag";
import styles from "./DirectoryViewControls.module.css";

export type DirectoryView = "grid" | "list" | "map";

export default function DirectoryViewControls({ value, onChange, views = ["grid", "list", "map"], unavailable = {} }: { value: DirectoryView; onChange: (value: DirectoryView) => void; views?: readonly DirectoryView[]; unavailable?: Partial<Record<DirectoryView,string>> }) {
  const t = useTranslations("MarketplaceNavigation"), locations = useTranslations("locations");
  const options = ([{ value: "grid", icon: LayoutGrid, label: t("viewGrid") }, { value: "list", icon: List, label: t("viewList") }, { value: "map", icon: Map, label: locations("viewMap") }] as const).filter(option => views.includes(option.value));
  const drag = useNativeSegmentDrag(`${value}:${views.join(",")}:${Object.keys(unavailable).join(",")}`, index => {
    const option = options[index];
    if (option && !unavailable[option.value]) onChange(option.value);
  });
  return <div {...drag} role="group" aria-label={locations("viewLabel")} className={`directory-view-controls ${styles.controls}`}>
    <span aria-hidden="true" className={styles.glass} />
    {options.map(option => <button data-native-segment key={option.value} type="button" aria-label={unavailable[option.value] ? `${option.label}: ${unavailable[option.value]}` : option.label} title={unavailable[option.value] ?? option.label} aria-disabled={Boolean(unavailable[option.value]) || undefined} aria-pressed={value === option.value} onClick={() => { if (!unavailable[option.value]) onChange(option.value); }} className="directory-view-button"><option.icon size={17} aria-hidden="true" />{option.value === "map" && <span className="directory-view-label">{option.label}</span>}</button>)}
  </div>;
}
