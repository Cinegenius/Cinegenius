"use client";

import { LayoutList, Map } from "lucide-react";
import { useTranslations } from "next-intl";

export default function FloatingMapToggle({ mapActive, onToggle }: { mapActive: boolean; onToggle: () => void }) {
  const t = useTranslations("locations");
  const Icon = mapActive ? LayoutList : Map;
  return <button type="button" onClick={onToggle} className="browse-map-toggle xl:hidden">
    <Icon size={16} aria-hidden="true" className="shrink-0 text-gold/80" />
    <span className="min-w-0 [overflow-wrap:anywhere]">{t(mapActive ? "viewList" : "viewMap")}</span>
  </button>;
}
