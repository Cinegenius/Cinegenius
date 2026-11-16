"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Building2, Layers3, MapPin, Search, ShoppingBag, Users } from "lucide-react";
import { SMART_MAP_COLORS } from "@/lib/smart-search-map";

const areas = [
  { id: "crew", Icon: Users, x: 94, y: 55 },
  { id: "locations", Icon: MapPin, x: 233, y: 68 },
  { id: "marketplace", Icon: ShoppingBag, x: 137, y: 130 },
  { id: "companies", Icon: Building2, x: 287, y: 126 },
] as const;

/** Illustrative only: no real coordinates, member data, tiles or search requests. */
export default function SmartSearchPreview() {
  const t = useTranslations("UnifiedSearch");
  return <figure className="mt-4 w-full max-w-md space-y-3" data-smart-preview>
    <figcaption className="text-xs font-medium text-gold">{t("previewLabel")}</figcaption>
    <svg viewBox="0 0 360 176" role="img" aria-label={t("previewMapAlt")} className="block w-full rounded-xl border border-border">
      <rect width="360" height="176" fill="#cbd0c0" />
      <path d="M0 16h67l20 45-32 20H0zm269 98 91-19v81h-103z" fill="#a9bea0" />
      <path d="M173-10c-37 48 61 60 26 108s-16 59 3 90" fill="none" stroke="#88b6c3" strokeWidth="18" />
      <g fill="none" stroke="#f2eddd" strokeWidth="7">
        <path d="M-8 99 367 42M47-8l68 192M255-8l-24 192M-5 152l371-27" />
      </g>
      <g fill="none" stroke="#e4e1d3" strokeWidth="3">
        <path d="m0 36 360 66M138-4l-90 183M322-5l-17 181M6 173l335-159" />
      </g>
      {areas.map(({ id, Icon, x, y }) => <g key={id} transform={`translate(${x} ${y})`}>
        <path d="M0 22-8 9H8Z" fill={SMART_MAP_COLORS[id]} stroke="#202530" strokeWidth="1.5" />
        <circle r="17" fill={SMART_MAP_COLORS[id]} stroke="#202530" strokeWidth="2" />
        <Icon x="-9" y="-9" width="18" height="18" color="#171b24" strokeWidth="2" aria-hidden="true" />
      </g>)}
    </svg>
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-text-secondary">
      {areas.map(({ id, Icon }) => <li key={id} className="flex min-w-0 items-center gap-2">
        <Icon size={15} className="shrink-0" style={{ color: SMART_MAP_COLORS[id] }} aria-hidden="true" />
        <span className="break-words">{t(`areas.${id}`)}</span>
      </li>)}
    </ul>
    <ol className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs text-text-secondary">
      {[
        { key: "previewWish", Icon: Search },
        { key: "previewMatches", Icon: MapPin },
        { key: "previewSorted", Icon: Layers3 },
      ].map(({ key, Icon }, index) => <li key={key} className="relative min-w-0">
        <Icon size={20} aria-hidden="true" className="mx-auto mb-2 text-gold" />
        {index < 2 && <ArrowRight size={12} aria-hidden="true" className="absolute -right-2 top-1 text-text-muted" />}
        <span className="break-words">{t(key)}</span>
      </li>)}
    </ol>
    <p className="text-xs leading-relaxed text-text-muted">{t("previewNote")}</p>
  </figure>;
}
