import { db } from "@/lib/db";
import { requireAuth, assertOwner } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/listings/[id] — update own listing fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  // Fetch resource first — never trust client on ownership
  const { data: existing } = await db
    .from("listings")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  const ownershipError = assertOwner(existing?.user_id, userId);
  if (ownershipError) return ownershipError;

  const body = await req.json();

  // Input length limits
  if (body.title !== undefined && String(body.title).length > 200)
    return NextResponse.json({ error: "Titel zu lang (max. 200 Zeichen)" }, { status: 400 });
  if (body.city !== undefined && String(body.city).length > 100)
    return NextResponse.json({ error: "Stadt zu lang (max. 100 Zeichen)" }, { status: 400 });
  if (body.description !== undefined && String(body.description).length > 5000)
    return NextResponse.json({ error: "Beschreibung zu lang (max. 5000 Zeichen)" }, { status: 400 });

  // Explicit allowlist — no client-controlled columns can be injected
  const ALLOWED_KEYS = [
    "published", "title", "description", "price", "city",
    "category", "image_url", "images", "lat", "lng",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in body) updates[key] = body[key];
  }

  if ("price" in updates) {
    updates["price"] = Math.max(0, Math.min(Number(updates["price"]) || 0, 1_000_000));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine gültigen Felder" }, { status: 400 });
  }

  const { data, error } = await db
    .from("listings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/listings/[id] — delete own listing
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  // Pre-fetch to verify existence and ownership before deleting.
  // Without this, a DELETE on a non-existent or foreign row would
  // silently return success (Supabase deletes 0 rows, no error).
  const { data: existing } = await db
    .from("listings")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  const ownershipError = assertOwner(existing?.user_id, userId);
  if (ownershipError) return ownershipError;

  const { error } = await db
    .from("listings")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
