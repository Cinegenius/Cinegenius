"use client";

import { useId, type CSSProperties } from "react";
import { ChevronDown, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { NATIVE_APP_BACKGROUNDS, selectNativeAppBackground, useNativeAppBackground, type NativeAppBackground } from "@/lib/native-app-theme";
import { useNativeCapability } from "@/lib/use-native-capability";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import styles from "./NativeAppBackgroundPicker.module.css";

// Swatches match the seven approved studies; the app paints the actual canvas.
const swatches: Record<NativeAppBackground, string> = { graphite: "#343b43", midnight: "#294361", sage: "#395747", rose: "#74434d", sand: "#78664a", mauve: "#51434f", black: "#000000" };

/** A presentation choice inside the existing native profile menu, never a website preference. */
export default function NativeAppBackgroundPicker() {
  const native = useNativeAppAppearance(), ready = useNativeCapability("background-picker");
  const background = useNativeAppBackground(), t = useTranslations("NativeAppChrome");
  const id = useId();
  if (!native || !ready) return null;
  return <details className={styles.picker} data-native-app-background-picker="v1"
    onKeyDown={event => {
      if (event.key !== "Escape" || !event.currentTarget.open) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus({ preventScroll: true });
    }}>
    <summary className={styles.summary} aria-controls={`${id}-choices`}>
      <Palette size={18} aria-hidden="true" /><span id={`${id}-title`}>{t("background")}</span><ChevronDown size={15} className={styles.chevron} aria-hidden="true" />
    </summary>
    <div id={`${id}-choices`} role="group" aria-labelledby={`${id}-title`} className={styles.choices}>
      {NATIVE_APP_BACKGROUNDS.map(value => <button key={value} type="button" className={styles.choice} aria-pressed={background === value}
        data-native-app-background-option={value} style={{ "--native-background-swatch": swatches[value] } as CSSProperties}
        onClick={event => { if (!event.defaultPrevented && event.nativeEvent.isTrusted) selectNativeAppBackground(value); }}>
        <span className={styles.swatch} aria-hidden="true" /><span className={styles.label}>{t(`backgrounds.${value}`)}</span>
      </button>)}
    </div>
  </details>;
}
