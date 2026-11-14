import { db } from "@/lib/db";
import Image from "@/components/MediaImage";
import Link from "next/link";
import { Aperture, ArrowRight, Heart } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import BTSMosaicGrid, { type BTSGridItem } from "./BTSMosaicGrid";
import PhotoNavigationLink from "./PhotoNavigationLink";
import { getPrivateProfileIds } from "@/lib/trust";
import { communityPreviewUrl } from "@/lib/community-preview";
import { isOwnPublicStorageUrl } from "@/lib/community-media";
import { collectFacetRows } from "@/lib/browse-facets";
import { photoHref } from "@/lib/photo-link";
import { getTranslations } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/bts" },
  title: tMetadata('m_0b2f9cc928bd'),
  description: tMetadata('m_7d38bb918306'),
};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

const BTS_TYPES = new Set(["bts", "set_photo", "portfolio"]);
const CREW_TYPES = new Set(["camera", "lighting", "sound", "director_of_photography", "director",
  "production", "makeup", "costume", "filmmaker", "photographer", "editor"]);

export default async function BTSPage() {
  const uiText = await getTranslations();

  const { userId } = await auth();

  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, slug, display_name, tagline, location, avatar_url, profile_images, profile_type, profile_types")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("updated_at", { ascending: false })
    .limit(300);
  const profileRows = (profiles ?? []) as RawProfile[];
  const privateIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const publicProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));
  const publicProfileIds = publicProfiles.map((profile) => profile.user_id);

  // Discovery eligibility includes protected uploads and excludes foreign/private
  // canonical parents even when a public profile still mirrors their URL.
  const [eligibleRows, { data: likeRows }] = await Promise.all([
    collectFacetRows<{ owner_id: string; image_url: string }>((from, to) => db.from("public_community_media")
      .select("owner_id,image_url").eq("source_type", "profile").order("storage_id").range(from, to), 500),
    // Fetch likes only for public profiles, keyed by both owner and image URL.
    publicProfileIds.length
    ? db.from("profile_image_likes").select("image_url, profile_id, liker_id").in("profile_id", publicProfileIds)
    : { data: [] as Array<{ image_url: string; profile_id: string; liker_id: string }> },
  ]);
  const eligible = new Set(eligibleRows.map(row => `${row.owner_id}:${row.image_url}`));

  const likeCounts: Record<string, number> = {};
  const myLikes: string[] = [];

  for (const row of likeRows ?? []) {
    const key = `${row.profile_id}:${row.image_url}`;
    if (!eligible.has(key)) continue;
    likeCounts[key] = (likeCounts[key] ?? 0) + 1;
    if (userId && row.liker_id === userId) myLikes.push(key);
  }

  // Top 3 most-liked publicly visible photos (likes, not star ratings).
  const topEntries = Object.entries(likeCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);

  let topRated: { imageUrl: string; profileId: string; count: number; profileSlug: string; authorName: string }[] = [];

  if (topEntries.length > 0) {
    const visibleProfiles = new Map(publicProfiles.map((p) => [p.user_id, p]));
    topRated = topEntries.map(([key, count]) => {
      const colon = key.indexOf(":");
      const profileId = key.slice(0, colon);
      const imageUrl = key.slice(colon + 1);
      const owner = visibleProfiles.get(profileId);
      return { imageUrl, profileId, count, profileSlug: owner?.slug ?? profileId, authorName: owner?.display_name ?? "Unbekannt" };
    }).filter((item) => item.authorName !== "Unbekannt");
  }

  const btsItems: BTSGridItem[] = [];

  for (const p of publicProfiles) {
    const images = Array.isArray(p.profile_images)
      ? (p.profile_images as Array<{ url?: string; media_type?: string; caption?: string }>)
      : [];

    const btsImgs = images.filter(
      (img) => Boolean(img.url && isOwnPublicStorageUrl(img.url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") && eligible.has(`${p.user_id}:${img.url}`)) && BTS_TYPES.has(img.media_type ?? "")
    );

    const isCrew = [p.profile_type, ...(Array.isArray(p.profile_types) ? p.profile_types : [])]
      .some((t: string) => CREW_TYPES.has(t));

    const fallbackImgs = isCrew
      ? images.filter((img) => Boolean(img.url && isOwnPublicStorageUrl(img.url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") && eligible.has(`${p.user_id}:${img.url}`)) && img.media_type !== "headshot")
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
        sizes="100vw"
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-black/72" />
      <div className="relative z-10">

      {/* Hero */}
      <section className="pt-28 pb-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-6">{uiText.rich("Ui.text_641be6965c93ce", { part1: () => (<Aperture size={11} />) })}</div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-3">{uiText("home.showcaseBts")}</h1>
            <p className="text-text-muted max-w-xl leading-relaxed">{uiText("Ui.text_9de86819febf23")}</p>
          </div>
          <Link
            href="/creators"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >{uiText.rich("Ui.text_b9dfc00a520d2e", { part1: () => (<ArrowRight size={14} />) })}</Link>
        </div>
      </section>

      {/* Top 3 most-liked */}
      {topRated.length > 0 && (
        <section className="pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Heart size={14} className="text-red-400 fill-red-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">{uiText("Ui.text_6d8dc4b2b5cb02")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topRated.map((item, i) => (
              <PhotoNavigationLink key={`${item.profileId}:${item.imageUrl}`} href={photoHref(item.profileId, item.imageUrl)}
                className="group relative rounded-2xl overflow-hidden aspect-video bg-bg-elevated border border-red-400/20">
                <Image src={communityPreviewUrl(item.imageUrl)} alt={item.authorName} fill unoptimized sizes="(min-width: 640px) 33vw, 100vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500/80 rounded-full text-white text-[11px] font-bold backdrop-blur-sm">
                  #{i + 1} <Heart size={10} className="fill-current" /> {item.count}
                </div>
                <div className="absolute bottom-3 left-3">
                  <p className="text-white font-semibold text-sm">{item.authorName}</p>
                </div>
              </PhotoNavigationLink>
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
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">{uiText("Ui.text_82ecdd3ad5bd97")}</h2>
          <p className="text-text-muted mb-6 max-w-md mx-auto">{uiText("Ui.text_30626b152dfc17")}</p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >{uiText.rich("Ui.text_5d63896787f560", { part1: () => (<ArrowRight size={14} />) })}</Link>
        </section>
      )}
      </div>
    </div>
  );
}
