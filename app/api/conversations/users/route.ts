import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getPrivateProfileIds } from "@/lib/trust";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const rawQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length < 2 || rawQuery.length > 80) return NextResponse.json({ users: [] });

  const query = rawQuery.replace(/[(),]/g, " ").trim();
  if (!query) return NextResponse.json({ users: [] });
  const { data, error } = await db
    .from("profiles")
    .select("user_id, display_name, avatar_url, role, location")
    .neq("user_id", userId)
    .not("display_name", "is", null)
    .ilike("display_name", `%${query}%`)
    .order("display_name", { ascending: true })
    .limit(25);
  if (error) return NextResponse.json({ error: "Nutzersuche ist gerade nicht verfügbar." }, { status: 500 });

  const profiles = data ?? [];
  const privateIds = await getPrivateProfileIds(profiles.map((profile) => profile.user_id));
  return NextResponse.json({
    users: profiles
      .filter((profile) => !privateIds.has(profile.user_id))
      .map((profile) => ({
        id: profile.user_id,
        name: profile.display_name ?? "Unbekannt",
        avatar: profile.avatar_url ?? null,
        role: profile.role ?? null,
        location: profile.location ?? null,
      })),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
