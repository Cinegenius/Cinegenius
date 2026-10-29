"use client";

import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Check, Move, RotateCcw, X } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import { dragProfilePhoto, profilePhotoCrop, profilePhotoStyle, type ProfilePhotoCrop } from "@/lib/profile-photo";
import type { ProfileFocalPoint } from "@/lib/profile-cover";

export type FocalPoint = ProfileFocalPoint;

export default function FocalPointPicker({ imageUrl, initial, onSave, onClose }: {
  imageUrl: string; initial?: FocalPoint; onSave: (point: FocalPoint) => void; onClose: () => void;
}) {
  const t = useTranslations("ProfilePhotoCrop");
  const [crop, setCrop] = useState(() => profilePhotoCrop(initial));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const image = useRef({ width: 0, height: 0 });
  const drag = useRef<{ id: number; x: number; y: number; crop: ProfilePhotoCrop; width: number; height: number } | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!loaded || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, crop, width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (start?.id !== event.pointerId) return;
    setCrop(dragProfilePhoto(start.crop, { x: event.clientX - start.x, y: event.clientY - start.y }, start, image.current));
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && drag.current?.id === event.pointerId) drag.current = null;
  }

  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 sm:p-5">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="portrait-crop-title" aria-describedby="portrait-crop-description" onKeyDown={keyDown}
      className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0"><h2 id="portrait-crop-title" className="font-semibold text-text-primary">{t("title")}</h2><p id="portrait-crop-description" className="mt-1 text-xs leading-relaxed text-text-muted">{t("description")}</p></div>
        <button ref={close} type="button" onClick={onClose} aria-label={t("close")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-text-muted"><X size={18} /></button>
      </header>
      <div className="min-h-0 space-y-3 overflow-y-auto p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("preview")}</p>
        <div role="group" aria-label={t("move")} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          className="relative mx-auto aspect-square w-full max-w-64 touch-none select-none overflow-hidden rounded-lg border border-border bg-bg-primary cursor-grab active:cursor-grabbing">
          <MediaImage src={imageUrl} alt={t("preview")} fill sizes="256px" mediaSize="detail" unoptimized className="pointer-events-none object-cover" style={profilePhotoStyle({ card: crop })}
            onLoad={event => { image.current = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }; setLoaded(true); }}
            onError={() => { setFailed(true); setLoaded(false); }} />
        </div>
        {!loaded && <p role={failed ? "alert" : "status"} className={`text-center text-xs ${failed ? "text-error" : "text-text-muted"}`}>{t(failed ? "loadError" : "loading")}</p>}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-text-muted"><Move size={15} className="shrink-0" />{t("move")}</p>
        {(["x", "y", "zoom"] as const).map(axis => <label key={axis} className="flex min-h-11 items-center gap-3 text-xs text-text-secondary">
          <span className="w-24 shrink-0">{t(axis === "x" ? "horizontal" : axis === "y" ? "vertical" : "zoom")}</span>
          <input type="range" min={axis === "zoom" ? 1 : 0} max={axis === "zoom" ? 3 : 100} step={axis === "zoom" ? 0.05 : 1} value={crop[axis]} disabled={!loaded}
            onChange={event => setCrop(current => ({ ...current, [axis]: Number(event.target.value) }))} className="min-h-11 min-w-0 flex-1 accent-gold" />
          {axis === "zoom" && <span className="w-10 shrink-0 text-right">{t("zoomValue", { percent: Math.round(crop.zoom * 100) })}</span>}
        </label>)}
        <p className="text-xs leading-relaxed text-text-muted">{t("zoomHint")}</p>
        <button type="button" onClick={() => setCrop({ x: 50, y: 33, zoom: 1 })} className="inline-flex min-h-11 items-center gap-2 text-xs text-gold"><RotateCcw size={14} />{t("reset")}</button>
      </div>
      <footer className="shrink-0 space-y-2 border-t border-border p-4">
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!loaded} onClick={() => onSave({ ...(initial ?? { x: 50, y: 33 }), card: crop })} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-bg-primary disabled:opacity-50"><Check size={16} />{t("apply")}</button><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-border px-3 text-sm text-text-secondary">{t("cancel")}</button></div>
        <p className="text-xs leading-relaxed text-text-muted">{t("saveHint")}</p>
      </footer>
    </section>
  </div>;
}
