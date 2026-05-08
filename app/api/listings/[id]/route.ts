import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/listings/[id] — edit own listing
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const { title, description, price, city, published } = body;

  if (title !== undefined && title.length > 200)
    return NextResponse.json({ error: "Titel zu lang (max. 200 Zeichen)" }, { status: 400 });
  if (city !== undefined && city.length > 100)
    return NextResponse.json({ error: "Stadt zu lang (max. 100 Zeichen)" }, { status: 400 });
  if (description !== undefined && description.length > 5000)
    return NextResponse.json({ error: "Beschreibung zu lang (max. 5000 Zeichen)" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (title !== undefined)       updates.title       = title.trim();
  if (description !== undefined) updates.description = description;
  if (price !== undefined)       updates.price       = Math.max(0, Math.min(Number(price) || 0, 1_000_000));
  if (city !== undefined)        updates.city        = city.trim();
  if (published !== undefined)   updates.published   = Boolean(published);

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });

  const { data, error } = await db
    .from("listings")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, type")
    .single();

  if (error) {
    console.error("[listings PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });

  const pathMap: Record<string, string> = {
    job: "/jobs", location: "/locations", prop: "/props",
    vehicle: "/vehicles", creator: "/creators", animal: "/tiere",
  };
  if (pathMap[data.type]) revalidatePath(pathMap[data.type]);
  revalidateTag("listings", "max");

  return NextResponse.json({ success: true });
}

// DELETE /api/listings/[id] — delete own listing
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  const { data: listing } = await db
    .from("listings")
    .select("type")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  const { error } = await db
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[listings DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pathMap: Record<string, string> = {
    job: "/jobs", location: "/locations", prop: "/props",
    vehicle: "/vehicles", creator: "/creators", animal: "/tiere",
  };
  if (listing?.type && pathMap[listing.type]) revalidatePath(pathMap[listing.type]);
  revalidateTag("listings", "max");

  return NextResponse.json({ success: true });
}
