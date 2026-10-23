"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { ImageOff } from "lucide-react";

type ResilientPublicImageProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
};

/** Keep broken public media understandable without hiding or replacing the stored image URL. */
export default function ResilientPublicImage({
  src,
  alt,
  className = "",
  imageClassName = "h-full w-full object-cover",
  loading = "lazy",
  style,
}: ResilientPublicImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <div className={`h-full w-full min-w-0 overflow-hidden ${className}`} style={style}>
      {failedSrc === src ? (
        <div
          role="img"
          aria-label={alt ? `${alt}: Foto derzeit nicht erreichbar` : "Foto derzeit nicht erreichbar"}
          className="flex h-full min-h-16 w-full flex-col items-center justify-center gap-2 bg-bg-elevated px-3 text-center text-xs text-text-muted"
        >
          <ImageOff size={20} aria-hidden="true" />
          <span>Foto derzeit nicht erreichbar</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={loading} className={imageClassName} onError={() => setFailedSrc(src)} />
      )}
    </div>
  );
}
