import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const VALID_TARGET_TYPES = new Set(["user", "listing", "review"]);
const VALID_REASONS = new Set([
  "spam",
  "harassment",
  "fake_profile",
  "inappropriate_content",
  "scam",
  "underage",
  "other",
]);

// POST /api/reports — submit a report
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const { target_type, target_id, reason, details } = body;

  if (!VALID_TARGET_TYPES.has(target_type)) {
    return NextResponse.json({ error: "Ungültiger target_type" }, { status: 400 });
  }
  if (!target_id || typeof target_id !== "string") {
    return NextResponse.json({ error: "target_id fehlt" }, { status: 400 });
  }
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "Ungültiger Grund" }, { status: 400 });
  }
  if (details && String(details).length > 1000) {
    return NextResponse.json({ error: "Details zu lang (max. 1000 Zeichen)" }, { status: 400 });
  }
  // Can't report yourself
  if (target_type === "user" && target_id === userId) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst melden" }, { status: 400 });
  }

  // Prevent duplicate reports
  const { data: existing } = await db
    .from("reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("target_id", target_id)
    .eq("target_type", target_type)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Du hast diesen Inhalt bereits gemeldet" }, { status: 409 });
  }

  const { data, error } = await db
    .from("reports")
    .insert({
      reporter_id: userId,
      target_type,
      target_id,
      reason,
      details: details?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}

// GET /api/reports — admin only: list pending reports
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const adminIds = new Set(
    (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  if (!adminIds.has(userId)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const page   = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit  = 50;
  const from   = (page - 1) * limit;
  const to     = from + limit - 1;

  const { data, error } = await db
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [], page, limit });
}

// PATCH /api/reports — admin only: update report status
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const adminIds = new Set(
    (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  if (!adminIds.has(userId)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id, status } = await req.json();
  if (!id || !["reviewed", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "id und gültiger Status erforderlich" }, { status: 400 });
  }

  const { error } = await db
    .from("reports")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
