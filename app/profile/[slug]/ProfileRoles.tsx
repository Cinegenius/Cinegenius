"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getProfilePositionsPreview } from "@/lib/profile-display";

/** Shared, wrapping occupation display for every public profile type. */
export default function ProfileRoles({
  positions,
  tone = "default",
  secondaryOnly = false,
}: {
  positions: readonly string[];
  tone?: "default" | "hero";
  secondaryOnly?: boolean;
}) {
  const t = useTranslations("profileRoles");
  const [expanded, setExpanded] = useState(false);
  if (positions.length === 0) return null;

  const previewCount = secondaryOnly ? 2 : 3;
  const { visible, remaining } = getProfilePositionsPreview(positions, expanded, previewCount);
  const primaryClass = tone === "hero"
    ? "border-gold/40 bg-black/70 text-gold"
    : "border-gold/40 bg-gold/12 text-gold";
  const secondaryClass = tone === "hero"
    ? "border-white/20 bg-black/60 text-white"
    : "border-border bg-bg-secondary text-text-secondary";

  return (
    <div className="mt-2 min-w-0 max-w-full">
      {secondaryOnly && <p className="mb-2 text-sm font-semibold text-text-primary">{t("additional")}</p>}
      <div className="flex max-w-full min-w-0 flex-wrap items-start gap-2 [overflow-wrap:anywhere]">
        {visible.map((position, index) => (
          <span
            key={`${position.trim().toLocaleLowerCase("de")}-${index}`}
            className={`inline-flex min-w-0 max-w-full whitespace-normal break-words rounded-full border px-2.5 py-1 text-xs font-medium leading-snug [overflow-wrap:anywhere] ${index === 0 && !secondaryOnly ? primaryClass : secondaryClass}`}
          >
            {position}
          </span>
        ))}
      </div>
      {positions.length > previewCount && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light"
          style={tone === "hero" ? { textShadow: "0 1px 2px #000, 0 0 5px #000" } : undefined}
        >
          {expanded ? t("showLess") : t("showMore", { count: remaining })}
        </button>
      )}
    </div>
  );
}
