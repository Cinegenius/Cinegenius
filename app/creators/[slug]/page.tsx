import { publicListingIds, profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { taxonomyLabel } from "@/lib/departments";
import { getTranslations as getPageTranslations } from "next-intl/server";
import { canViewProfile } from "@/lib/trust";
import JsonLd from "@/components/JsonLd";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { recordProfileView } from "@/lib/profile-views";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import CreatorDetail from "@/components/CreatorDetail";
import { getTranslations } from "next-intl/server";


// Dynamic because of auth()

function parseCreatorDescription(raw: string): { skills: string[]; credits: string[] } {
  const skillsMatch = raw.match(/^Skills: (.+)$/m);
  const experienceMatch = raw.match(/^Erfahrung: (.+)$/m);
  return {
    skills: skillsMatch ? skillsMatch[1].split(",").map((s) => s.trim()).filter(Boolean) : [],
    credits: experienceMatch ? [experienceMatch[1].trim()] : [],
  };
}

async function _getCreator(slug: string) {
  try {
    // Try listings first
    const { data: listing } = await db
      .from("listings")
      .select("id, user_id, type, title, category, city, price, image_url, description, published")
      .eq("id", slug)
      .eq("type", "creator")
      .eq("published", true)
      .single();

    if (listing) {
      const { skills, credits } = parseCreatorDescription(listing.description ?? "");
      // Check if the listing owner is verified
      let verified = false;
      if (listing.user_id) {
        const { data: ownerProfile } = await db
          .from("profiles")
          .select("verified")
          .eq("user_id", listing.user_id)
          .maybeSingle();
        verified = ownerProfile?.verified ?? false;
      }
      return {
        id: listing.id,
        name: listing.title ?? "",
        role: listing.category ?? "",
        location: listing.city ?? "",
        image: listing.image_url ?? "",
        avatar: listing.image_url ?? "",
        rating: 0,
        reviews: 0,
        dayRate: (listing.price ?? 0) > 0 ? `${listing.price} €/Tag` : "Nach Vereinbarung",
        available: true,
        credits,
        skills,
        verified,
        ownerId: listing.user_id ?? "",
        isReal: true,
      };
    }

    // Fall back to profiles table (slug = user_id) → redirect to /profile page
    const { data: profile } = await db
      .from("profiles")
      .select("user_id, slug")
      .eq("user_id", slug)
      .maybeSingle();

    if (!profile) return null;

    // Profiles now use the modular /profile/[slug] page
    redirect(`/profile/${profile.slug ?? profile.user_id}`);
  } catch {
    return null;
  }
}

const getCreatorData = unstable_cache(_getCreator, ["creator"], { revalidate: 300, tags: ["listings", "profiles"] });
async function getCreator(slug: string) {
  const creator = await getCreatorData(slug);
  if (!creator || !(await publicListingIds([creator.id])).has(creator.id)) return null;
  const translate = await getTranslations();
  return { ...creator, name: creator.name || translate("Ui.text_88447b83090cde"), role: creator.role ? taxonomyLabel(creator.role, translate) : translate("creators.defaultRole") };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const pageCopy = await getPageTranslations("PageCopy");
  const { slug } = await params;
  const rawCreator = await getCreator(slug);
  const creator = rawCreator ? projectProfilePrivacy(rawCreator,(await profileAccessFor([rawCreator.ownerId])).get(rawCreator.ownerId)) : null;
  if (!creator || !await canViewProfile(creator.ownerId, null)) return {};
  return {
    title: `${creator.name} — ${creator.role}`,
    description: pageCopy("p_c2b9b41e4402", { value0: String(creator.name), value1: String(creator.role), value2: String(creator.location) }),
    openGraph: {
      title: `${creator.name} | CineGenius`,
      description: `${creator.role} · ${creator.location}`,
      ...(creator.image ? { images: [{ url: creator.image, width: 400, height: 400, alt: creator.name }] } : {}),
    },
  };
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pageCopy = await getPageTranslations("PageCopy");
  const uiText = await getTranslations();

  const { slug } = await params;
  const rawCreator = await getCreator(slug);
  const { userId } = await auth();
  const creator = rawCreator ? projectProfilePrivacy(rawCreator,(await profileAccessFor([rawCreator.ownerId],userId)).get(rawCreator.ownerId)) : null;
  if (!creator) notFound();

  // Profilaufruf tracken (nicht eigenes Profil, fire-and-forget)
  if (creator.ownerId) await recordProfileView(creator.ownerId, userId);

  // Fetch creator's privacy settings
  const { data: settings } = await db
    .from("user_settings")
    .select("profile_visibility, message_permission")
    .eq("user_id", creator.ownerId)
    .maybeSingle();

  const messagePermission = settings?.message_permission ?? "everyone";

  // Check friendship status
  let friendshipData: { id: string; status: string; sender_id: string } | null = null;

  if (userId && creator.ownerId && userId !== creator.ownerId) {
    const { data: fs } = await db
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

  // A known legacy URL does not reveal a hidden identity.
  if (!await canViewProfile(creator.ownerId, userId)) notFound();

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
    "description": ("bio" in creator && creator.bio) ? String(creator.bio) : pageCopy("p_4a0b30e98e18", { value0: String(creator.role), value1: String(creator.location) }),
    "image": creator.image,
    "addressLocality": creator.location,
    "knowsAbout": "skills" in creator ? creator.skills : [],
    "offers": {
      "@type": "Offer",
      "description": pageCopy("p_cb39ea605950", { value0: String(positions.join(", ")) }),
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
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
