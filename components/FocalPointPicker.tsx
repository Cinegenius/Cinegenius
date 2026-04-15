"use client";

import { useRef, useState, useCallback } from "react";
import { Check, X, Move } from "lucide-react";

export interface FocalPoint { x: number; y: number }

interface Props {
  imageUrl: string;
  initial?: FocalPoint;
  onSave: (point: FocalPoint) => void;
  onClose: () => void;
}

export default function FocalPointPicker({ imageUrl, initial, onSave, onClose }: Props) {
  const [point, setPoint] = useState<FocalPoint>(initial ?? { x: 50, y: 33 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClient = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)));
    setPoint({ x, y });
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-4 bg-black/80 backdrop-blur-sm shrink-0">
        <div>
          <p className="font-semibold text-white text-sm">Fokuspunkt setzen</p>
          <p className="text-xs text-white/50 mt-0.5">
            Tippe auf dein Gesicht — dieser Bereich bleibt immer sichtbar
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 relative select-none overflow-hidden cursor-crosshair"
        onMouseDown={(e) => { dragging.current = true; updateFromClient(e.clientX, e.clientY); }}
        onMouseMove={(e) => { if (dragging.current) updateFromClient(e.clientX, e.clientY); }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        onTouchStart={(e) => { dragging.current = true; updateFromClient(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={(e) => { e.preventDefault(); updateFromClient(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={() => { dragging.current = false; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-black/30" />

        {/* Focal indicator */}
        <div
          className="absolute pointer-events-none"
          style={{ left: `${point.x}%`, top: `${point.y}%`, transform: "translate(-50%, -50%)" }}
        >
          {/* Outer ring with glow */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* Animated pulse */}
            <div className="absolute inset-0 rounded-full border-2 border-gold/40 animate-ping" />
            {/* Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-gold/80" />
            {/* Inner dot */}
            <div className="w-4 h-4 rounded-full bg-gold shadow-[0_0_12px_4px_rgba(212,175,55,0.6)]" />
          </div>
          {/* Crosshair */}
          <div className="absolute top-1/2 -left-6 -right-6 h-px bg-white/30 -translate-y-1/2 pointer-events-none" />
          <div className="absolute left-1/2 -top-6 -bottom-6 w-px bg-white/30 -translate-x-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Preview strip — shows how the card crop will look */}
      <div className="bg-black/80 backdrop-blur-sm px-4 pt-3 pb-2 shrink-0">
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Vorschau Karte</p>
        <div className="flex gap-2 mb-3">
          {/* Card preview */}
          <div className="w-16 rounded-lg overflow-hidden" style={{ aspectRatio: "4/5" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `${point.x}% ${point.y}%` }}
            />
          </div>
          {/* Square preview */}
          <div className="w-16 rounded-lg overflow-hidden aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `${point.x}% ${point.y}%` }}
            />
          </div>
          <div className="flex-1 flex flex-col justify-center pl-2">
            <p className="text-xs text-white/70 leading-relaxed">
              So sieht dein Foto auf der Karte und im Avatar aus.
            </p>
          </div>
        </div>

        <button
          onClick={() => onSave(point)}
          className="w-full py-3.5 rounded-2xl bg-gold text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Check size={16} />
          Fokuspunkt speichern
        </button>
        <p className="text-center text-[10px] text-white/30 mt-2 pb-safe-bottom">
          Du kannst den Fokuspunkt jederzeit ändern
        </p>
      </div>
    </div>
  );
}
