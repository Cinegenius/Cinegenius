import { db } from "@/lib/db";
import { requireAuth, getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// GET /api/blocks — list the IDs I have blocked
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ blocked: [] });
  const { userId } = user;

  const { data } = await db
    .from("blocks")
    .select("id, blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ blocked: data ?? [] });
}

// POST /api/blocks — toggle block for { blocked_id }
// Returns { blocked: true }  after blocking
// Returns { blocked: false } after unblocking
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Per-user rate limit: 20 block toggles per minute
  const { allowed } = await rateLimit(`block:${userId}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_35bd89251439') }, { status: 429 });

  const { blocked_id } = await req.json();
  if (!blocked_id || typeof blocked_id !== "string") {
    return NextResponse.json({ error: tResponse('System.m_f2e69ad52fd4') }, { status: 400 });
  }
  if (blocked_id === userId) {
    return NextResponse.json({ error: tResponse('System.m_01847317fe62') }, { status: 400 });
  }

  // Check if already blocked
  const { data: existing } = await db
    .from("blocks")
    .select("id")
    .eq("blocker_id", userId)
    .eq("blocked_id", blocked_id)
    .maybeSingle();

  if (existing) {
    // Unblock
    await db.from("blocks").delete().eq("id", existing.id);
    return NextResponse.json({ blocked: false });
  }

  // Block
  const { error } = await db.from("blocks").insert({ blocker_id: userId, blocked_id });
  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

  return NextResponse.json({ blocked: true });
}
