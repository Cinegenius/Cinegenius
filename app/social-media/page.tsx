import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Image from "next/image";
import Link from "next/link";
import { Zap, ArrowRight, MapPin, ExternalLink, Link2, Play } from "lucide-react";

export const metadata: Metadata = {
  title: "Social Media Creator entdecken — Instagram, TikTok, YouTube | CineGenius",
  description: "Finde Social-Media-Creator, Influencer und Content-Produzenten für deine Kampagne. Instagram, TikTok, YouTube — direkt buchbar auf CineGenius.",
};

export const revalidate = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

interface CreatorCard {
  id: string;
  name: string;
  tagline?: string;
  city?: string;
  avatar?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  dayRate?: number;
  available: boolean;
}

export default async function SocialMediaPage() {
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, tagline, location, avatar_url, profile_type, profile_types, instagram_url, youtube_url, tiktok_url, website_url, day_rate, available, verified")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("updated_at", { ascending: false })
    .limit(300);

  const creators: CreatorCard[] = ((profiles ?? []) as RawProfile[])
    .filter((p) => {
      const types: string[] = [p.profile_type, ...(Array.isArray(p.profile_types) ? p.profile_types : [])].filter(Boolean);
      return types.includes("creator");
    })
    .map((p) => ({
      id: p.user_id,
      name: p.display_name,
      tagline: p.tagline,
      city: typeof p.location === "string" ? p.location.split(",")[0]?.trim() : undefined,
      avatar: typeof p.avatar_url === "string" && p.avatar_url.includes("supabase.co/storage") ? p.avatar_url : undefined,
      instagramUrl: p.instagram_url,
      youtubeUrl: p.youtube_url,
      tiktokUrl: p.tiktok_url,
      websiteUrl: p.website_url,
      dayRate: p.day_rate,
      available: p.available ?? false,
    }));

  return (
    <div className="relative min-h-screen">
      <Image
        src="https://images.unsplash.com/photo-1696251503133-d3ccd4aee3e5?q=80&w=2064&auto=format&fit=crop"
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
          <Zap size={11} /> Social Media
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-3">
              Social Media Creator
            </h1>
            <p className="text-text-muted max-w-xl leading-relaxed">
              Instagram, TikTok, YouTube — finde Creator und Influencer für deine Kampagne, dein Produkt oder dein Projekt. Direkt buchbar, ohne Agentur.
            </p>
          </div>
          <Link
            href="/creators"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
          >
            Alle Creator <ArrowRight size={14} />
          </Link>
        </div>

        {/* Platform pills */}
        <div className="flex flex-wrap gap-2 mt-8">
          {["Instagram", "TikTok", "YouTube", "Podcast", "Blog", "Lifestyle", "Fashion", "Tech", "Food", "Travel"].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full border border-border bg-bg-secondary text-text-muted text-xs">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Creator Grid */}
      {creators.length > 0 ? (
        <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {creators.map((c) => (
              <Link
                key={c.id}
                href={`/profile/${c.id}`}
                className="group card-hover rounded-2xl border border-border bg-bg-secondary hover:border-gold/30 transition-all overflow-hidden flex flex-col"
              >
                {/* Avatar / Cover */}
                <div className="relative aspect-square bg-bg-elevated overflow-hidden">
                  {c.avatar ? (
                    <Image
                      src={c.avatar}
                      alt={c.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-bg-elevated flex items-center justify-center">
                      <span className="text-4xl font-display font-bold text-gold/40">
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Available badge */}
                  {c.available && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-white font-medium">Verfügbar</span>
                    </div>
                  )}
                  {/* Social links overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.instagramUrl && (
                      <span className="w-7 h-7 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <Link2 size={13} className="text-white" />
                      </span>
                    )}
                    {c.youtubeUrl && (
                      <span className="w-7 h-7 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <Play size={13} className="text-white" />
                      </span>
                    )}
                    {c.tiktokUrl && (
                      <span className="w-7 h-7 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <Zap size={13} className="text-white" />
                      </span>
                    )}
                    {c.websiteUrl && (
                      <span className="w-7 h-7 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <ExternalLink size={13} className="text-white" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-text-primary text-sm leading-snug mb-0.5">{c.name}</h3>
                  {c.city && (
                    <p className="text-[11px] text-text-muted flex items-center gap-1 mb-2">
                      <MapPin size={9} /> {c.city}
                    </p>
                  )}
                  {c.tagline && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 flex-1">{c.tagline}</p>
                  )}
                  {c.dayRate && (
                    <p className="text-xs font-semibold text-gold mt-3">
                      ab {c.dayRate.toLocaleString()} €<span className="text-text-muted font-normal">/Tag</span>
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
            <Zap size={24} className="text-gold" />
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">Noch keine Creator</h2>
          <p className="text-text-muted mb-6 max-w-md mx-auto">
            Erstelle dein Creator-Profil und werde von Marken und Produktionen gefunden.
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
