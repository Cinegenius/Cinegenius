import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Image from "next/image";
import Link from "next/link";
import { Camera, ArrowRight, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Fotografen & Portfolio — CineGenius",
  description: "Entdecke Fotografen aus der DACH-Region: Portraits, Editorial, Commercial, Lifestyle. Portfolio-Bilder direkt ansehen und buchen.",
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
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, tagline, location, avatar_url, profile_images, profile_type, profile_types, verified")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("updated_at", { ascending: false })
    .limit(200);

  const photoProfiles = (profiles ?? []).filter((p: RawProfile) => {
    const types: string[] = [p.profile_type, ...(Array.isArray(p.profile_types) ? p.profile_types : [])].filter(Boolean);
    return types.includes("photographer");
  });

  const gridItems: GridItem[] = [];
  for (const p of photoProfiles) {
    const images = Array.isArray(p.profile_images)
      ? (p.profile_images as Array<{ url?: string; media_type?: string; caption?: string }>)
      : [];
    const portfolioImgs = images.filter(
      (img) => img.url?.includes("supabase.co/storage") && img.media_type !== "headshot"
    );

    if (portfolioImgs.length > 0) {
      portfolioImgs.slice(0, 4).forEach((img, idx) => {
        gridItems.push({
          imageUrl: img.url!,
          caption: img.caption,
          photographerName: p.display_name,
          photographerCity: typeof p.location === "string" ? p.location.split(",")[0]?.trim() : undefined,
          profileId: p.user_id,
          aspectClass: ASPECT_CYCLE[(gridItems.length + idx) % ASPECT_CYCLE.length],
        });
      });
    } else if (typeof p.avatar_url === "string" && p.avatar_url.includes("supabase.co/storage")) {
      gridItems.push({
        imageUrl: p.avatar_url,
        caption: p.tagline,
        photographerName: p.display_name,
        photographerCity: typeof p.location === "string" ? p.location.split(",")[0]?.trim() : undefined,
        profileId: p.user_id,
        aspectClass: ASPECT_CYCLE[gridItems.length % ASPECT_CYCLE.length],
      });
    }
  }

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: `url('https://plus.unsplash.com/premium_photo-1698371217616-69581e44570d?q=80&w=1740&auto=format&fit=crop')`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/72 pointer-events-none" />
      <div className="relative z-10">

      {/* Hero */}
      <section className="pt-28 pb-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-6">
          <Camera size={11} /> Fotografie
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-3">
              Fotografen & Portfolio
            </h1>
            <p className="text-text-muted max-w-xl leading-relaxed">
              Portraits, Editorial, Commercial, Lifestyle — entdecke Fotografen aus der DACH-Region und buche direkt.
            </p>
          </div>
          <Link
            href="/creators"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >
            Alle Fotografen <ArrowRight size={14} />
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
                href={`/profile/${item.profileId}`}
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
            Noch keine Fotografen-Profile mit Portfolio. Erstelle dein Profil und zeig deine Arbeit.
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
