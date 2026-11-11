"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DiscoverPhoto, PhotoDialog } from "@/components/HomePhotoDiscovery";
import MediaImage from "@/components/MediaImage";
import { photoHref } from "@/lib/photo-link";
import PhotoLikeButton from "@/components/PhotoLikeButton";
import { communityPreviewUrl } from "@/lib/community-preview";
import { galleryPreviewAspectRatio } from "@/lib/photo-gallery-layout";
import { useTranslations } from "next-intl";


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
  const uiText = useTranslations();

  const router = useRouter();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const visibleItems = items.filter((item) => !failedImages.has(item.imageUrl));
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
      {visibleItems.length > 0 ? (
        <section aria-label={uiText("Ui.text_18ef0b1311b0e3")} className="site-container pb-6">
          <div role="list" className="columns-2 gap-0 md:columns-3 xl:columns-4">
            {visibleItems.map((item) => (
              <article role="listitem" key={`${item.profileId}-${item.imageUrl}`} className="relative block w-full break-inside-avoid overflow-hidden">
                <Link
                  href={photoHref(item.profileId, item.imageUrl)}
                  onClick={() => { try { sessionStorage.setItem("cinegenius-photo-return", "1"); } catch {} }}
                  aria-label={uiText("Ui.text_4398dcac9447f8", { value1: String(item.author), value2: String(item.caption ? uiText("Ui.text_92dd63d2f3b4b1", { value1: String(item.caption) }) : "") })}
                  style={{ aspectRatio: galleryPreviewAspectRatio(item) }}
                  className="relative block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:-outline-offset-2"
                >
                  <MediaImage
                    src={communityPreviewUrl(item.imageUrl)}
                    alt={item.caption || uiText("Ui.text_504589ed9cc129", { value1: String(item.author) })}
                    fill
                    mediaSize="thumbnail"
                    sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 320px"
                    loading="lazy"
                    onError={() => setFailedImages(current => new Set(current).add(item.imageUrl))}
                    className="object-cover"
                  />
                </Link>
                <PhotoLikeButton disabled={item.canLike === false} profileId={item.profileId} imageUrl={item.imageUrl} initialCount={item.likeCount ?? 0} initialLiked={item.likedByMe ?? false} className="absolute right-2 top-2 z-10" />
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="site-container pb-24 text-center">
          <p role="status" className="rounded-xl border border-border bg-bg-secondary/70 px-4 py-8 text-sm text-text-muted">{uiText(items.length > 0 ? "MediaGallery.unavailable" : "Ui.text_f9a7c6cc9eb091")}</p>
        </section>
      )}
    </>
  );
}
