import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CreatorsContent, { type ServerCreator } from "./CreatorsContent";
import CategoryHero from "@/components/CategoryHero";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Filmcrew & Kreative finden — Kamera, Regie, Content Creator",
  description: "Finde erfahrene Filmcrew, Content Creator und Fotografen: Kameraleute, Regisseure, Cutter, Tontechniker, Influencer und mehr — deutschlandweit buchbar.",
  keywords: ["Filmcrew buchen", "Kameramann buchen", "Content Creator buchen", "Fotograf buchen", "Freelancer Film", "Crew für Filmproduktion"],
  openGraph: {
    title: "Filmcrew & Kreative finden — CineGenius",
    description: "Kamera, Regie, Licht, Ton, Social Media, Fotografie — alle Gewerke auf einer Plattform.",
  },
};

function parseCreatorDescription(raw: string): { skills: string[]; credits: string[] } {
  const skillsMatch = raw.match(/^Skills: (.+)$/m);
  const experienceMatch = raw.match(/^Erfahrung: (.+)$/m);

  const skills = skillsMatch
    ? skillsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const credits = experienceMatch
    ? [experienceMatch[1].trim()]
    : [];

  return { skills, credits };
}

export default async function CreatorsPage() {
  // Fetch creator listings
  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("published", true)
    .eq("type", "creator")
    .order("created_at", { ascending: false });

  // Fetch profiles
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, location, bio, skills, role, positions, available, avatar_url, portfolio_url, portfolio_images, languages, profile_types, profile_type, physical, availability_config, day_rate, travel_ready, verified, tagline")
    .not("display_name", "is", null)
    .neq("display_name", "");

  const fromListings: ServerCreator[] = (listings ?? []).map((l: {
    id: string; title: string; city: string; price: number; category: string | null; description: string | null; image_url: string | null;
  }) => {
    const { skills, credits } = parseCreatorDescription(l.description ?? "");
    return {
      id: l.id,
      name: l.title,
      role: l.category ?? "Filmschaffende/r",
      positions: l.category ? [l.category] : [],
      location: l.city ?? "",
      image: l.image_url ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
      rating: 0,
      reviews: 0,
      dayRate: l.price > 0 ? `${l.price} €/Tag` : "Nach Vereinbarung",
      available: true,
      credits,
      skills,
      verified: false,
      isReal: true,
    };
  });

  const listingUserIds = new Set(fromListings.map((c) => c.id));

  const fromProfiles: ServerCreator[] = (profiles ?? [])
    .filter((p: { user_id: string; positions: string[] | null; role: string | null; profile_types?: string[] | null }) => {
      if (listingUserIds.has(p.user_id)) return false;
      const types = p.profile_types ?? [];
      // Explicitly set as crew → show
      if (types.includes("crew")) return true;
      // No type set yet (old profile) → show if they have positions/role (backwards compat)
      if (types.length === 0) {
        const hasPositions = Array.isArray(p.positions) && p.positions.length > 0;
        const hasRole = !!p.role?.trim();
        return hasPositions || hasRole;
      }
      // Has types but not crew → don't show on crew page
      return false;
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const phys = p.physical ?? {};
      const avail = p.availability_config ?? {};
      return {
        id: p.user_id,
        name: p.display_name ?? "Unbekannt",
        role: p.role ?? (p.positions?.[0] ?? "Filmschaffende/r"),
        positions: p.positions ?? (p.role ? [p.role] : []),
        location: p.location ?? "",
        image: p.avatar_url ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
        rating: 0,
        reviews: 0,
        dayRate: p.day_rate ? `${p.day_rate} €/Tag` : "Nach Vereinbarung",
        available: p.available ?? true,
        credits: [],
        skills: p.skills ?? [],
        bio: p.bio ?? p.tagline ?? "",
        languages: p.languages ?? [],
        verified: p.verified ?? false,
        isReal: true as const,
        // Neue Felder
        profile_type: p.profile_type ?? "",
        hair_color: phys.hair_color ?? "",
        eye_color: phys.eye_color ?? "",
        body_type: phys.body_type ?? "",
        playing_age_min: phys.playing_age_min ?? null,
        playing_age_max: phys.playing_age_max ?? null,
        height_cm: phys.height_cm ?? null,
        travel: avail.travel ?? (p.travel_ready ? "national" : ""),
      };
    });

  const serverCreators: ServerCreator[] = [...fromListings, ...fromProfiles];

  // Avatar strip — only real user-uploaded photos (Supabase storage URLs), shuffled
  const avatarImages = [...fromListings, ...fromProfiles]
    .filter((c) => c.image?.includes("supabase.co/storage"))
    .map((c) => ({ src: c.image, alt: c.name, href: `/creators/${c.id}` }))
    .sort((a, b) => a.alt.localeCompare(b.alt));

  return (
    <>
      <div className="pt-16">
        <CategoryHero
          badge="Crew & Talente"
          title="Filmschaffende, Creator"
          titleHighlight="& Fotografen"
          description="Kameraleute, Regisseure, Schauspieler, Maskenbildner, Content Creator — direkt buchbar, ohne Agentur."
          image="https://images.unsplash.com/photo-1601506521937-0121a7fc2a6b?w=1600&q=90"
          imagePosition="center 40%"
          overlay="left"
          height="sm"
          cta={{ label: "Profil anlegen", href: "/profile" }}
        />
      </div>
      <CreatorsContent serverCreators={serverCreators} hasStrip={true} />
    </>
  );
}
