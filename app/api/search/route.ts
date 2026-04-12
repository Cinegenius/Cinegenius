import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;

  const [listingsRes, profilesRes] = await Promise.all([
    // Listings: title, city, category, description (skills are stored there)
    supabaseAdmin
      .from("listings")
      .select("id, title, city, type, category, price, image_url")
      .eq("published", true)
      .or(`title.ilike.${like},city.ilike.${like},category.ilike.${like},description.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(10),

    // Profiles: display_name, role, location — covers user/crew search
    supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, location, role, positions, avatar_url, available")
      .or(`display_name.ilike.${like},role.ilike.${like},location.ilike.${like},bio.ilike.${like}`)
      .not("display_name", "is", null)
      .neq("display_name", "")
      .limit(8),
  ]);

  const listings = (listingsRes.data ?? []).map((l) => ({
    id: l.id,
    title: l.title as string,
    subtitle: l.city as string ?? "",
    type: l.type as string,
    price: (l.price as number) ?? 0,
    image: l.image_url as string | null,
    available: null as boolean | null,
  }));

  const profiles = (profilesRes.data ?? [])
    .filter((p) => p.display_name)
    .map((p) => ({
      id: p.user_id as string,
      title: p.display_name as string,
      subtitle: [p.role ?? p.positions?.[0], p.location].filter(Boolean).join(" · "),
      type: "profile",
      price: 0,
      image: p.avatar_url as string | null,
      available: p.available as boolean | null,
    }));

  return NextResponse.json({ results: [...listings, ...profiles] });
}
