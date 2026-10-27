"use client";

import { useRef, useState } from "react";
import type { ReactNode, TouchEvent as ReactTouchEvent } from "react";
import Image from "@/components/MediaImage";
import dynamic from "next/dynamic";
import { Expand, ImageOff } from "lucide-react";
import { getListingGalleryPreview } from "@/lib/listing-image-gallery";

const Lightbox = dynamic(() => import("@/components/Lightbox"), { ssr: false });

type ListingPhotoGalleryProps = {
  images: string[];
  title: string;
  alt?: string;
  label?: string;
  fallback?: ReactNode;
  priority?: boolean;
  focalPoint?: { x: number; y: number } | null;
};

export default function ListingPhotoGallery({
  images: rawImages,
  title,
  alt,
  label = "Artikelfotos",
  fallback,
  priority = true,
  focalPoint,
}: ListingPhotoGalleryProps) {
  const images = [...new Set(rawImages.filter((url) => typeof url === "string").map((url) => url.trim()).filter(Boolean))];
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const activeIndex = Math.max(0, images.indexOf(activeImage ?? images[0]));
  const setActiveIndex = (next: number | ((index: number) => number)) =>
    setActiveImage(current => images[typeof next === "function"
      ? next(Math.max(0, images.indexOf(current ?? images[0]))) : next] ?? null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const preview = getListingGalleryPreview(images, activeIndex);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, images.length - 1));
  const additionalLabel = preview.additionalCount > 0
    ? `+ ${preview.additionalCount} weitere Fotos`
    : `Alle ${images.length} Fotos anzeigen`;

  const selectImage = (index: number, open = false) => {
    setActiveIndex(index);
    if (open) setLightboxOpen(true);
  };

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

  const handleImageError = (url: string) => {
    setFailedImages((current) => new Set(current).add(url));
  };

  const renderUnavailable = (className: string) => (
    <div role="img" aria-label="Foto derzeit nicht erreichbar" className={`flex items-center justify-center gap-2 bg-bg-elevated px-4 text-center text-xs text-text-muted ${className}`}>
      {fallback ?? <ImageOff size={22} aria-hidden="true" />}
      <span>Foto derzeit nicht erreichbar</span>
    </div>
  );

  const thumbnailGridClass = preview.thumbnails.length === 1
    ? "grid-cols-1 grid-rows-1"
    : "grid-cols-2 grid-rows-2";

  return (
    <>
      <section aria-label={label} className="mb-8">
        <div
          className="relative grid min-w-0 grid-cols-1 gap-2 overflow-hidden rounded-xl sm:h-72 sm:grid-cols-5 sm:grid-rows-2 lg:h-96"
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
          <div className={`relative col-span-1 row-span-1 aspect-[4/3] min-h-0 overflow-hidden bg-bg-secondary sm:row-span-2 sm:aspect-auto ${images.length > 1 ? "sm:col-span-3" : "sm:col-span-5"}`}>
            {preview.activeImage ? (
              failedImages.has(preview.activeImage)
                ? renderUnavailable("absolute inset-0")
                : <button
                    type="button"
                    aria-label={`Foto ${safeActiveIndex + 1} vergrößern`}
                    className="absolute inset-0 block h-full w-full cursor-zoom-in"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <Image
                      src={preview.activeImage}
                      alt={alt ?? title}
                      fill
                      priority={priority && safeActiveIndex === 0}
                      onError={() => handleImageError(preview.activeImage!)}
                      className="object-contain"
                      style={{ objectPosition: safeActiveIndex === 0 && focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : "50% 50%" }}
                      sizes="(min-width: 1280px) 60vw, (min-width: 640px) 58vw, 100vw"
                    />
                  </button>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated text-text-muted/30">
                {fallback ?? <ImageOff size={48} aria-hidden="true" />}
              </div>
            )}
            {images.length > 0 && (
              <>
                <span className="absolute bottom-3 left-3 rounded-lg border border-border bg-bg-primary/85 px-2.5 py-1 text-xs text-text-secondary backdrop-blur-sm">
                  {safeActiveIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-bg-primary/85 px-3 text-xs text-text-secondary backdrop-blur-sm transition-colors hover:border-gold hover:text-gold"
                >
                  <Expand size={13} /> {images.length > 1 ? "Alle Fotos anzeigen" : "Foto vergrößern"}
                </button>
              </>
            )}
          </div>

          {preview.thumbnails.length > 0 && (
            <div className={`col-span-2 row-span-2 hidden min-h-0 min-w-0 gap-2 sm:grid ${thumbnailGridClass}`}>
              {preview.thumbnails.map(({ url, index }, thumbnailIndex) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Foto ${index + 1} vergrößern`}
                  className={`group relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-bg-secondary ${preview.thumbnails.length === 3 && thumbnailIndex === 2 ? "col-span-2" : ""}`}
                  onClick={() => selectImage(index, true)}
                >
                  {failedImages.has(url)
                    ? renderUnavailable("absolute inset-0")
                    : <Image
                        src={url}
                        alt=""
                        fill
                        onError={() => handleImageError(url)}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(min-width: 1280px) 22vw, 20vw"
                      />}
                  {preview.additionalCount > 0 && thumbnailIndex === preview.thumbnails.length - 1 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-2 text-center text-sm font-semibold text-white backdrop-blur-[1px]">
                      + {preview.additionalCount} weitere
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {preview.thumbnails.length > 0 && (
          <div className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-1 sm:hidden" aria-label={label}>
            {preview.thumbnails.map(({ url, index }) => (
              <button
                key={url}
                type="button"
                aria-label={`Foto ${index + 1} auswählen`}
                aria-pressed={safeActiveIndex === index}
                onClick={() => selectImage(index)}
                className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-bg-secondary ${safeActiveIndex === index ? "border-gold" : "border-border"}`}
              >
                {failedImages.has(url)
                  ? <ImageOff size={18} className="absolute inset-0 m-auto text-text-muted" aria-hidden="true" />
                  : <Image src={url} alt="" fill onError={() => handleImageError(url)} className="object-cover" sizes="80px" />}
              </button>
            ))}
            {preview.additionalCount > 0 && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex h-16 min-w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated px-3 text-center text-xs font-medium text-text-secondary"
              >
                {additionalLabel}
              </button>
            )}
          </div>
        )}
      </section>

      {lightboxOpen && images.length > 0 && (
        <Lightbox
          images={images}
          activeIndex={safeActiveIndex}
          alt={alt ?? title}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}
          onNext={() => setActiveIndex((index) => (index + 1) % images.length)}
        />
      )}
    </>
  );
}
