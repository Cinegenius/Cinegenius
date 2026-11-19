"use client";

import { Layers3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNativeCapability } from "@/lib/use-native-capability";
import styles from "./NativeAppSurface.module.css";

export default function NativeWorkspaceEntry() {
  const t = useTranslations("NativeAppChrome");
  // Capability presentation only. The native handler verifies origin, account and access again.
  const available = useNativeCapability("workspace");
  return <section className={styles.paused} aria-labelledby="workspace-title">
    <Layers3 size={34} strokeWidth={1.5} aria-hidden="true" />
    <h1 id="workspace-title">{t("workspace")}</h1>
    <button type="button" data-native-workspace-open="v1" disabled={!available} className={styles.workspaceOpen}>{t("openWorkspace")}</button>
    {!available && <p role="status">{t("workspaceNativeOnly")}</p>}
  </section>;
}
