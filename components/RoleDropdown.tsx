"use client";

import { useTranslations , useLocale } from "next-intl";
import { animalRoleLabel, animalOccupation } from "@/lib/animal-taxonomy";
import { useMemo, useState, useRef } from "react";
import FloatingPanel from "@/components/FloatingPanel";
import { ChevronDown, Search } from "lucide-react";
import { gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";
import { getDepartmentRoleLabel, getDepartmentRoleFormLabels, getDepartmentRoleSearchTerms, getOccupationSearchTerms, resolveDepartmentOccupation, taxonomyLabel } from "@/lib/departments";


export default function RoleDropdown({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const locale = useLocale();
  const taxonomyText = useTranslations("Taxonomy");
  const uiText = useTranslations();
  const animals = useTranslations("FilmAnimals");
  if (placeholder === undefined) placeholder = uiText("Ui.text_e6d42eab5f5bc9");
  const searchOptions = useMemo(() => options.map(value => {
    const occupation = resolveDepartmentOccupation(value);
    const label = occupation
      ? getDepartmentRoleLabel(occupation.department.id, occupation.role, locale, animals, taxonomyText)
      : animalRoleLabel(taxonomyLabel(value, uiText), animals);
    const terms = occupation
      ? getDepartmentRoleSearchTerms(occupation.department, occupation.role, label,
          getDepartmentRoleFormLabels(occupation.department.id, occupation.role, locale, animals, taxonomyText))
      : getOccupationSearchTerms(value);
    const animal = animalOccupation(value);
    return { value, label, terms: [...terms, ...gripSearchTerms(value), label, ...(animal ? [animal.labelEn, ...animal.aliases] : [])].map(normalizeOccupation) };
  }), [options, locale, animals, taxonomyText, uiText]);
  const roleLabel = (role: string) => {
    const cached = searchOptions.find(option => option.value === role);
    if (cached) return cached.label;
    // A saved canonical title can differ from the legacy options used by this form.
    const occupation = resolveDepartmentOccupation(role);
    return occupation
      ? getDepartmentRoleLabel(occupation.department.id, occupation.role, locale, animals, taxonomyText)
      : animalRoleLabel(taxonomyLabel(role, uiText), animals);
  };

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const normalizedQuery = normalizeOccupation(query);
  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const filtered = searchOptions.filter(option => !normalizedQuery || option.terms.some(term =>
    term.includes(normalizedQuery) || term.replaceAll(" ", "").includes(compactQuery),
  )).map(option => option.value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="min-h-11 w-full flex items-center justify-between gap-2 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm hover:border-gold/50 focus:outline-none focus:border-gold transition-colors"
      >
        <span className={value ? "text-text-primary" : "text-text-muted"}>{value ? roleLabel(value) : placeholder}</span>
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
              placeholder={uiText("search.buttonLabel")}
              className="flex-1 bg-transparent text-xs text-text-primary focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">{uiText("Ui.text_6df7e9f71b5f9a")}</p>}
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); setQuery(""); }}
                className={`min-h-11 w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-secondary ${value === o ? "text-gold font-semibold" : "text-text-primary"}`}
              >
                {roleLabel(o)}
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}
