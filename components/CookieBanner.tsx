"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ANALYTICS_SETTINGS_EVENT, readAnalyticsConsent, subscribeAnalyticsConsent, writeAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics-consent";

export default function CookieBanner() {
  const t = useTranslations("AnalyticsPrivacy");
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, readAnalyticsConsent, () => "rejected" as AnalyticsConsent);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const open = () => setEditing(true);
    window.addEventListener(ANALYTICS_SETTINGS_EVENT, open);
    return () => window.removeEventListener(ANALYTICS_SETTINGS_EVENT, open);
  }, []);
  function choose(value: Exclude<AnalyticsConsent, null>) {
    if (!writeAnalyticsConsent(value)) { setError(true); return; }
    setEditing(false);
    setError(false);
  }
  if (consent !== null && !editing) return null;
  return (
    <section aria-label={t("settings")} className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 right-0 z-[70] max-h-[60dvh] overflow-y-auto border-t border-border bg-bg-elevated px-4 py-3 shadow-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-text-secondary">
          <p>{t("banner")} <Link href="/datenschutz" className="text-gold underline">{t("privacy")}</Link></p>
          {error && <p role="alert">{t("storageError")}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={() => choose("rejected")} className="min-h-11 rounded-xl border border-border px-5 py-2 text-sm font-semibold text-text-primary hover:border-gold">{t("reject")}</button>
          <button onClick={() => choose("accepted")} className="min-h-11 rounded-xl border border-border px-5 py-2 text-sm font-semibold text-text-primary hover:border-gold">{t("accept")}</button>
          {editing && <button onClick={() => setEditing(false)} className="min-h-11 rounded-xl px-4 text-sm text-text-secondary">{t("close")}</button>}
        </div>
      </div>
    </section>
  );
}
