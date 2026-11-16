'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import FloatingPanel from '@/components/FloatingPanel';
import { Check, ChevronDown } from 'lucide-react';

export type BrowseSelectOption = { value: string; label: string; disabled?: boolean };

/** Local select-only listbox: the board's lime surface, without an OS menu. */
export default function BrowseSelect({label, value, options, onChange, disabled = false, icon, className = "", triggerClassName}: {
  label: string; value: string; options: BrowseSelectOption[]; onChange: (value: string) => void; disabled?: boolean; icon: ReactNode; className?: string; triggerClassName?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const typed = useRef({text: '', at: 0});
  const selected = options.find(option => option.value === value);
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  const show = (last = false) => {
    if (disabled || !enabled.length) return;
    const current = options.findIndex(option => option.value === value && !option.disabled);
    setActive(current >= 0 ? current : last ? enabled[enabled.length - 1] : enabled[0]);
    setOpen(true);
  };
  useEffect(() => { if (open) list.current?.focus({preventScroll: true}); }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block: 'nearest'}); }, [active, id, open]);

  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    // The popup is portaled at the end of body. Resume native Tab order at the
    // trigger so the next/previous field is reached, rather than the page edge.
    if (event.key === 'Tab') { trigger.current?.focus(); close(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options[active] && !options[active].disabled) { close(true); onChange(options[active].value); }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = enabled.indexOf(active);
      setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1]
        : enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now(), text = (now - typed.current.at < 700 ? typed.current.text : '') + event.key.toLocaleLowerCase();
      typed.current = {text, at: now};
      const next = enabled.find(index => options[index].label.toLocaleLowerCase().startsWith(text));
      if (next !== undefined) setActive(next);
    }
  }

  return <div className={`relative min-w-0 ${className}`}>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} disabled={disabled}
      onClick={() => open ? close() : show()} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); } }}
      className={triggerClassName ?? "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-left text-sm text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60"}>
      <span aria-hidden="true" className="shrink-0 text-text-muted">{icon}</span><span className="min-w-0 flex-1 break-words">{selected?.label ?? label}</span><ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-gold transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <FloatingPanel anchorRef={trigger} onClose={() => close()} width={180} align="left" matchAnchorWidth
      className="rounded-2xl border border-gold/40 bg-bg-secondary/90 bg-gradient-to-br from-gold/[0.12] via-bg-secondary/95 to-cyan-400/[0.08] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${id}-option-${active}`} onKeyDown={keyDown} className="outline-none">
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
        onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => { if (!option.disabled) { close(true); onChange(option.value); } }}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ${option.disabled ? 'cursor-default text-text-muted opacity-60' : active === index ? 'bg-gold/15 text-gold' : 'text-text-primary hover:bg-gold/10'}`}>
        <span className="min-w-0 flex-1 break-words">{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" className="shrink-0 text-gold" />}
      </div>)}
      </div>
    </FloatingPanel>}
  </div>;
}
