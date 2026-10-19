"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DiscoverPhoto, PhotoDialog } from "@/components/HomePhotoDiscovery";
import { photoHref } from "@/lib/photo-link";
import PhotoLikeButton from "@/components/PhotoLikeButton";

type GalleryItem = DiscoverPhoto & { aspectClass?: string };

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
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => (
              <article key={`${item.profileId}-${item.imageUrl}`} className={`group relative overflow-hidden rounded-xl border border-border bg-bg-elevated ${item.aspectClass ?? "aspect-[4/3]"}`}>
                <Link
                  href={photoHref(item.profileId, item.imageUrl)}
                  onClick={() => { try { sessionStorage.setItem("cinegenius-photo-return", "1"); } catch {} }}
                  aria-label={`Foto von ${item.author} öffnen`}
                  className="absolute inset-0 z-0"
                >
                  <Image src={item.imageUrl} alt={item.caption || item.author} fill sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 pr-14 text-white">
                    <p className="truncate text-xs font-semibold">{item.author}</p>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-white/75">{item.caption || "Portfoliofoto"}</p>
                  </div>
                </Link>
                <PhotoLikeButton profileId={item.profileId} imageUrl={item.imageUrl} initialCount={item.likeCount ?? 0} initialLiked={item.likedByMe ?? false} className="absolute right-2 top-2 z-10" />
                <span className="sr-only">Foto {index + 1}</span>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 pb-24 text-center sm:px-6 lg:px-8">
          <p className="rounded-xl border border-border bg-bg-secondary/70 px-4 py-8 text-sm text-text-muted">Noch keine öffentlichen Portfoliofotos zum Entdecken vorhanden.</p>
        </section>
      )}
    </>
  );
}
