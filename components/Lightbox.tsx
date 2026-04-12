"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

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
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [onClose, onPrev, onNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 animate-fade-in"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold transition-all z-10"
      >
        <X size={18} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-bg-elevated border border-border rounded-full text-xs text-text-muted">
        {activeIndex + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 w-12 h-12 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold transition-all"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-5xl max-h-[85vh] px-20"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={images[activeIndex]}
          alt={alt ?? ""}
          width={1200}
          height={800}
          className="max-w-full max-h-[85vh] w-auto object-contain rounded-lg shadow-2xl"
          sizes="90vw"
          priority
        />
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 w-12 h-12 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-gold hover:border-gold transition-all"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => {
                // Jump to index — passed via onPrev/onNext logic externally
              }}
              className={`w-12 h-8 rounded overflow-hidden border-2 transition-all ${
                i === activeIndex ? "border-gold" : "border-transparent opacity-50 hover:opacity-80"
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
