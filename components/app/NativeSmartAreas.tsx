"use client";

import { useTranslations } from "next-intl";
import type { SearchArea } from "@/lib/unified-search";
import { NATIVE_SMART_PRIMARY, toggleNativeSmartArea } from "@/lib/native-smart-controls";
import styles from "./NativeSmartAreas.module.css";

/** Five explicit switches over the existing permission-projected result pool. */
export default function NativeSmartAreas({ hidden, onChange }: {
  hidden: SearchArea[]; onChange: (hidden: SearchArea[]) => void;
}) {
  const t = useTranslations("UnifiedSearch"), native = useTranslations("NativeSmartDiscovery");
  return <div className={styles.areas} role="group" aria-label={t("allAreas")} data-native-smart-sources="v2">
    {NATIVE_SMART_PRIMARY.map(area => <button key={area} type="button" data-smart-source={area}
      aria-label={t(`areas.${area}`)} aria-pressed={!hidden.includes(area)}
      onClick={() => onChange(toggleNativeSmartArea(NATIVE_SMART_PRIMARY, hidden, area))}>
      {area === "companies" || area === "jobs" ? t(`areas.${area}`) : native(`compactAreas.${area}`)}
    </button>)}
  </div>;
}
