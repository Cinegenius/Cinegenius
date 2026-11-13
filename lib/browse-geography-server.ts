import "server-only";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { browsePlace } from "@/lib/browse-geography";
import { PLACE_COLUMNS } from "@/lib/places/core";
import { placeReadFields } from "@/lib/places/catalog";

export async function ownBrowsePlace() {
  const { userId } = await auth();
  if (!userId) return { userId: null, place: null };
  const { data, error } = await db.from("profiles").select(`${PLACE_COLUMNS},location`).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("browse_preference_unavailable");
  return { userId, place: data ? browsePlace(placeReadFields(data.location ?? "", data)) : null };
}
