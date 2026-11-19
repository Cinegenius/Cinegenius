"use client";

import { ArrowUpDown,Search,SlidersHorizontal,X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cloneElement,isValidElement,useEffect,useRef,useState,type ReactNode } from "react";
import BrowseSelect from "@/components/BrowseSelect";
import BrowseResultCount from "@/components/BrowseResultCount";
import NativeBrowseToolbar, { NativeBrowseQuickFilter } from "@/components/app/NativeBrowseToolbar";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useSwipeDismiss } from "@/lib/use-swipe-dismiss";
import { normalizeOccupation } from "@/lib/gripTaxonomy";


export type BrowseOption = { value: string; label: string; searchTerms?: readonly string[] };
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
  resultCount: number | null;
  resultActions?: ReactNode;
  viewControls?: ReactNode;
  nativeViewControls?: ReactNode;
  nativeQuickFilters?: ReactNode[];
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
  resultSummary, resultCount, resultActions, viewControls, nativeViewControls, nativeQuickFilters, filterCount, chips = [], onReset, resetLabel, showResultsLabel, preference, onSearch, children,
}: MobileBrowseControlsProps) {
  const uiText = useTranslations();
  const nativeAppearance = useNativeAppAppearance();

  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  useSwipeDismiss(panel, open, () => setOpen(false));

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const nativeTrigger = filterTrigger.current;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    element.showModal();
    element.querySelector<HTMLButtonElement>("[data-filter-close]")?.focus({preventScroll: true});
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? window.innerHeight;
      element.style.top = `${viewport?.offsetTop ?? 0}px`;
      element.style.height = `${height}px`;
      element.style.setProperty("--browse-panel-height", `${height * 0.88}px`);
      if (nativeAppearance && nativeTrigger) {
        const anchor = nativeTrigger.getBoundingClientRect();
        const top = viewport?.offsetTop ?? 0;
        const left = viewport?.offsetLeft ?? 0;
        const width = Math.min(328, (viewport?.width ?? window.innerWidth) - 24);
        const below = top + height - anchor.bottom - 20;
        const above = anchor.top - top - 20;
        const down = below >= Math.min(320, above);
        const room = Math.max(88, down ? below : above);
        const compactViewport = Math.max(below, above) < 160;
        element.style.setProperty("--native-filter-width", `${width}px`);
        element.style.setProperty("--native-filter-left", `${Math.max(left + 12, Math.min(anchor.right - width, left + (viewport?.width ?? window.innerWidth) - width - 12))}px`);
        element.style.setProperty("--native-filter-top", `${compactViewport ? top + 12 : down ? anchor.bottom + 8 : anchor.top - 8}px`);
        element.style.setProperty("--native-filter-height", `${compactViewport ? Math.max(88, height - 24) : Math.min(420, room)}px`);
        element.style.setProperty("--native-filter-shift", compactViewport || down ? "none" : "translateY(-100%)");
      }
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
      const restoreFocus = nativeAppearance && nativeTrigger?.isConnected ? nativeTrigger : previousFocus;
      if (restoreFocus instanceof HTMLElement && restoreFocus.isConnected) restoreFocus.focus({preventScroll: true});
    };
  }, [open, nativeAppearance]);

  return (
    <section className="mobile-browse-controls" aria-label={uiText("Ui.text_18e437adcea246")}>
      <div className="site-container mobile-browse-controls__inner">
        <label className={`mobile-browse-search${nativeAppearance ? " native-browse-search" : ""}`}>
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{searchPlaceholder}</span>
          <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={nativeAppearance ? uiText("UnifiedSearch.placeholder") : searchPlaceholder} onKeyDown={event => { if (event.key === "Enter" && onSearch) { event.preventDefault(); onSearch(); } }} />
          {onSearch && <button data-search-submit type="button" aria-label={uiText("Organizations.search")} onClick={onSearch}><Search size={18} /></button>}
          {query && <button type="button" aria-label={uiText("locations.landingClear")} onClick={() => onQueryChange("")}><X size={17} /></button>}
        </label>

        {!nativeAppearance && <div className="mobile-browse-controls__row">
          <button type="button" className="mobile-browse-action" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>{uiText.rich("Ui.text_91811d44ec1fe7", { part1: () => (<SlidersHorizontal size={16} />), part2: chunks => (<span>{chunks}</span>), value3: () => (filterCount > 0 && <span className="mobile-browse-count">{filterCount}</span>) })}</button>
          <BrowseSelect label={uiText("creators.sort")} value={sortValue} options={sortOptions} onChange={onSortChange}
            icon={<ArrowUpDown size={15} />} className="flex-1" triggerClassName="mobile-browse-sort w-full text-left" />
          {preference}
        </div>}

        {!nativeAppearance && categoryPlacement === "toolbar" && <label className="mobile-browse-category">
          <span>{categoryLabel}</span>
          <MobileFilterSelect label={categoryLabel} value={categoryValue} onChange={onCategoryChange} options={categories} placeholder={allCategoryLabel} />
        </label>}

        <div className="mobile-browse-summary">
          {nativeAppearance ? <NativeBrowseToolbar count={resultCount} countLabel={resultSummary} viewControls={nativeViewControls ?? viewControls}
            filters={nativeQuickFilters ?? [
              ...(categories.length || categoryValue ? [<NativeBrowseQuickFilter key="category" label={categoryLabel} value={categoryValue} onChange={onCategoryChange} options={[{value:"",label:allCategoryLabel},...categories]} />] : []),
              <NativeBrowseQuickFilter key="sort" label={uiText("creators.sort")} value={sortValue} options={sortOptions} onChange={onSortChange} icon={<ArrowUpDown size={18} />} />,
            ]}
            moreAction={<button ref={filterTrigger} type="button" onClick={() => setOpen(true)} aria-label={uiText("locations.filterBtn")} aria-haspopup="dialog" aria-expanded={open}><SlidersHorizontal size={17} aria-hidden="true" />{filterCount > 0 && <span className="native-browse-filter-dot" aria-hidden="true" />}</button>} />
            : viewControls ? <div className="mobile-browse-summary-row">{resultActions ? <div className="mobile-browse-summary-with-actions"><BrowseResultCount count={resultCount} label={resultSummary} /><div className="mobile-browse-result-actions">{resultActions}</div></div> : <BrowseResultCount count={resultCount} label={resultSummary} />}{viewControls}</div> : <BrowseResultCount count={resultCount} label={resultSummary} />}
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
        <dialog ref={dialog} className="mobile-filter-dialog" data-native-browse-dialog={nativeAppearance ? "v1" : undefined} aria-modal="true" aria-label={uiText("locations.filterBtn")} onCancel={event => { event.preventDefault(); setOpen(false); }}
          onKeyDown={event => {
            if (!nativeAppearance || event.key !== "Tab" || event.defaultPrevented) return;
            // WebKit can otherwise send Tab to browser chrome when its system
            // button-navigation preference is off. Keep this modal usable too.
            const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[tabindex]"))
              .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[hidden],[inert]") && element.getClientRects().length > 0);
            if (!targets.length) return;
            const current = targets.indexOf(document.activeElement as HTMLElement);
            const index = current < 0 ? (event.shiftKey ? targets.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
            event.preventDefault();
            targets[index].focus();
          }}>
          <button tabIndex={-1} className="mobile-filter-dialog__backdrop" aria-label={uiText("Ui.text_5f423bd7da0e95")} onClick={() => setOpen(false)} />
          <section ref={panel} className="mobile-filter-panel browse-popup-surface">
            <div data-swipe-dismiss-handle className="mobile-filter-panel__handle" />
            <header data-swipe-dismiss-handle className="mobile-filter-panel__header">
              <h2>{uiText("locations.filterBtn")}</h2>
              <button data-filter-close type="button" aria-label={uiText("ProfilePhotoCrop.close")} onClick={() => setOpen(false)}><X size={20} /></button>
            </header>
            <div className="mobile-filter-panel__content">
              {nativeAppearance && <>
                {sortOptions.length > 1 && <MobileFilterField label={uiText("creators.sort")}><MobileFilterSelect label={uiText("creators.sort")} value={sortValue} options={sortOptions} onChange={onSortChange} placeholder={uiText("creators.sort")} /></MobileFilterField>}
                {preference}
                {resultActions && <div className="mobile-browse-result-actions">{resultActions}</div>}
              </>}
              {(categories.length > 0 || categoryValue) && <label className="mobile-filter-field">
                <span>{categoryLabel}</span>
                <MobileFilterSelect label={categoryLabel} value={categoryValue} onChange={onCategoryChange} options={categories} placeholder={allCategoryLabel} />
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
  if (isValidElement<{ options?: BrowseOption[]; value?: string; label?: string }>(children) && children.type === MobileFilterSelect) {
    if (!children.props.value && !children.props.options?.length) return null;
    children = cloneElement(children, { label: children.props.label ?? label });
  }
  return <label className="mobile-filter-field"><span>{label}</span>{children}</label>;
}

export function MobileFilterSelect({ value, onChange, options, placeholder, label }: {
  value: string;
  onChange: (value: string) => void;
  options: BrowseOption[];
  placeholder: string;
  label?: string;
}) {
  return <BrowseSelect label={label ?? placeholder} value={value} onChange={onChange}
    triggerClassName="browse-filter-select"
    options={[
      { value: "", label: placeholder },
      ...(value && !options.some(option => option.value === value) ? [{ value, label: value, disabled: true }] : []),
      ...options,
    ]} />;
}

export function BrowseRoleFilter({ label, placeholder, options, selected, onChange }: { label: string; placeholder: string; options: BrowseOption[]; selected: Set<string>; onChange: (values: Set<string>) => void }) {
  const [query, setQuery] = useState("");
  const t = useTranslations("creators");
  if (!options.length && !selected.size) return null;
  const normalizedQuery = normalizeOccupation(query);
  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const visible = options.filter(option => !normalizedQuery || [option.label, ...(option.searchTerms ?? [])].some(term => {
    const normalized = normalizeOccupation(term);
    return normalized.includes(normalizedQuery) || normalized.replaceAll(" ", "").includes(compactQuery);
  }));
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
