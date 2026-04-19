import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function isAdmin(userId: string) {
  return ADMIN_IDS.includes(userId);
}

// PATCH /api/admin/listings — toggle published flag or delete
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { listingId, published } = await req.json();
  if (!listingId || typeof published !== "boolean") {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("listings")
    .update({ published })
    .eq("id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/listings — remove a listing
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "Kein Inserat" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("listings")
    .delete()
    .eq("id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
