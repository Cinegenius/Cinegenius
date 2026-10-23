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

  const { visible, remaining } = getProfilePositionsPreview(positions, expanded);
  const primaryClass = tone === "hero"
    ? "border-gold/30 bg-gold/20 text-gold drop-shadow-md"
    : "border-gold/40 bg-gold/12 text-gold";
  const secondaryClass = tone === "hero"
    ? "border-white/15 bg-black/20 text-white/80"
    : "border-border bg-bg-secondary text-text-secondary";

  return (
    <div className="mt-3 min-w-0 max-w-full">
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
      {remaining > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light"
        >
          {expanded ? "Weniger Tätigkeiten anzeigen" : `Weitere Tätigkeiten anzeigen (${remaining})`}
        </button>
      )}
    </div>
  );
}
