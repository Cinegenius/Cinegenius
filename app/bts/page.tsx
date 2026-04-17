import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Image from "next/image";
import Link from "next/link";
import { Aperture, ArrowRight, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Behind the Scenes — Backstage & Set-Fotos | CineGenius",
  description: "Echte Behind-the-Scenes-Fotos von Filmsets, Shootings und Produktionen. Entdecke Crews, Locations und Projekte hinter der Kamera.",
};

export const revalidate = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

interface BTSItem {
  imageUrl: string;
  caption?: string;
  authorName: string;
  authorCity?: string;
  profileId: string;
}

const BTS_TYPES = new Set(["bts", "set_photo", "portfolio"]);
const CREW_TYPES = new Set(["camera", "lighting", "sound", "director_of_photography", "director",
  "production", "makeup", "costume", "filmmaker", "photographer", "editor"]);

export default async function BTSPage() {
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, tagline, location, avatar_url, profile_images, profile_type, profile_types")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("updated_at", { ascending: false })
    .limit(300);

  const btsItems: BTSItem[] = [];

  for (const p of (profiles ?? []) as RawProfile[]) {
    const images = Array.isArray(p.profile_images)
      ? (p.profile_images as Array<{ url?: string; media_type?: string; caption?: string }>)
      : [];

    // Prefer explicit BTS/set photos
    const btsImgs = images.filter(
      (img) => img.url?.includes("supabase.co/storage") && BTS_TYPES.has(img.media_type ?? "")
    );

    // Fallback: any portfolio image from crew/creative profiles
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
      });
    });
  }

  return (
    <>
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

      {/* Mosaic Grid */}
      {btsItems.length > 0 ? (
        <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[200px]">
            {btsItems.map((item, i) => {
              // Every 7th item spans 2 rows for visual variety
              const tall = i % 7 === 0;
              return (
                <Link
                  key={`${item.profileId}-${i}`}
                  href={`/profile/${item.profileId}`}
                  className={`group relative rounded-xl overflow-hidden bg-bg-elevated border border-border ${tall ? "row-span-2" : ""}`}
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.authorName}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {item.caption && (
                      <p className="text-white/80 text-[10px] mb-0.5 line-clamp-1">{item.caption}</p>
                    )}
                    <p className="text-white font-semibold text-xs">{item.authorName}</p>
                    {item.authorCity && (
                      <p className="text-white/60 text-[10px] flex items-center gap-1 mt-0.5">
                        <MapPin size={8} /> {item.authorCity}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
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
    </>
  );
}
