"use client";
import {useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode} from "react";
import {useTranslations} from "next-intl";
import {X} from "lucide-react";

export default function MessagingDialog({open, title, onClose, busy = false, compact = false, children, footer}: {open: boolean; title: string; onClose: () => void; busy?: boolean; compact?: boolean; children: ReactNode; footer?: ReactNode}) {
  const t = useTranslations("Messaging");
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const latestClose = useRef(onClose);
  useLayoutEffect(() => {latestClose.current = onClose;});
  const [viewport, setViewport] = useState<{height: number; top: number} | null>(null);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal(); close.current?.focus();
    const visible = window.visualViewport;
    const update = () => setViewport({height: visible?.height ?? window.innerHeight, top: visible?.offsetTop ?? 0});
    const back = () => latestClose.current();
    window.addEventListener("popstate", back);
    update(); visible?.addEventListener("resize", update); visible?.addEventListener("scroll", update); window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("popstate", back);
      if (element.open) element.close();
      document.body.style.overflow = overflow;
      visible?.removeEventListener("resize", update); visible?.removeEventListener("scroll", update); window.removeEventListener("resize", update);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return <dialog ref={dialog} aria-modal="true" aria-labelledby={titleId} onCancel={event => {event.preventDefault(); if (!busy) onClose();}}
    style={viewport ? {top: `calc(${viewport.top + 12}px + env(safe-area-inset-top, 0px))`, ...(compact ? {maxHeight:`calc(${Math.max(0, viewport.height - 24)}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`} : {height: `min(44rem, calc(${Math.max(0, viewport.height - 24)}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))`})} : undefined}
    className={`${compact ? "" : "h-[min(44rem,calc(100dvh_-_1.5rem))]"} fixed inset-x-0 bottom-auto top-3 z-[90] mx-auto my-0 flex max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-bg-primary p-0 text-text-primary shadow-2xl backdrop:bg-black/75`}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border p-3 sm:p-4"><h2 id={titleId} className="min-w-0 break-words text-lg font-semibold [overflow-wrap:anywhere]">{title}</h2><button ref={close} type="button" disabled={busy} onClick={onClose} aria-label={t("close")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-bg-elevated disabled:opacity-40"><X size={20}/></button></header>
    <div className={`${compact ? "" : "flex-1"} min-h-0 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4`}>{children}</div>
    {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border p-3 sm:p-4">{footer}</footer>}
  </dialog>;
}
