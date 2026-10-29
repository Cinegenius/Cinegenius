"use client";

import { useState } from "react";
import MediaImage from "@/components/MediaImage";
import { profilePhotoStyle } from "@/lib/profile-photo";

function publicStorageSource(src: string) {
  try { const url = new URL(src); return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/"); }
  catch { return false; }
}

/** Portraits only. The reserved square/circle is supplied by the crew card/list. */
export default function ProfileCardPhoto({ src, name, focalPoint, className, sizes }: {
  src: string; name: string; focalPoint?: unknown; className: string; sizes: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div data-crew-photo className={`relative shrink-0 overflow-hidden bg-bg-primary ${className}`}>
    {src && failed !== src ? <MediaImage src={src} alt={name} fill mediaSize="thumbnail" sizes={sizes} quality={75} loading="lazy"
      unoptimized={!publicStorageSource(src)} className="object-cover" style={profilePhotoStyle(focalPoint)} onError={() => setFailed(src)} />
      : <div role="img" aria-label={name} className="flex h-full w-full items-center justify-center text-xl font-bold text-text-muted/40">{name.trim().charAt(0).toLocaleUpperCase()}</div>}
  </div>;
}
