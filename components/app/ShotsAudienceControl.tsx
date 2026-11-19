"use client";

import { useTranslations } from "next-intl";
import type { ShotAudience } from "@/lib/shots-client";
import { useNativeSegmentDrag } from "@/lib/use-native-segment-drag";
import styles from "./ShotsExperience.module.css";

const audiences = ["community", "homies"] as const;

export default function ShotsAudienceControl({ value, onChange }: { value: ShotAudience; onChange: (value: ShotAudience) => void }) {
  const t = useTranslations("AppShots");
  const drag = useNativeSegmentDrag(`${value}:${t("community")}:${t("homies")}`, index => onChange(audiences[index]));
  return <div {...drag} className={styles.audiences} role="group" aria-label={t("showShots")}>
    <span className={styles.audienceGlass} aria-hidden="true" />
    {audiences.map(audience => <button type="button" key={audience} data-native-segment={audience} aria-pressed={value === audience} onClick={() => onChange(audience)}>{t(audience)}</button>)}
  </div>;
}
