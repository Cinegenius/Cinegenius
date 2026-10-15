import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/profile-views — Aufrufe des eigenen Profils
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ views7: 0, views14: 0, trend: 0, daily: [] });

  const { userId } = user;
  const now = new Date();
  const d7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [legacyResult, dailyResult] = await Promise.all([
    db.from("profile_views")
      .select("viewed_at")
      .eq("profile_id", userId)
      .gte("viewed_at", d14)
      .order("viewed_at", { ascending: true }),
    db.from("profile_view_daily")
      .select("viewed_on")
      .eq("profile_id", userId)
      .gte("viewed_on", d14.slice(0, 10))
      .order("viewed_on", { ascending: true }),
  ]);

  if (legacyResult.error || (dailyResult.error && !["42P01", "PGRST205"].includes(dailyResult.error.code ?? ""))) {
    return NextResponse.json({ error: "Profilaufrufe konnten nicht geladen werden" }, { status: 500 });
  }

  const rows = [
    ...(legacyResult.data ?? []),
    ...(!dailyResult.error ? (dailyResult.data ?? []).map((row) => ({ viewed_at: `${row.viewed_on}T12:00:00.000Z` })) : []),
  ];

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
