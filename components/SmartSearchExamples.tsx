"use client";

import { useTranslations } from "next-intl";

/** Populate editable input only: an example never triggers a paid request. */
export default function SmartSearchExamples({ onSelect }: { onSelect: (text: string) => void }) {
  const t = useTranslations("UnifiedSearch.discovery");
  return <div className="mt-3" role="group" aria-label={t("examplesLabel")}>
    <p className="mb-1 text-xs text-text-muted">{t("examplesLabel")}</p>
    <div className="flex flex-wrap gap-2">{(["shoot", "crew", "studio"] as const).map(example => <button key={example} type="button" onClick={() => onSelect(t(`examples.${example}`))}
      className="min-h-11 max-w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:border-gold/40 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-gold">{t(`examples.${example}`)}</button>)}</div>
  </div>;
}
