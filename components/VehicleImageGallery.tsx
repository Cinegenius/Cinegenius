"use client";

import { useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import Lightbox from "@/components/Lightbox";

export default function VehicleImageGallery({
  title,
  image,
  extraImages = [],
  focalPoint,
}: {
  title: string;
  image: string;
  extraImages?: string[];
  focalPoint?: { x: number; y: number } | null;
}) {
  const images = [image, ...extraImages].filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  const onTouchStart = (event: ReactTouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: ReactTouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined || Math.abs(endX - startX) < 48 || images.length < 2) return;
    didSwipe.current = true;
    setActiveIndex((index) => endX < startX ? (index + 1) % images.length : (index - 1 + images.length) % images.length);
    window.setTimeout(() => { didSwipe.current = false; }, 450);
  };

  return (
    <>
      <div className="space-y-2">
        <div
          className="relative aspect-video overflow-hidden rounded-2xl bg-bg-elevated"
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClickCapture={(event) => {
            if (!didSwipe.current) return;
            event.preventDefault();
            event.stopPropagation();
            didSwipe.current = false;
          }}
        >
          {images[activeIndex] ? (
            <button type="button" aria-label="Foto vergrößern" onClick={() => setLightboxOpen(true)} className="absolute inset-0 block h-full w-full cursor-zoom-in">
              <Image
                src={images[activeIndex]}
                alt={title}
                fill
                priority={activeIndex === 0}
                className="object-contain"
                style={{ objectPosition: activeIndex === 0 && focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : "50% 50%" }}
                sizes="(min-width: 1024px) 66vw, 100vw"
              />
            </button>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl text-text-muted/30">🚗</div>
          )}
          {images.length > 0 && (
            <button type="button" onClick={() => setLightboxOpen(true)} className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-bg-primary/85 px-3 text-xs text-text-secondary backdrop-blur-sm hover:border-gold hover:text-gold">
              <Expand size={13} /> {images.length > 1 ? `Alle ${images.length} Fotos` : "Foto vergrößern"}
            </button>
          )}
          {images.length > 1 && <span className="absolute bottom-3 left-3 rounded-lg bg-bg-primary/85 px-2.5 py-1 text-xs text-text-secondary">{activeIndex + 1} / {images.length}</span>}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Fahrzeugfotos">
            {images.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                aria-label={`Foto ${index + 1} vergrößern`}
                aria-pressed={activeIndex === index}
                onClick={() => { setActiveIndex(index); setLightboxOpen(true); }}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-bg-secondary ${activeIndex === index ? "border-gold" : "border-border"}`}
              >
                <Image src={url} alt="" fill className="object-contain" sizes="80px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && images.length > 0 && (
        <Lightbox
          images={images}
          activeIndex={activeIndex}
          alt={title}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}
          onNext={() => setActiveIndex((index) => (index + 1) % images.length)}
        />
      )}
    </>
  );
}
