"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DiscoverPhoto, PhotoDialog } from "@/components/HomePhotoDiscovery";
import { photoHref } from "@/lib/photo-link";
import PhotoLikeButton from "@/components/PhotoLikeButton";

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
      {selectedPhoto && <PhotoDialog photo={selectedPhoto} onClose={closePhoto} resumeLike={resumeLike} />}
      {items.length > 0 ? (
        <section aria-label="Öffentliche Portfoliofotos" className="site-container pb-24">
          <div role="list" className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4">
            {items.map((item) => (
              <article role="listitem" key={`${item.profileId}-${item.imageUrl}`} className="group relative mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-xl border border-border bg-bg-elevated sm:mb-4">
                <Link
                  href={photoHref(item.profileId, item.imageUrl)}
                  onClick={() => { try { sessionStorage.setItem("cinegenius-photo-return", "1"); } catch {} }}
                  aria-label={`Foto von ${item.author} öffnen${item.caption ? `: ${item.caption}` : ""}`}
                  className="relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                >
                  <Image src={item.imageUrl} alt={item.caption || `Foto von ${item.author}`} width={1200} height={900} sizes="(max-width:767px) 50vw,(max-width:1279px) 33vw,25vw" className="block h-auto w-full transition-transform duration-500 group-hover:scale-105" />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                    <p className="line-clamp-2 break-words text-xs font-semibold sm:text-sm">{item.author}</p>
                    <p className="mt-1 line-clamp-2 break-words text-[11px] text-white/80 sm:text-xs">{item.caption || "Portfoliofoto"}</p>
                  </div>
                </Link>
                <PhotoLikeButton profileId={item.profileId} imageUrl={item.imageUrl} initialCount={item.likeCount ?? 0} initialLiked={item.likedByMe ?? false} className="absolute right-2 top-2 z-10" />
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="site-container pb-24 text-center">
          <p className="rounded-xl border border-border bg-bg-secondary/70 px-4 py-8 text-sm text-text-muted">Noch keine öffentlichen Portfoliofotos zum Entdecken vorhanden.</p>
        </section>
      )}
    </>
  );
}
