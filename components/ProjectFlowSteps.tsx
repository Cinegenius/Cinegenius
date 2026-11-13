"use client";
import { useTranslations } from "next-intl";

export default function ProjectFlowSteps({ current }: { current: 0 | 1 | 2 }) {
  const t = useTranslations("projects");
  return <ol className="mb-6 grid grid-cols-3 gap-2 text-xs sm:text-sm" aria-label={t("flowLabel")}>
    {(["stepFind", "stepDetails", "stepReview"] as const).map((key, index) => <li key={key} aria-current={current === index ? "step" : undefined}
      className={`min-w-0 rounded-xl border px-3 py-3 ${current === index ? "border-gold/30 bg-gold/5 text-gold" : "border-border text-text-muted"}`}>
      <span className="mb-1 block font-semibold" aria-hidden="true">{index + 1}</span>{t(key)}
    </li>)}
  </ol>;
}
