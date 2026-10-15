"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, X } from "lucide-react";

export type BrowseOption = { value: string; label: string };
export type BrowseChip = { id: string; label: string; onRemove: () => void };

type MobileBrowseControlsProps = {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  sortValue: string;
  sortOptions: BrowseOption[];
  onSortChange: (value: string) => void;
  categoryLabel: string;
  allCategoryLabel: string;
  categories: BrowseOption[];
  categoryValue: string;
  onCategoryChange: (value: string) => void;
  resultSummary: ReactNode;
  filterCount: number;
  chips?: BrowseChip[];
  onReset: () => void;
  resetLabel: string;
  showResultsLabel: string;
  children?: ReactNode;
};

/** Shared compact search, sorting, category and filter panel for directory pages. */
export default function MobileBrowseControls({
  query, onQueryChange, searchPlaceholder, sortValue, sortOptions, onSortChange,
  categoryLabel, allCategoryLabel, categories, categoryValue, onCategoryChange,
  resultSummary, filterCount, chips = [], onReset, resetLabel, showResultsLabel, children,
}: MobileBrowseControlsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <section className="mobile-browse-controls xl:hidden" aria-label="Suche und Filter">
      <div className="site-container mobile-browse-controls__inner">
        <label className="mobile-browse-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{searchPlaceholder}</span>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={searchPlaceholder} />
          {query && <button type="button" aria-label="Suche löschen" onClick={() => onQueryChange("")}><X size={17} /></button>}
        </label>

        <div className="mobile-browse-controls__row">
          <button type="button" className="mobile-browse-action" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
            <SlidersHorizontal size={16} />
            <span>Filter</span>
            {filterCount > 0 && <span className="mobile-browse-count">{filterCount}</span>}
          </button>
          <label className="mobile-browse-sort">
            <ArrowUpDown size={15} aria-hidden="true" />
            <span className="sr-only">Sortierung</span>
            <select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <label className="mobile-browse-category">
          <span>{categoryLabel}</span>
          <select value={categoryValue} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">{allCategoryLabel}</option>
            {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <div className="mobile-browse-summary">
          <p>{resultSummary}</p>
          {chips.length > 0 && (
            <div className="mobile-browse-chips" aria-label="Aktive Filter">
              {chips.slice(0, 3).map((chip) => (
                <span key={chip.id} className="mobile-browse-chip">
                  <span className="truncate">{chip.label}</span>
                  <button type="button" aria-label={`${chip.label} entfernen`} onClick={chip.onRemove}><X size={13} /></button>
                </span>
              ))}
              {chips.length > 3 && (
                <details className="mobile-browse-chip-more">
                  <summary>+{chips.length - 3} weitere</summary>
                  <div className="mobile-browse-chips mobile-browse-chips--extra">
                    {chips.slice(3).map((chip) => (
                      <span key={chip.id} className="mobile-browse-chip">
                        <span className="truncate">{chip.label}</span>
                        <button type="button" aria-label={`${chip.label} entfernen`} onClick={chip.onRemove}><X size={13} /></button>
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="mobile-filter-dialog" role="presentation">
          <button className="mobile-filter-dialog__backdrop" aria-label="Filter schließen" onClick={() => setOpen(false)} />
          <section className="mobile-filter-panel" role="dialog" aria-modal="true" aria-label="Filter">
            <div className="mobile-filter-panel__handle" />
            <header className="mobile-filter-panel__header">
              <h2>Filter</h2>
              <button type="button" aria-label="Schließen" onClick={() => setOpen(false)}><X size={20} /></button>
            </header>
            <div className="mobile-filter-panel__content">
              <label className="mobile-filter-field">
                <span>{categoryLabel}</span>
                <select value={categoryValue} onChange={(event) => onCategoryChange(event.target.value)}>
                  <option value="">{allCategoryLabel}</option>
                  {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {children}
            </div>
            <footer className="mobile-filter-panel__footer">
              <button type="button" className="mobile-filter-reset" onClick={onReset}>{resetLabel}</button>
              <button type="button" className="mobile-filter-apply" onClick={() => setOpen(false)}>{showResultsLabel}</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

export function MobileFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="mobile-filter-field"><span>{label}</span>{children}</div>;
}

export function MobileFilterSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  options: BrowseOption[];
  placeholder: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
