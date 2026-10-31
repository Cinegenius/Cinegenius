"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ImageOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { DiscoverPhoto, PhotoDialog } from "@/components/HomePhotoDiscovery";
import { photoHref } from "@/lib/photo-link";
import PhotoLikeButton from "@/components/PhotoLikeButton";
import { communityPreviewUrl } from "@/lib/community-preview";
import { galleryPreviewAspectRatio } from "@/lib/photo-gallery-layout";

type GalleryItem = DiscoverPhoto;

export function PhotoGallery({
  items,
  selectedPhoto,
  resumeLike,
}: {
  items: GalleryItem[];
  selectedPhoto: DiscoverPhoto | null;
  resumeLike: boolean;
}) {
  const router = useRouter();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const closePhoto = useCallback(() => {
    let cameFromInside = false;
    try {
      cameFromInside = sessionStorage.getItem("cinegenius-photo-return") === "1";
      sessionStorage.removeItem("cinegenius-photo-return");
    } catch { /* Fall back to the gallery route if browser storage is blocked. */ }
    if (cameFromInside && window.history.length > 1) router.back();
    else router.replace("/photo");
  }, [router]);

  return (
    <>
      {selectedPhoto && <PhotoDialog key={`${selectedPhoto.profileId}:${selectedPhoto.imageUrl}`} photo={selectedPhoto} onClose={closePhoto} resumeLike={resumeLike} />}
      {items.length > 0 ? (
        <section aria-label="Öffentliche Community-Einblicke" className="site-container pb-24">
          <div role="list" className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4">
            {items.map((item) => (
              <article role="listitem" key={`${item.profileId}-${item.imageUrl}`} className="group relative mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-xl border border-border bg-bg-elevated sm:mb-4">
                <Link
                  href={photoHref(item.profileId, item.imageUrl)}
                  onClick={() => { try { sessionStorage.setItem("cinegenius-photo-return", "1"); } catch {} }}
                  aria-label={`Foto von ${item.author} öffnen${item.caption ? `: ${item.caption}` : ""}`}
                  style={{ aspectRatio: galleryPreviewAspectRatio(item) }}
                  className="relative block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- bounded derivative, never the original-resolution fallback */}
                  {failedImages.has(item.imageUrl) ? <div role="img" aria-label="Foto derzeit nicht erreichbar" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-text-muted"><ImageOff size={24} /><span>Foto derzeit nicht erreichbar</span></div> : <img src={communityPreviewUrl(item.imageUrl)} alt={item.caption || `Foto von ${item.author}`} width={640} height={480} loading="lazy" decoding="async" onError={() => setFailedImages(current => new Set(current).add(item.imageUrl))} className={item.fit === "contain" ? "absolute inset-0 h-full w-full object-contain p-4" : "absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"} />}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                    <p className="mt-1 line-clamp-2 break-words text-[11px] text-white/80 sm:text-xs">{[item.imageKind, item.sourceTitle !== item.author ? item.sourceTitle : item.caption].filter(Boolean).join(" · ") || "Portfoliofoto"}</p>
                  </div>
                </Link>
                {item.authorHref === null ? <p className="min-h-11 break-words px-3 py-2 text-xs font-semibold text-text-primary sm:px-4 sm:text-sm">{item.author}</p> : <Link href={item.authorHref ?? `/profile/${item.profileSlug}`} className="relative z-10 block min-h-11 break-words px-3 py-2 text-xs font-semibold text-text-primary hover:text-gold sm:px-4 sm:text-sm">{item.author}</Link>}
                <PhotoLikeButton disabled={item.canLike === false} profileId={item.profileId} imageUrl={item.imageUrl} initialCount={item.likeCount ?? 0} initialLiked={item.likedByMe ?? false} className="absolute right-2 top-2 z-10" />
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="site-container pb-24 text-center">
          <p className="rounded-xl border border-border bg-bg-secondary/70 px-4 py-8 text-sm text-text-muted">Noch keine öffentlichen Einblicke zum Entdecken vorhanden.</p>
        </section>
      )}
    </>
  );
}
