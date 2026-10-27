"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

interface LightboxProps {
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  alt?: string;
}

export default function Lightbox({
  images,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  alt = "",
}: LightboxProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, images.length - 1));
  const currentImage = images[safeIndex];
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) onPrev();
      if (e.key === "ArrowRight" && images.length > 1) onNext();
    },
    [images.length, onClose, onPrev, onNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleTouchStart = (event: ReactTouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: ReactTouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined || Math.abs(endX - startX) < 48 || images.length < 2) return;
    didSwipe.current = true;
    if (endX < startX) onNext();
    else onPrev();
    window.setTimeout(() => { didSwipe.current = false; }, 450);
  };

  const selectImage = (index: number) => {
    const forward = (index - safeIndex + images.length) % images.length;
    const backward = (safeIndex - index + images.length) % images.length;
    if (forward <= backward) {
      for (let step = 0; step < forward; step += 1) onNext();
    } else {
      for (let step = 0; step < backward; step += 1) onPrev();
    }
  };

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Fotogalerie"
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(event) => {
        if (didSwipe.current) {
          event.preventDefault();
          event.stopPropagation();
          didSwipe.current = false;
          return;
        }
        onClose();
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Fotogalerie schließen"
        className="absolute top-4 right-4 w-10 h-10 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold transition-all z-10"
      >
        <X size={18} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-bg-elevated border border-border rounded-full text-xs text-text-muted">
        {safeIndex + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Vorheriges Foto"
          className="absolute left-4 w-12 h-12 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold transition-all"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <div
        className="flex max-h-[72vh] max-w-5xl items-center justify-center px-14 sm:px-20"
        onClick={(e) => e.stopPropagation()}
      >
        {failedImages.has(currentImage) ? (
          <div role="img" aria-label={alt ? `${alt}: Foto derzeit nicht erreichbar` : "Foto derzeit nicht erreichbar"} className="flex h-64 max-h-[85vh] w-[min(80vw,48rem)] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-bg-elevated px-6 text-center text-sm text-text-secondary">
            <ImageOff size={28} className="text-text-muted" aria-hidden="true" />
            <span>Dieses Foto ist derzeit nicht erreichbar.</span>
          </div>
        ) : (
          <Image
            key={currentImage}
            src={currentImage}
            alt={alt ?? ""}
            width={1600}
            height={1200}
            onError={() => setFailedImages((current) => new Set(current).add(currentImage))}
            className="block max-h-[72vh] max-w-full w-auto rounded-lg object-contain shadow-2xl"
            sizes="90vw"
            priority
          />
        )}
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Nächstes Foto"
          className="absolute right-4 w-12 h-12 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold transition-all"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="absolute bottom-6 left-4 right-4 flex justify-center gap-2 overflow-x-auto px-1 pb-1 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Foto ${i + 1} anzeigen`}
              aria-pressed={i === safeIndex}
              onClick={() => selectImage(i)}
              className={`relative h-8 w-12 shrink-0 rounded overflow-hidden border-2 transition-all ${
                i === safeIndex ? "border-gold" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <Image src={img} alt="" fill className="object-cover" sizes="48px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
