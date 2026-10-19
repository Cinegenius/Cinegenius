import type { Metadata } from "next";
import { db } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Camera, ArrowRight } from "lucide-react";
import { getPrivateProfileIds } from "@/lib/trust";
import { auth } from "@clerk/nextjs/server";
import { PhotoGallery } from "@/components/PhotoGallery";
import type { DiscoverPhoto } from "@/components/HomePhotoDiscovery";

export const metadata: Metadata = {
  title: "Fotos & Portfolio — CineGenius",
  description: "Entdecke öffentliche Portfolio- und Projektfotos aus der CineGenius-Community.",
};

export const revalidate = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

interface GridItem extends DiscoverPhoto {
  photographerCity?: string;
  aspectClass: string;
}

const ASPECT_CYCLE = ["aspect-square", "aspect-[3/4]", "aspect-[4/3]", "aspect-[3/4]", "aspect-square", "aspect-[4/3]"];

export default async function PhotoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const profileParam = typeof params.profile_id === "string" ? params.profile_id : "";
  const imageParam = typeof params.image_url === "string" ? params.image_url : "";
  const resumeLike = params.action === "like";
  const [{ data: profiles }, { userId }] = await Promise.all([
    db.from("profiles")
      .select("user_id, slug, display_name, tagline, location, profile_images, portfolio_images")
      .not("display_name", "is", null)
      .neq("display_name", "")
      .order("updated_at", { ascending: false })
      .limit(200),
    auth(),
  ]);

  const profileRows = (profiles ?? []) as RawProfile[];
  const privateIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const photoProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));
  const candidates: GridItem[] = [];
  for (const profile of photoProfiles) {
    const images = Array.isArray(profile.profile_images) ? profile.profile_images as Array<{ url?: string; media_type?: string; caption?: string }> : [];
    const galleryImages = images.filter((image) => image.url?.includes("supabase.co/storage") && image.media_type !== "headshot");
    const legacyPortfolio = Array.isArray(profile.portfolio_images)
      ? profile.portfolio_images.filter((url: unknown): url is string => typeof url === "string" && url.includes("supabase.co/storage"))
      : [];
    const allImages = [...galleryImages, ...legacyPortfolio.map((url: string) => ({ url, caption: "Portfolio" }))]
      .filter((image, index, all) => all.findIndex((other) => other.url === image.url) === index);
    for (const image of allImages) {
      if (!image.url) continue;
      candidates.push({
        profileId: profile.user_id,
        profileSlug: profile.slug || profile.user_id,
        author: profile.display_name,
        imageUrl: image.url,
        caption: image.caption ?? "",
        rating: 0,
        count: 0,
        likeCount: 0,
        likedByMe: false,
        photographerCity: typeof profile.location === "string" ? profile.location.split(",")[0]?.trim() : undefined,
        aspectClass: ASPECT_CYCLE[candidates.length % ASPECT_CYCLE.length],
      });
    }
  }

  // Resolve a photo permalink only against the public images collected above.
  const selectedPhoto = candidates.find((photo) => photo.profileId === profileParam && photo.imageUrl === imageParam) ?? null;
  const profileIds = [...new Set(candidates.map((photo) => photo.profileId))];
  const { data: likeRows } = profileIds.length
    ? await db.from("profile_image_likes").select("profile_id,image_url,liker_id").in("profile_id", profileIds)
    : { data: [] as Array<{ profile_id: string; image_url: string; liker_id: string }> };
  const counts = new Map<string, number>();
  const myLikes = new Set<string>();
  for (const row of likeRows ?? []) {
    const key = `${row.profile_id}:${row.image_url}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (userId && row.liker_id === userId) myLikes.add(key);
  }
  const gridItems = candidates.map((photo) => {
    const key = `${photo.profileId}:${photo.imageUrl}`;
    return { ...photo, likeCount: counts.get(key) ?? 0, likedByMe: myLikes.has(key) };
  });
  const selectedWithLikes = selectedPhoto
    ? gridItems.find((photo) => photo.profileId === selectedPhoto.profileId && photo.imageUrl === selectedPhoto.imageUrl) ?? null
    : null;

  return (
    <div className="relative min-h-screen">
      <Image src="/photo-bg.jpg" alt="" fill priority unoptimized className="object-cover object-top" />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-28 sm:px-6 sm:pb-14 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-xs font-semibold text-gold"><Camera size={11} /> CineGenius Galerie</div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mb-3 font-display text-4xl font-bold text-text-primary sm:text-5xl">Fotos & Portfolio</h1>
              <p className="max-w-xl leading-relaxed text-text-muted">Entdecke öffentliche Portfolio- und Projektfotos aus der CineGenius-Community.</p>
            </div>
            <Link href="/creators" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary transition-colors hover:bg-gold-light">Crew entdecken <ArrowRight size={14} /></Link>
          </div>
        </section>
        <PhotoGallery items={gridItems} selectedPhoto={selectedWithLikes} resumeLike={resumeLike} />
      </div>
    </div>
  );
}
