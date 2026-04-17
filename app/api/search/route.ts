import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type")?.trim() ?? "all";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;

  const wantListings = type === "all" || ["location", "vehicle", "prop", "job", "creator"].includes(type);
  const wantProfiles = type === "all" || type === "profile";
  const wantCompanies = type === "all" || type === "company";

  const [listingsRes, profilesRes, companiesRes] = await Promise.all([
    wantListings
      ? (() => {
          let q2 = supabaseAdmin
            .from("listings")
            .select("id, title, city, type, category, price, image_url")
            .eq("published", true)
            .or(`title.ilike.${like},city.ilike.${like},category.ilike.${like},description.ilike.${like}`)
            .order("created_at", { ascending: false });
          if (type !== "all") q2 = q2.eq("type", type);
          return q2.limit(type === "all" ? 12 : 24);
        })()
      : Promise.resolve({ data: [] }),

    wantProfiles
      ? supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, location, role, positions, avatar_url, available")
          .or(`display_name.ilike.${like},role.ilike.${like},location.ilike.${like},bio.ilike.${like}`)
          .not("display_name", "is", null)
          .neq("display_name", "")
          .limit(type === "all" ? 8 : 24)
      : Promise.resolve({ data: [] }),

    wantCompanies
      ? supabaseAdmin
          .from("companies")
          .select("id, slug, name, city, logo_url, categories")
          .or(`name.ilike.${like},city.ilike.${like},description.ilike.${like}`)
          .limit(type === "all" ? 4 : 24)
      : Promise.resolve({ data: [] }),
  ]);

  const listings = (listingsRes.data ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    title: l.title as string,
    subtitle: (l.city as string) ?? "",
    type: l.type as string,
    price: (l.price as number) ?? 0,
    image: l.image_url as string | null,
    available: null as boolean | null,
  }));

  const profiles = (profilesRes.data ?? [])
    .filter((p: Record<string, unknown>) => p.display_name)
    .map((p: Record<string, unknown>) => ({
      id: p.user_id as string,
      title: p.display_name as string,
      subtitle: [(p.role ?? (p.positions as string[])?.[0]), p.location].filter(Boolean).join(" · "),
      type: "profile",
      price: 0,
      image: p.avatar_url as string | null,
      available: p.available as boolean | null,
    }));

  const companies = (companiesRes.data ?? []).map((c: Record<string, unknown>) => ({
    id: (c.slug ?? c.id) as string,
    title: c.name as string,
    subtitle: (c.city as string) ?? "",
    type: "company",
    price: 0,
    image: c.logo_url as string | null,
    available: null as boolean | null,
  }));

  return NextResponse.json({ results: [...listings, ...profiles, ...companies] });
}
