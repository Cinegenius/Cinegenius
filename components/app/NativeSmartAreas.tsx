"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SearchArea } from "@/lib/unified-search";
import { NATIVE_SMART_PRIMARY, toggleNativeSmartArea } from "@/lib/native-smart-controls";
import styles from "./NativeSmartAreas.module.css";

/** Uses the existing result pool. A visible choice never grants server access. */
export default function NativeSmartAreas({ available, hidden, onChange }: {
  available: SearchArea[]; hidden: SearchArea[]; onChange: (hidden: SearchArea[]) => void;
}) {
  const t = useTranslations("UnifiedSearch"), app = useTranslations("NativeAppChrome");
  const all = available.every(area => !hidden.includes(area));
  return <div className={styles.areas} role="group" aria-label={t("allAreas")}>
    {NATIVE_SMART_PRIMARY.map(area => area === "smart"
      ? <button key={area} type="button" data-smart-domain={area} aria-pressed={all} onClick={() => onChange([])}><Sparkles size={13} aria-hidden="true" />{app("smart")}</button>
      : <button key={area} type="button" data-smart-domain={area} aria-pressed={!all && available.includes(area) && !hidden.includes(area)}
        disabled={!available.includes(area)} onClick={() => onChange(toggleNativeSmartArea(available, hidden, area))}>{t(`areas.${area}`)}</button>)}
  </div>;
}
