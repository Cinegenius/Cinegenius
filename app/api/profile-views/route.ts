import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// GET /api/profile-views — Aufrufe des eigenen Profils
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ views7: 0, views14: 0, trend: 0, daily: [] });

  const now = new Date();
  const d7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("profile_views")
    .select("viewed_at")
    .eq("profile_id", userId)
    .gte("viewed_at", d14)
    .order("viewed_at", { ascending: true });

  const rows = data ?? [];

  const views7  = rows.filter((r) => r.viewed_at >= d7).length;
  const views14 = rows.filter((r) => r.viewed_at < d7).length; // previous 7 days
  const trend   = views14 > 0 ? Math.round(((views7 - views14) / views14) * 100) : views7 > 0 ? 100 : 0;

  // Daily buckets for the last 7 days
  const daily: number[] = Array(7).fill(0);
  rows
    .filter((r) => r.viewed_at >= d7)
    .forEach((r) => {
      const daysAgo = Math.floor((now.getTime() - new Date(r.viewed_at).getTime()) / (24 * 60 * 60 * 1000));
      const idx = 6 - Math.min(daysAgo, 6);
      daily[idx]++;
    });

  return NextResponse.json({ views7, views14, trend, daily });
}
