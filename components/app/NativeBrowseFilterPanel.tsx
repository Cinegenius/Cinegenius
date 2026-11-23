"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, RotateCcw, X } from "lucide-react";
import styles from "./NativeBrowseFilterPanel.module.css";

export function NativeFilterTrigger({ label, icon, active, open, onClick, triggerRef }: {
  label: string; icon: ReactNode; active?: boolean; open: boolean; onClick: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  return <button ref={triggerRef} type="button" className={styles.trigger} aria-label={label} title={label}
    aria-haspopup="dialog" aria-expanded={open} data-filter-active={active || undefined} onClick={onClick}>
    {icon}<ChevronDown size={12} aria-hidden="true" />
  </button>;
}

/** One bounded top-layer panel for the two row dropdowns and additional filters.
 * No synthetic history entries; Back closes the panel and retains the real route. */
export default function NativeBrowseFilterPanel({ title, trigger, onClose, onReset, children }: {
  title: string; trigger: RefObject<HTMLButtonElement | null>; onClose: () => void; onReset: () => void; children: ReactNode;
}) {
  const ui = useTranslations(), id = useId(), dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = dialog.current, opener = trigger.current;
    if (!element) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      const top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? window.innerHeight, width = viewport?.width ?? window.innerWidth;
      const box = opener?.closest("[data-native-browse-anchor]")?.getBoundingClientRect() ?? opener?.getBoundingClientRect();
      const panelWidth = Math.min(480, Math.max(0, width - 24), box?.width ?? width - 32);
      const below = Math.max(top + 12, (opener?.getBoundingClientRect().bottom ?? box?.bottom ?? top) + 12);
      const y = height - (below - top) >= 160 ? below : top + 12;
      element.style.left = `${Math.max(left + 12, Math.min(box?.left ?? left + 16, left + width - panelWidth - 12))}px`;
      element.style.top = `${y}px`; element.style.width = `${panelWidth}px`;
      element.style.maxHeight = `${Math.max(44, top + height - y - 12)}px`;
    };
    const back = () => close.current();
    resize(); element.querySelector<HTMLElement>("[data-native-filter-close]")?.focus({ preventScroll: true });
    window.addEventListener("resize", resize); window.addEventListener("popstate", back);
    viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = overflow;
      window.removeEventListener("resize", resize); window.removeEventListener("popstate", back);
      viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [trigger]);
  return <dialog ref={dialog} className={`${styles.panel} browse-popup-surface`} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}
    onKeyDown={event => {
      if (event.key !== "Tab" || event.defaultPrevented) return;
      const elements = [...event.currentTarget.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],[tabindex]")]
        .filter(node => node.tabIndex >= 0 && !node.matches(":disabled") && !node.closest("[hidden],[inert]") && node.getClientRects().length);
      if (!elements.length) return;
      const index = elements.indexOf(document.activeElement as HTMLElement);
      event.preventDefault(); elements[(index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length].focus();
    }}>
    <header className={styles.heading}><h2 id={id}>{title}</h2>
      <button type="button" aria-label={ui("UnifiedSearch.discovery.reset")} onClick={onReset}><RotateCcw size={19} aria-hidden="true" /></button>
      <button data-native-filter-close type="button" aria-label={ui("ProfilePhotoCrop.close")} onClick={onClose}><X size={19} aria-hidden="true" /></button>
    </header>
    <div className={styles.content}>{children}</div>
  </dialog>;
}

export function NativeFilterChoices({ label, options, selected, onChange }: {
  label: string; options: { value: string; label: string; color?: string; disabled?: boolean }[];
  selected: string[]; onChange: (value: string) => void;
}) {
  return <div role="group" aria-label={label} className={styles.choices}>{options.map(option => <button key={option.value}
    type="button" aria-pressed={selected.includes(option.value)} disabled={option.disabled} onClick={() => onChange(option.value)}>
    {option.color && <span className={styles.dot} style={{ backgroundColor: option.color }} aria-hidden="true" />}
    <span className={styles.label}>{option.label}</span><span className={styles.check} aria-hidden="true">{selected.includes(option.value) && <Check size={17} />}</span>
  </button>)}</div>;
}
