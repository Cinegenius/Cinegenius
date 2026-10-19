import type { Metadata } from "next";
import { db } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Camera, ArrowRight, MapPin } from "lucide-react";
import { getPrivateProfileIds } from "@/lib/trust";

export const metadata: Metadata = {
  title: "Fotos & Portfolio — CineGenius",
  description: "Entdecke öffentliche Portfolio- und Projektfotos aus der CineGenius-Community.",
};

export const revalidate = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

interface GridItem {
  imageUrl: string;
  caption?: string;
  photographerName: string;
  photographerCity?: string;
  profileId: string;
  aspectClass: string;
}

const ASPECT_CYCLE = ["aspect-square", "aspect-[3/4]", "aspect-[4/3]", "aspect-[3/4]", "aspect-square", "aspect-[4/3]"];

export default async function PhotoPage() {
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, slug, display_name, tagline, location, profile_images, portfolio_images")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("updated_at", { ascending: false })
    .limit(200);

  const profileRows = (profiles ?? []) as RawProfile[];
  const privateIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const photoProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));

  const gridItems: GridItem[] = [];
  for (const p of photoProfiles) {
    const images = Array.isArray(p.profile_images)
      ? (p.profile_images as Array<{ url?: string; media_type?: string; caption?: string }>)
      : [];
    const galleryImages = images.filter(
      (img) => img.url?.includes("supabase.co/storage") && img.media_type !== "headshot"
    );
    const legacyPortfolio = Array.isArray(p.portfolio_images)
      ? p.portfolio_images.filter((url: unknown): url is string => typeof url === "string" && url.includes("supabase.co/storage"))
      : [];
    const allImages = [...galleryImages, ...legacyPortfolio.map((url: string) => ({ url, caption: "Portfolio" }))]
      .filter((img, index, array) => array.findIndex((other) => other.url === img.url) === index);

    if (allImages.length > 0) {
      allImages.forEach((img, idx) => {
        gridItems.push({
          imageUrl: img.url!,
          caption: img.caption,
          photographerName: p.display_name,
          photographerCity: typeof p.location === "string" ? p.location.split(",")[0]?.trim() : undefined,
          profileId: p.user_id,
          aspectClass: ASPECT_CYCLE[(gridItems.length + idx) % ASPECT_CYCLE.length],
        });
      });
    }
  }

  return (
    <div className="relative min-h-screen">
      <Image
        src="/photo-bg.jpg"
        alt=""
        fill
        priority
        unoptimized
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10">

      {/* Hero */}
      <section className="pt-28 pb-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-6">
          <Camera size={11} /> CineGenius Galerie
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-3">
              Fotos & Portfolio
            </h1>
            <p className="text-text-muted max-w-xl leading-relaxed">
              Entdecke öffentliche Portfolio- und Projektfotos aus der CineGenius-Community.
            </p>
          </div>
          <Link
            href="/creators"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >
            Crew entdecken <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Grid */}
      {gridItems.length > 0 ? (
        <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {gridItems.map((item, i) => (
              <Link
                key={`${item.profileId}-${i}`}
              href={`/profile/${photoProfiles.find((profile) => profile.user_id === item.profileId)?.slug || item.profileId}#portfolio`}
                className={`group relative rounded-xl overflow-hidden ${item.aspectClass} bg-bg-elevated border border-border`}
              >
                <Image
                  src={item.imageUrl}
                  alt={item.photographerName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <p className="text-white font-semibold text-xs leading-tight">{item.photographerName}</p>
                  {item.photographerCity && (
                    <p className="text-white/70 text-[10px] flex items-center gap-1 mt-0.5">
                      <MapPin size={8} /> {item.photographerCity}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-5">
            <Camera size={24} className="text-gold" />
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">Sei der Erste</h2>
          <p className="text-text-muted mb-6 max-w-md mx-auto">
            Noch keine öffentlichen Portfoliofotos vorhanden. Erstelle dein Profil und zeig deine Arbeit.
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
