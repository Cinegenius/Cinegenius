"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";

/** Existing map disclosure only; no map instance, account data or requests. */
export default function SmartSearchMapInfo({ native = false }: { native?: boolean }) {
  const t = useTranslations("UnifiedSearch"), mapText = useTranslations("directoryMap");
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!native) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && details.current && !details.current.contains(event.target)) details.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [native]);
  return <details ref={details} className="smart-map-info" onKeyDown={native ? event => {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  } : undefined}><summary aria-label={t("mapTitle")} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-text-muted"><Info size={16} aria-hidden="true" /></summary><div className="space-y-2 rounded-xl border border-border bg-bg-secondary p-3 text-xs text-text-muted"><p>{mapText("cityNotice")}</p><p>{mapText.rich("source", { provider: chunks => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a>, license: chunks => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a> })}</p></div></details>;
}
