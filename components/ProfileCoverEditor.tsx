"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Move, RotateCcw, X } from "lucide-react";
import { dragCoverPosition, profileCoverSettings, profileCoverStyle, type CoverPosition, type ProfileFocalPoint } from "@/lib/profile-cover";

export default function ProfileCoverEditor({ src, focalPoint, onChange, onRemove }: {
  src: string;
  focalPoint: ProfileFocalPoint;
  onChange: (next: ProfileFocalPoint) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<"desktop" | "phone">("desktop");
  const [dragging, setDragging] = useState(false);
  const imageSize = useRef({ width: 0, height: 0 });
  const drag = useRef<{ id: number; clientX: number; clientY: number; position: CoverPosition; width: number; height: number } | null>(null);
  const settings = profileCoverSettings(focalPoint);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, position: settings, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const cover = dragCoverPosition(start.position, { x: event.clientX - start.clientX, y: event.clientY - start.clientY }, start, imageSize.current);
    onChange({ ...focalPoint, cover });
  }

  function finishDrag() { drag.current = null; setDragging(false); }

  function position(axis: "x" | "y", value: number) {
    onChange({ ...focalPoint, cover: { x: settings.x, y: settings.y, [axis]: value } });
  }

  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto text-xs text-text-muted">Cover-Vorschau</span>
      <button type="button" aria-pressed={preview === "desktop"} onClick={() => setPreview("desktop")} className={`min-h-11 rounded-lg border border-border px-3 text-xs ${preview === "desktop" ? "text-gold" : "text-text-muted"}`}>Desktop</button>
      <button type="button" aria-pressed={preview === "phone"} onClick={() => setPreview("phone")} className={`min-h-11 rounded-lg border border-border px-3 text-xs ${preview === "phone" ? "text-gold" : "text-text-muted"}`}>Smartphone</button>
      <button type="button" aria-label="Coverbild entfernen" onClick={onRemove} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-text-muted hover:text-crimson-light"><X size={16} /></button>
    </div>
    <div className={preview === "phone" ? "mx-auto w-full max-w-sm" : "w-full"}>
      <div role="group" aria-label="Coverbild mit Maus oder Finger verschieben" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
        className={`relative touch-none select-none overflow-hidden rounded-xl border border-border bg-bg-primary ${preview === "phone" ? "aspect-[16/9]" : "aspect-[5/1]"} ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Stored or local upload preview. */}
        <img src={src} alt="Vorschau des Coverbildausschnitts" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={profileCoverStyle(focalPoint)} onLoad={event => { imageSize.current = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }; }} />
      </div>
    </div>
    <p className="flex items-start gap-2 text-xs text-text-muted"><Move size={15} className="shrink-0" />Bild mit Maus oder Finger verschieben. Der sichtbare Ausschnitt passt sich an Bildschirmbreite und Profilinhalt an.</p>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {(["x", "y"] as const).map(axis => <label key={axis} className="flex min-h-11 items-center gap-3 text-xs text-text-muted">{axis === "x" ? "Horizontal" : "Vertikal"}<input aria-label={`Coverposition ${axis === "x" ? "horizontal" : "vertikal"}`} type="range" min="0" max="100" step="1" value={settings[axis]} onChange={event => position(axis, Number(event.target.value))} className="min-h-11 min-w-0 flex-1 accent-gold" /></label>)}
    </div>
    <label className="flex min-h-11 items-center gap-3 text-xs text-text-muted">Helligkeit<input aria-label="Coverhelligkeit" type="range" min="0.1" max="1" step="0.05" value={settings.brightness} onChange={event => onChange({ ...focalPoint, opacity: Number(event.target.value) })} className="min-h-11 min-w-0 flex-1 accent-gold" /><span className="w-10 text-right">{Math.round(settings.brightness * 100)}%</span></label>
    <p className="text-xs text-text-muted">100 % zeigt die ursprüngliche Bildhelligkeit. Mit „Profil speichern“ werden Position und Helligkeit dauerhaft übernommen.</p>
    <button type="button" onClick={() => onChange({ ...focalPoint, cover: { x: 50, y: 50 } })} className="inline-flex min-h-11 items-center gap-2 text-xs text-gold"><RotateCcw size={14} />Ausschnitt zentrieren</button>
  </div>;
}
