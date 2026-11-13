"use client";

import { ArrowUpDown,Search,SlidersHorizontal,X } from "lucide-react";
import { useTranslations } from "next-intl";
import { isValidElement,useEffect,useRef,useState,type ReactNode } from "react";


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
  categoryPlacement?: "toolbar" | "filters";
  resultSummary: ReactNode;
  resultActions?: ReactNode;
  viewControls?: ReactNode;
  filterCount: number;
  chips?: BrowseChip[];
  onReset: () => void;
  resetLabel: string;
  showResultsLabel: string;
  preference?: ReactNode;
  onSearch?: () => void;
  children?: ReactNode;
};

/** Shared compact search, sorting, category and filter panel for directory pages. */
export default function MobileBrowseControls({
  query, onQueryChange, searchPlaceholder, sortValue, sortOptions, onSortChange,
  categoryLabel, allCategoryLabel, categories, categoryValue, onCategoryChange, categoryPlacement = "filters",
  resultSummary, resultActions, viewControls, filterCount, chips = [], onReset, resetLabel, showResultsLabel, preference, onSearch, children,
}: MobileBrowseControlsProps) {
  const uiText = useTranslations();

  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    element.showModal();
    element.querySelector<HTMLButtonElement>("[data-filter-close]")?.focus();
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? window.innerHeight;
      element.style.top = `${viewport?.offsetTop ?? 0}px`;
      element.style.height = `${height}px`;
      element.style.setProperty("--browse-panel-height", `${height * 0.88}px`);
    };
    const back = () => setOpen(false);
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    window.addEventListener("popstate", back);
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previous;
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      window.removeEventListener("popstate", back);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  return (
    <section className="mobile-browse-controls" aria-label={uiText("Ui.text_18e437adcea246")}>
      <div className="site-container mobile-browse-controls__inner">
        <label className="mobile-browse-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{searchPlaceholder}</span>
          <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={searchPlaceholder} onKeyDown={event => { if (event.key === "Enter" && onSearch) { event.preventDefault(); onSearch(); } }} />
          {onSearch && <button type="button" aria-label={uiText("Organizations.search")} onClick={onSearch}><Search size={18} /></button>}
          {query && <button type="button" aria-label={uiText("locations.landingClear")} onClick={() => onQueryChange("")}><X size={17} /></button>}
        </label>

        <div className="mobile-browse-controls__row">
          <button type="button" className="mobile-browse-action" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>{uiText.rich("Ui.text_91811d44ec1fe7", { part1: () => (<SlidersHorizontal size={16} />), part2: chunks => (<span>{chunks}</span>), value3: () => (filterCount > 0 && <span className="mobile-browse-count">{filterCount}</span>) })}</button>
          <label className="mobile-browse-sort">
            <ArrowUpDown size={15} aria-hidden="true" />
            <span className="sr-only">{uiText("creators.sort")}</span>
            <select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {preference}
        </div>

        {categoryPlacement === "toolbar" && <label className="mobile-browse-category">
          <span>{categoryLabel}</span>
          <select value={categoryValue} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">{allCategoryLabel}</option>
            {categoryValue && !categories.some(option => option.value === categoryValue) && <option value={categoryValue} disabled>{categoryValue}</option>}
            {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>}

        <div className="mobile-browse-summary">
          {viewControls ? <div className="mobile-browse-summary-row">{resultActions ? <div className="mobile-browse-summary-with-actions"><p role="status">{resultSummary}</p>{resultActions}</div> : <p role="status" title={typeof resultSummary === "string" ? resultSummary : undefined}>{resultSummary}</p>}{viewControls}</div> : <p role="status">{resultSummary}</p>}
          {chips.length > 0 && (
            <div className="mobile-browse-chips" aria-label={uiText("Ui.text_75e581194056a5")}>
              <button type="button" className="min-h-11 px-2 text-xs underline" onClick={onReset}>{resetLabel}</button>
              {chips.slice(0, 3).map((chip) => (
                <span key={chip.id} className="mobile-browse-chip">
                  <span className="truncate">{chip.label}</span>
                  <button type="button" aria-label={uiText("Ui.text_f10fe7a27ce274", { value1: String(chip.label) })} onClick={chip.onRemove}><X size={13} /></button>
                </span>
              ))}
              {chips.length > 3 && (
                <details className="mobile-browse-chip-more">
                  <summary>{uiText.rich("Ui.text_4527b0695b24a0", { value1: () => (chips.length - 3) })}</summary>
                  <div className="mobile-browse-chips mobile-browse-chips--extra">
                    {chips.slice(3).map((chip) => (
                      <span key={chip.id} className="mobile-browse-chip">
                        <span className="truncate">{chip.label}</span>
                        <button type="button" aria-label={uiText("Ui.text_f10fe7a27ce274", { value1: String(chip.label) })} onClick={chip.onRemove}><X size={13} /></button>
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
        <dialog ref={dialog} className="mobile-filter-dialog" aria-modal="true" aria-label={uiText("locations.filterBtn")} onCancel={event => { event.preventDefault(); setOpen(false); }}>
          <button tabIndex={-1} className="mobile-filter-dialog__backdrop" aria-label={uiText("Ui.text_5f423bd7da0e95")} onClick={() => setOpen(false)} />
          <section className="mobile-filter-panel">
            <div className="mobile-filter-panel__handle" />
            <header className="mobile-filter-panel__header">
              <h2>{uiText("locations.filterBtn")}</h2>
              <button data-filter-close type="button" aria-label={uiText("ProfilePhotoCrop.close")} onClick={() => setOpen(false)}><X size={20} /></button>
            </header>
            <div className="mobile-filter-panel__content">
              {(categories.length > 0 || categoryValue) && <label className="mobile-filter-field">
                <span>{categoryLabel}</span>
                <select value={categoryValue} onChange={(event) => onCategoryChange(event.target.value)}>
                  <option value="">{allCategoryLabel}</option>
                  {categoryValue && !categories.some(option => option.value === categoryValue) && <option value={categoryValue} disabled>{categoryValue}</option>}
            {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>}
              {children}
            </div>
            <footer className="mobile-filter-panel__footer">
              <button type="button" className="mobile-filter-reset" onClick={onReset}>{resetLabel}</button>
              <button type="button" className="mobile-filter-apply" onClick={() => { setOpen(false); onSearch?.(); }}>{showResultsLabel}</button>
            </footer>
          </section>
        </dialog>
      )}
    </section>
  );
}

export function MobileFilterField({ label, children }: { label: string; children: ReactNode }) {
  if (isValidElement<{ options?: BrowseOption[]; value?: string }>(children) && children.type === MobileFilterSelect && !children.props.value && !children.props.options?.length) return null;
  return <label className="mobile-filter-field"><span>{label}</span>{children}</label>;
}

export function MobileFilterSelect({ value, onChange, options, placeholder, label }: {
  value: string;
  onChange: (value: string) => void;
  options: BrowseOption[];
  placeholder: string;
  label?: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {value && !options.some(option => option.value === value) && <option value={value} disabled>{value}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function BrowseRoleFilter({ label, placeholder, options, selected, onChange }: { label: string; placeholder: string; options: BrowseOption[]; selected: Set<string>; onChange: (values: Set<string>) => void }) {
  const [query, setQuery] = useState("");
  const t = useTranslations("creators");
  if (!options.length && !selected.size) return null;
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <fieldset className="mobile-filter-field">
    <legend className="mb-2 text-xs text-text-muted">{label}</legend>
    <details className="rounded-xl border border-border bg-bg-primary">
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm text-text-secondary">{label}{selected.size > 0 && ` (${selected.size})`}</summary>
      <div className="space-y-2 px-3 pb-3">
        <input aria-label={placeholder} placeholder={placeholder} type="search" value={query} onChange={event => setQuery(event.target.value)} />
        <div className="max-h-64 overflow-y-auto overscroll-contain">
          {!visible.length && <p role="status" className="py-3 text-sm text-text-muted">{t("noRolesFound")}</p>}
          {visible.map(option => <label key={option.value} className="flex min-h-11 items-center gap-3 py-2 text-sm text-text-secondary">
            <input type="checkbox" className="browse-role-checkbox" checked={selected.has(option.value)} onChange={event => { const next = new Set(selected); if (event.target.checked) next.add(option.value); else next.delete(option.value); onChange(next); }} />
            <span>{option.label}</span>
          </label>)}
        </div>
      </div>
    </details>
  </fieldset>;
}
