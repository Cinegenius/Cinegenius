import { DEFAULT_PRIVACY, PRIVACY_AUDIENCES, PRIVACY_COLUMNS } from "@/lib/profile-privacy";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// GET /api/user-settings
export async function GET() {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { data, error } = await db
    .from("user_settings")
    .select(PRIVACY_COLUMNS)
    .eq("user_id", userId)
    .abortSignal(AbortSignal.timeout(8000))
    .maybeSingle();

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

  return NextResponse.json({
    settings: { ...DEFAULT_PRIVACY, ...data },
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

// PATCH /api/user-settings
export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: tResponse('System.m_436f7cd0980c') }, { status: 400 });
  }
  if (body.accountId !== undefined && body.accountId !== userId) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 409 });
  if (Object.keys(body).some(key => key !== 'accountId' && !Object.hasOwn(DEFAULT_PRIVACY,key))) return NextResponse.json({ error: tResponse('System.m_436f7cd0980c') }, { status: 400 });
  const update: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };

  if (body.profile_visibility !== undefined) {
    if (!["public", "private"].includes(body.profile_visibility)) {
      return NextResponse.json({ error: tResponse('System.m_f4c28597d2f6') }, { status: 400 });
    }
    update.profile_visibility = body.profile_visibility;
  }
  if (body.message_permission !== undefined) {
    if (!["everyone", "friends_only"].includes(body.message_permission)) {
      return NextResponse.json({ error: tResponse('System.m_3482602718b9') }, { status: 400 });
    }
    update.message_permission = body.message_permission;
  }
  for (const key of ["ghost_mode", "email_new_message"] as const) {
  if (body[key] !== undefined) {
    if (typeof body[key] !== "boolean") {
      return NextResponse.json({ error: tResponse('System.m_813f3fe986af') }, { status: 400 });
    }
    update[key] = body[key];
  }
  }
  for (const field of ["phone_visibility", "contact_email_visibility", "location_visibility", "map_visibility", "activity_visibility"] as const) {
    if (body[field] !== undefined) {
      if (!(PRIVACY_AUDIENCES as readonly unknown[]).includes(body[field])) {
        return NextResponse.json({ error: tResponse('System.m_3deca245a321') }, { status: 400 });
      }
      update[field] = body[field];
    }
  }
  if (Object.keys(update).length === 2) {
    return NextResponse.json({ error: tResponse('System.m_4ffefb496bf3') }, { status: 400 });
  }

  const { data: saved, error } = await db
    .from("user_settings")
    .upsert(update, { onConflict: "user_id" })
    .select(PRIVACY_COLUMNS)
    .abortSignal(AbortSignal.any([req.signal, AbortSignal.timeout(8000)]))
    .single();

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  // Privacy withdrawal must expire, never stale-while-revalidate, every public projection.
  for (const tag of ["profiles", "creator-directory", "companies", "projects", "listings", "community-media"]) revalidateTag(tag, { expire: 0 });
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ success: true, settings: saved }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
