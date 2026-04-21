import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/listings — toggle published flag
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { listingId, published } = await req.json();
  if (!listingId || typeof published !== "boolean") {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  const { error } = await db
    .from("listings")
    .update({ published })
    .eq("id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/listings — remove a listing
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "Kein Inserat" }, { status: 400 });

  const { error } = await db
    .from("listings")
    .delete()
    .eq("id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
