"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SearchArea } from "@/lib/unified-search";
import { NATIVE_SMART_PRIMARY, toggleNativeSmartArea } from "@/lib/native-smart-controls";
import styles from "./NativeSmartAreas.module.css";
import { useNativeSegmentDrag } from "@/lib/use-native-segment-drag";

/** Uses the existing result pool. A visible choice never grants server access. */
export default function NativeSmartAreas({ available, hidden, onChange }: {
  available: SearchArea[]; hidden: SearchArea[]; onChange: (hidden: SearchArea[]) => void;
}) {
  const t = useTranslations("UnifiedSearch"), app = useTranslations("NativeAppChrome"), native = useTranslations("NativeSmartDiscovery");
  const all = available.every(area => !hidden.includes(area));
  const choose = (index: number) => {
    const area = NATIVE_SMART_PRIMARY[index];
    if (area === "smart") onChange([]);
    else if (area && available.includes(area)) onChange(toggleNativeSmartArea(available, hidden, area));
  };
  const drag = useNativeSegmentDrag(`${available.join(",")}:${hidden.join(",")}`, choose);
  return <div {...drag} className={styles.areas} role="group" aria-label={t("allAreas")}>
    {NATIVE_SMART_PRIMARY.map(area => area === "smart"
      ? <button key={area} type="button" data-smart-domain={area} data-native-segment={area} aria-pressed={all} onClick={() => onChange([])}><Sparkles size={13} aria-hidden="true" />{app("smart")}</button>
      : <button key={area} type="button" data-smart-domain={area} data-native-segment={area} aria-label={t(`areas.${area}`)} aria-pressed={!all && available.includes(area) && !hidden.includes(area)}
        disabled={!available.includes(area)} onClick={() => onChange(toggleNativeSmartArea(available, hidden, area))}>{area === "companies" ? t(`areas.${area}`) : native(`compactAreas.${area}`)}</button>)}
  </div>;
}
