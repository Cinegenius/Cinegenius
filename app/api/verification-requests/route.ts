import { db } from "@/lib/db";
import { requireAuth, isAdminSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/verification-requests — user: own status | admin: all requests
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const isAdmin = await isAdminSession();

  // Admin gets all
  if (isAdmin) {
    const { data, error } = await db
      .from("verification_requests")
      .select("id, user_id, display_name, status, notes, submitted_at, reviewed_at")
      .order("submitted_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  // Regular user gets own latest request
  const { data } = await db
    .from("verification_requests")
    .select("id, status, submitted_at, reviewed_at")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ data: data ?? [] });
}

// POST /api/verification-requests — user submits verification request
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Check for existing pending request
  const { data: existing } = await db
    .from("verification_requests")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: existing.status === "approved" ? "Bereits verifiziert" : "Bereits eine Anfrage gestellt" },
      { status: 400 }
    );
  }

  let notes: string | null = null;
  try {
    const body = await req.json();
    notes = body?.notes ?? null;
  } catch { /* no body */ }

  const { data: p } = await db
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const { data, error } = await db
    .from("verification_requests")
    .insert({
      user_id: userId,
      display_name: p?.display_name ?? null,
      status: "pending",
      notes,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

// PATCH /api/verification-requests — admin approves or rejects
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { requestId, action, notes } = await req.json() as { requestId: string; action: "approve" | "reject"; notes?: string };
  if (!requestId || !action) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const status = action === "approve" ? "approved" : "rejected";

  const { data: request } = await db
    .from("verification_requests")
    .update({ status, notes: notes ?? null, reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq("id", requestId)
    .select("user_id")
    .single();

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If approved, set verified on profile
  if (action === "approve") {
    await db
      .from("profiles")
      .update({ verified: true })
      .eq("user_id", request.user_id);
  }

  return NextResponse.json({ ok: true });
}
