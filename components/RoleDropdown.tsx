"use client";

import { useTranslations } from "next-intl";
import { animalRoleLabel, animalOccupation } from "@/lib/animal-taxonomy";
import { useState, useRef } from "react";
import FloatingPanel from "@/components/FloatingPanel";
import { ChevronDown, Search } from "lucide-react";
import { gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";

export default function RoleDropdown({
  value,
  onChange,
  options,
  placeholder = "Rolle wählen…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const animals = useTranslations("FilmAnimals");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const normalizedQuery = normalizeOccupation(query);
  const filtered = options.filter((option) =>
    !normalizedQuery || normalizeOccupation([...gripSearchTerms(option), animalRoleLabel(option, animals), ...((role => role ? [role.labelEn, ...role.aliases] : [])(animalOccupation(option)))].join(" ")).includes(normalizedQuery),
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm hover:border-gold/50 focus:outline-none focus:border-gold transition-colors"
      >
        <span className={value ? "text-text-primary" : "text-text-muted"}>{value ? animalRoleLabel(value, animals) : placeholder}</span>
        <ChevronDown size={13} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <FloatingPanel anchorRef={triggerRef} onClose={() => setOpen(false)} width={180} align="left" matchAnchorWidth className="bg-bg-elevated border border-border rounded-lg shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={11} className="text-text-muted shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 bg-transparent text-xs text-text-primary focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">Keine Treffer</p>}
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-secondary ${value === o ? "text-gold font-semibold" : "text-text-primary"}`}
              >
                {animalRoleLabel(o, animals)}
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}
