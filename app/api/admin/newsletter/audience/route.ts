import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { db } from "@/lib/db";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { count, error } = await db.from("newsletter_subscriptions").select("id", { count: "exact", head: true }).eq("status", "confirmed");
  if (error) return NextResponse.json({ error: "newsletter_audience_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ confirmedCount: count ?? 0 }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
