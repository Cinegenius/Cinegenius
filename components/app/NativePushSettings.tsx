"use client";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useNativeCapability } from "@/lib/use-native-capability";

export default function NativePushSettings() {
  const t = useTranslations("PushNotifications");
  const pathname = usePathname();
  const nativeAppearance = useNativeAppAppearance();
  const available = useNativeCapability("push-settings");
  if (!nativeAppearance || pathname !== "/dashboard") return null;
  return <div className="space-y-2 border-b border-border pb-4">
    <button type="button" data-native-push-settings="v1" disabled={!available} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-primary px-4 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-50">
      <Bell size={17} aria-hidden="true" />{t("openSettings")}
    </button>
    <p className="text-xs text-text-muted">{t("deviceDescription")}</p>
  </div>;
}
