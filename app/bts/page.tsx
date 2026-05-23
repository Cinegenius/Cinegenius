import type { Metadata } from "next";
import { db } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Aperture, ArrowRight, Heart } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import BTSMosaicGrid, { type BTSGridItem } from "./BTSMosaicGrid";

export const metadata: Metadata = {
  title: "Behind the Scenes — Backstage & Set-Fotos | CineGenius",
  description: "Echte Behind-the-Scenes-Fotos von Filmsets, Shootings und Produktionen. Entdecke Crews, Locations und Projekte hinter der Kamera.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

const BTS_TYPES = new Set(["bts", "set_photo", "portfolio"]);
const CREW_TYPES = new Set(["camera", "lighting", "sound", "director_of_photography", "director",
  "production", "makeup", "costume", "filmmaker", "photographer", "editor"]);

export default async function BTSPage() {
  const { userId } = await auth();

  // Fetch all likes — used for top-liked section AND mosaic heart counts
  const { data: likeRows } = await db
    .from("profile_image_likes")
    .select("image_url, profile_id, liker_id");

  const likeCounts: Record<string, number> = {};
  const likeProfileId: Record<string, string> = {};
  const myLikes: string[] = [];

  for (const row of likeRows ?? []) {
    likeCounts[row.image_url] = (likeCounts[row.image_url] ?? 0) + 1;
    likeProfileId[row.image_url] = row.profile_id;
    if (userId && row.liker_id === userId) myLikes.push(row.image_url);
  }

  // Top 3 most-liked images
  const topEntries = Object.entries(likeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  let topRated: { imageUrl: string; count: number; profileSlug: string; authorName: string }[] = [];

  if (topEntries.length > 0) {
    const topProfileIds = [...new Set(topEntries.map(([url]) => likeProfileId[url]).filter(Boolean))];
    const { data: topProfiles } = await db
      .from("profiles")
      .select("user_id, display_name, slug")
      .in("user_id", topProfileIds);
    const topProfileMap = Object.fromEntries((topProfiles ?? []).map((p) => [p.user_id, p]));

    topRated = topEntries.map(([imageUrl, count]) => ({
      imageUrl,
      count,
      profileSlug: topProfileMap[likeProfileId[imageUrl]]?.slug ?? likeProfileId[imageUrl] ?? "",
      authorName: topProfileMap[likeProfileId[imageUrl]]?.display_name ?? "Unbekannt",
    }));
  }

  // Fetch profiles + build btsItems
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, slug, display_name, tagline, location, avatar_url, profile_images, profile_type, profile_types")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("updated_at", { ascending: false })
    .limit(300);

  const btsItems: BTSGridItem[] = [];

  for (const p of (profiles ?? []) as RawProfile[]) {
    const images = Array.isArray(p.profile_images)
      ? (p.profile_images as Array<{ url?: string; media_type?: string; caption?: string }>)
      : [];

    const btsImgs = images.filter(
      (img) => img.url?.includes("supabase.co/storage") && BTS_TYPES.has(img.media_type ?? "")
    );

    const isCrew = [p.profile_type, ...(Array.isArray(p.profile_types) ? p.profile_types : [])]
      .some((t: string) => CREW_TYPES.has(t));

    const fallbackImgs = isCrew
      ? images.filter((img) => img.url?.includes("supabase.co/storage") && img.media_type !== "headshot")
      : [];

    const toAdd = btsImgs.length > 0 ? btsImgs : fallbackImgs;

    toAdd.slice(0, 3).forEach((img) => {
      btsItems.push({
        imageUrl: img.url!,
        caption: img.caption,
        authorName: p.display_name,
        authorCity: typeof p.location === "string" ? p.location.split(",")[0]?.trim() : undefined,
        profileId: p.user_id,
        profileSlug: p.slug ?? p.user_id,
      });
    });
  }

  return (
    <div className="relative min-h-screen">
      <Image
        src="https://images.unsplash.com/photo-1490971774356-7fac993cc438?q=80&w=1740&auto=format&fit=crop"
        alt=""
        fill
        priority
        unoptimized
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-black/72" />
      <div className="relative z-10">

      {/* Hero */}
      <section className="pt-28 pb-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-6">
          <Aperture size={11} /> Behind the Scenes
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-3">
              Behind the Scenes
            </h1>
            <p className="text-text-muted max-w-xl leading-relaxed">
              Echte Set-Fotos, Backstage-Momente und Einblicke hinter die Kamera — von Crews, Fotografen und Filmemachern.
            </p>
          </div>
          <Link
            href="/creators"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >
            Crews entdecken <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Top 3 most-liked */}
      {topRated.length > 0 && (
        <section className="pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Heart size={14} className="text-red-400 fill-red-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">Meistgeliked</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topRated.map((item, i) => (
              <Link key={item.imageUrl} href={`/profile/${item.profileSlug}`}
                className="group relative rounded-2xl overflow-hidden aspect-video bg-bg-elevated border border-red-400/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.authorName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500/80 rounded-full text-white text-[11px] font-bold backdrop-blur-sm">
                  #{i + 1} <Heart size={10} className="fill-current" /> {item.count}
                </div>
                <div className="absolute bottom-3 left-3">
                  <p className="text-white font-semibold text-sm">{item.authorName}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Mosaic Grid with inline rating */}
      {btsItems.length > 0 ? (
        <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BTSMosaicGrid
            items={btsItems}
            initialLikes={likeCounts}
            initialMyLikes={myLikes}
          />
        </section>
      ) : (
        <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-5">
            <Aperture size={24} className="text-gold" />
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">Noch keine BTS-Fotos</h2>
          <p className="text-text-muted mb-6 max-w-md mx-auto">
            Lade deine Behind-the-Scenes-Bilder in dein Profil hoch — sie erscheinen automatisch hier.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >
            Profil erstellen <ArrowRight size={14} />
          </Link>
        </section>
      )}
      </div>
    </div>
  );
}
