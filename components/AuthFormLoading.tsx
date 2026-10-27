"use client";
import { useTranslations } from "next-intl";
export default function AuthFormLoading() {
  const t = useTranslations("auth");
  return (
    <div aria-label={t("loadingLabel")} aria-busy="true" className="w-full max-w-md">
      <div className="space-y-3 rounded-2xl border border-border bg-bg-elevated p-6">
        <div className="h-11 rounded-xl border border-border bg-bg-secondary" />
        <div className="h-11 rounded-xl border border-border bg-bg-secondary" />
        <div className="h-11 rounded-xl bg-gold/25" />
        <p className="text-center text-xs text-text-muted">{t("loading")}</p>
      </div>
    </div>
  );
}
