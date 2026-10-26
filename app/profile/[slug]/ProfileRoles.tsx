"use client";

import { useState } from "react";
import { getProfilePositionsPreview } from "@/lib/profile-display";

/** Shared, wrapping occupation display for every public profile type. */
export default function ProfileRoles({
  positions,
  tone = "default",
}: {
  positions: readonly string[];
  tone?: "default" | "hero";
}) {
  const [expanded, setExpanded] = useState(false);
  if (positions.length === 0) return null;

  const { visible, remaining } = getProfilePositionsPreview(positions, expanded, 3);
  const primaryClass = tone === "hero"
    ? "border-gold/40 bg-black/70 text-gold"
    : "border-gold/40 bg-gold/12 text-gold";
  const secondaryClass = tone === "hero"
    ? "border-white/20 bg-black/60 text-white"
    : "border-border bg-bg-secondary text-text-secondary";

  return (
    <div className="mt-2 min-w-0 max-w-full">
      <div className="flex max-w-full min-w-0 flex-wrap items-start gap-2 [overflow-wrap:anywhere]">
        {visible.map((position, index) => (
          <span
            key={`${position.trim().toLocaleLowerCase("de")}-${index}`}
            className={`inline-flex min-w-0 max-w-full whitespace-normal break-words rounded-full border px-2.5 py-1 text-xs font-medium leading-snug [overflow-wrap:anywhere] ${index === 0 ? primaryClass : secondaryClass}`}
          >
            {position}
          </span>
        ))}
      </div>
      {positions.length > 3 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light"
          style={tone === "hero" ? { textShadow: "0 1px 2px #000, 0 0 5px #000" } : undefined}
        >
          {expanded ? "Weniger Tätigkeiten anzeigen" : `Weitere Tätigkeiten anzeigen (${remaining})`}
        </button>
      )}
    </div>
  );
}
