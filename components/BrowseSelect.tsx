'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import FloatingPanel from '@/components/FloatingPanel';
import { Check, ChevronDown } from 'lucide-react';

export type BrowseSelectOption = { value: string; label: string; disabled?: boolean };

/** Reveal a keyboard choice only within the popup, never scroll its dialog/page. */
function revealOption(list: HTMLDivElement | null, index: number) {
  const panel = list?.parentElement, option = list?.children.item(index);
  if (!panel || !option) return;
  const bounds = option.getBoundingClientRect();
  const top = panel.getBoundingClientRect().top + panel.clientTop;
  const bottom = top + panel.clientHeight;
  if (bounds.top < top) panel.scrollTop -= top - bounds.top;
  else if (bounds.bottom > bottom) panel.scrollTop += bounds.bottom - bottom;
}

/** Local select-only listbox with a neutral surface and native-size targets. */
export default function BrowseSelect({label, value, options, onChange, disabled = false, icon, className = "", triggerClassName, id: triggerId, compactEmptyLabel = false, iconOnly = false}: {
  label: string; value: string; options: BrowseSelectOption[]; onChange: (value: string) => void; disabled?: boolean; icon?: ReactNode; className?: string; triggerClassName?: string; id?: string; compactEmptyLabel?: boolean; iconOnly?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const typed = useRef({text: '', at: 0});
  const initialActive = useRef(0);
  const selected = options.find(option => option.value === value);
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus({preventScroll: true}); };
  const show = (last = false) => {
    if (disabled || !enabled.length) return;
    const current = options.findIndex(option => option.value === value && !option.disabled);
    setPortalRoot(trigger.current?.closest<HTMLDialogElement>('dialog[open]') ?? null);
    initialActive.current = current >= 0 ? current : last ? enabled[enabled.length - 1] : enabled[0];
    setActive(initialActive.current);
    setOpen(true);
  };
  useEffect(() => {
    if (open) {
      list.current?.focus({preventScroll: true});
      revealOption(list.current, initialActive.current);
    }
  }, [open]);
  const activateByKeyboard = (index: number) => { setActive(index); revealOption(list.current, index); };

  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    // The popup is portaled at the end of body. Resume native Tab order at the
    // trigger so the next/previous field is reached, rather than the page edge.
    if (event.key === 'Tab') { trigger.current?.focus({preventScroll: true}); close(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options[active] && !options[active].disabled) { close(true); onChange(options[active].value); }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = enabled.indexOf(active);
      activateByKeyboard(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1]
        : enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now(), text = (now - typed.current.at < 700 ? typed.current.text : '') + event.key.toLocaleLowerCase();
      typed.current = {text, at: now};
      const next = enabled.find(index => options[index].label.toLocaleLowerCase().startsWith(text));
      if (next !== undefined) activateByKeyboard(next);
    }
  }

  return <div className={`relative min-w-0 ${className}`}>
    <button ref={trigger} id={triggerId} type="button" aria-label={label} aria-describedby={`${id}-value`} title={selected?.label ?? label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} disabled={disabled}
      onClick={() => open ? close() : show()} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); } }}
      data-icon-only={iconOnly || undefined} data-filter-active={iconOnly && value !== options[0]?.value && value !== "all" || undefined}
      className={triggerClassName ?? "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-left text-sm text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60"}>
      {icon && <span aria-hidden="true" className="shrink-0 text-text-muted">{icon}</span>}<span id={`${id}-value`} className={iconOnly ? "sr-only" : "min-w-0 flex-1 truncate"}>{compactEmptyLabel && !value ? label : selected?.label ?? label}</span><ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <FloatingPanel anchorRef={trigger} onClose={() => close()} width={180} align="left" matchAnchorWidth portalRoot={portalRoot}
      className="browse-popup-surface rounded-2xl border p-1.5">
      <div ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${id}-option-${active}`} onKeyDown={keyDown} className="outline-none">
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
        onPointerMove={event => { if (event.pointerType === 'mouse' && !option.disabled) setActive(index); }} onClick={() => { if (!option.disabled) { close(true); onChange(option.value); } }}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ${option.disabled ? 'cursor-default text-text-muted opacity-60' : active === index ? 'bg-bg-elevated text-text-primary' : 'text-text-primary hover:bg-bg-elevated'}`}>
        <span className="min-w-0 flex-1 break-words">{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" className="shrink-0 text-gold" />}
      </div>)}
      </div>
    </FloatingPanel>}
  </div>;
}
