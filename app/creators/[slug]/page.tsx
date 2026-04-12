import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import CreatorDetail from "@/components/CreatorDetail";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseCreatorDescription(raw: string): { skills: string[]; credits: string[] } {
  const skillsMatch = raw.match(/^Skills: (.+)$/m);
  const experienceMatch = raw.match(/^Erfahrung: (.+)$/m);
  return {
    skills: skillsMatch ? skillsMatch[1].split(",").map((s) => s.trim()).filter(Boolean) : [],
    credits: experienceMatch ? [experienceMatch[1].trim()] : [],
  };
}

async function getCreator(slug: string) {
  // Try listings first
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", slug)
    .eq("type", "creator")
    .single();

  if (listing) {
    const { skills, credits } = parseCreatorDescription(listing.description ?? "");
    // Check if the listing owner is verified
    let verified = false;
    if (listing.user_id) {
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("verified")
        .eq("user_id", listing.user_id)
        .maybeSingle();
      verified = ownerProfile?.verified ?? false;
    }
    return {
      id: listing.id,
      name: listing.title,
      role: listing.category ?? "Filmschaffende/r",
      location: listing.city ?? "",
      image: listing.image_url ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
      rating: 0,
      reviews: 0,
      dayRate: listing.price > 0 ? `${listing.price} €/Tag` : "Nach Vereinbarung",
      available: true,
      credits,
      skills,
      verified,
      ownerId: listing.user_id ?? "",
      isReal: true,
    };
  }

  // Fall back to profiles table (slug = user_id) → redirect to /profile page
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, slug")
    .eq("user_id", slug)
    .maybeSingle();

  if (!profile) return null;

  // Profiles now use the modular /profile/[slug] page
  redirect(`/profile/${profile.slug ?? profile.user_id}`);
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const creator = await getCreator(slug);
  if (!creator) return {};
  return {
    title: `${creator.name} — ${creator.role}`,
    description: `${creator.name} ist ${creator.role} aus ${creator.location}. Jetzt auf CineGenius anfragen.`,
    openGraph: {
      title: `${creator.name} | CineGenius`,
      description: `${creator.role} · ${creator.location}`,
      images: [{ url: creator.image, width: 400, height: 400, alt: creator.name }],
    },
  };
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creator = await getCreator(slug);
  if (!creator) notFound();

  const { userId } = await auth();

  // Profilaufruf tracken (nicht eigenes Profil, fire-and-forget)
  if (creator.ownerId && userId !== creator.ownerId) {
    void supabaseAdmin.from("profile_views").insert({
      profile_id: creator.ownerId,
      viewer_id: userId ?? null,
    });
  }

  // Fetch creator's privacy settings
  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("profile_visibility, message_permission")
    .eq("user_id", creator.ownerId)
    .maybeSingle();

  const profileVisibility = settings?.profile_visibility ?? "public";
  const messagePermission = settings?.message_permission ?? "everyone";

  // Check friendship status
  let friendshipData: { id: string; status: string; sender_id: string } | null = null;

  if (userId && creator.ownerId && userId !== creator.ownerId) {
    const { data: fs } = await supabaseAdmin
      .from("friendships")
      .select("id, sender_id, status")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${creator.ownerId}),and(sender_id.eq.${creator.ownerId},receiver_id.eq.${userId})`
      )
      .maybeSingle();
    if (fs) friendshipData = { id: fs.id, status: fs.status, sender_id: fs.sender_id };
  }

  const isFriend = friendshipData?.status === "accepted";
  const isOwn   = userId === creator.ownerId;

  // Private profile check
  const canView = isOwn || profileVisibility === "public" || isFriend;
  if (!canView) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-5">
          <div className="w-16 h-16 mx-auto bg-bg-secondary border border-border rounded-full flex items-center justify-center">
            <Lock size={24} className="text-text-muted" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
              Dieses Profil ist privat
            </h1>
            <p className="text-sm text-text-muted">
              Nur Freunde von {creator.name} können dieses Profil sehen.
            </p>
          </div>
          <Link
            href="/creators"
            className="inline-flex items-center gap-2 text-gold hover:text-gold-light text-sm font-medium transition-colors"
          >
            <ArrowLeft size={14} /> Zurück zu Filmschaffenden
          </Link>
        </div>
      </div>
    );
  }

  // Message permission
  const canMessage = isOwn || messagePermission === "everyone" || isFriend;

  // Friendship status for UI
  type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "rejected";
  let friendStatus: FriendStatus = "none";
  if (friendshipData) {
    if (friendshipData.status === "accepted") friendStatus = "accepted";
    else if (friendshipData.status === "pending") {
      friendStatus = friendshipData.sender_id === userId ? "pending_sent" : "pending_received";
    } else if (friendshipData.status === "rejected") friendStatus = "rejected";
  }

  const positions = "positions" in creator && Array.isArray(creator.positions) && creator.positions.length > 0
    ? creator.positions
    : [creator.role];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": creator.name,
    "jobTitle": positions[0],
    "description": ("bio" in creator && creator.bio) ? String(creator.bio) : `${creator.role} aus ${creator.location}`,
    "image": creator.image,
    "addressLocality": creator.location,
    "knowsAbout": "skills" in creator ? creator.skills : [],
    "offers": {
      "@type": "Offer",
      "description": `${positions.join(", ")} für Film- und Medienproduktionen`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CreatorDetail
        creator={creator}
        friendshipId={friendshipData?.id}
        friendStatus={friendStatus}
        canMessage={canMessage}
        isOwnProfile={isOwn}
        currentUserId={userId ?? null}
      />
    </>
  );
}
