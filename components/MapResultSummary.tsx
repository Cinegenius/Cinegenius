"use client";

import { useTranslations } from "next-intl";
import type { mapResultCounts } from "@/lib/location-map";

type Counts = ReturnType<typeof mapResultCounts>;

/** Always visible; entries without a public map point remain reachable in the list. */
export default function MapResultSummary({ counts, onShowAll, notice }: {
  counts: Counts; onShowAll?: () => void; notice?: string;
}) {
  const t = useTranslations("directoryMap");
  return <div className="min-w-0 space-y-1 text-xs text-text-muted">
    <div role="status" className="space-y-1 [overflow-wrap:anywhere]">
      {notice ? <p>{notice}</p> : <>
        <p>{t("mapped", { count: counts.visible })}{counts.outside > 0 && <> · {t("outside", { count: counts.outside })}</>}</p>
        {counts.unmapped > 0 && <p>{t("unmapped", { count: counts.unmapped })}</p>}
      </>}
    </div>
    {!notice && onShowAll && (counts.outside > 0 || counts.unmapped > 0) && <button type="button" onClick={onShowAll} className="inline-flex min-h-11 items-center text-left text-gold underline underline-offset-4">{t("showAll", { count: counts.total })}</button>}
  </div>;
}
