"use client";
import { useTranslations } from "next-intl";
import { openAnalyticsSettings } from "@/lib/analytics-consent";

export default function AnalyticsSettingsButton() {
  const t = useTranslations("AnalyticsPrivacy");
  return <button type="button" onClick={openAnalyticsSettings} className="inline-flex min-h-11 items-center text-sm text-text-muted hover:text-text-secondary">{t("settings")}</button>;
}
