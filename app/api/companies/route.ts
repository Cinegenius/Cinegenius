import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

// GET — list published companies (with optional filters)
export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "true";
  const category = req.nextUrl.searchParams.get("category");
  const city = req.nextUrl.searchParams.get("city");
  const q = req.nextUrl.searchParams.get("q");

  if (mine) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  let query = supabaseAdmin
    .from("companies")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (category) query = query.contains("categories", [category]);
  if (city) query = query.ilike("city", `%${city}%`);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,city.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — create or update company
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const {
    id, name, logo_url, description, city, website, email, phone,
    categories, services, portfolio_images, owner_title,
    tagline, bio_short, usp, founded_year, legal_form, hq_address, countries, industry_focus,
    social_links,
  } = body;

  if (!name?.trim() || !city?.trim()) {
    return NextResponse.json({ error: "Firmenname und Standort sind Pflichtfelder" }, { status: 400 });
  }

  // Update existing
  if (id) {
    const { data: existing } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("id", id)
      .eq("owner_user_id", userId)
      .single();

    if (!existing) return NextResponse.json({ error: "Firma nicht gefunden oder keine Berechtigung" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("companies")
      .update({
        name: name.trim(),
        logo_url: logo_url ?? null,
        description: description?.trim() ?? "",
        city: city.trim(),
        website: website?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        categories: categories ?? [],
        services: services ?? [],
        portfolio_images: portfolio_images ?? [],
        tagline: tagline?.trim() || null,
        bio_short: bio_short?.trim() || null,
        usp: usp?.trim() || null,
        founded_year: founded_year ? Number(founded_year) : null,
        legal_form: legal_form?.trim() || null,
        hq_address: hq_address?.trim() || null,
        countries: countries ?? [],
        industry_focus: industry_focus ?? [],
        social_links: social_links ?? {},
        published: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Keep owner's company_members entry in sync (upsert with their title)
    await supabaseAdmin
      .from("company_members")
      .upsert(
        { company_id: id, user_id: userId, role: "owner", status: "accepted", title: owner_title?.trim() || null },
        { onConflict: "company_id,user_id" }
      );

    return NextResponse.json({ data });
  }

  // Create new — generate unique slug
  const baseSlug = generateSlug(name.trim());
  const { data: existing } = await supabaseAdmin
    .from("companies")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  let slug = baseSlug;
  if (existing && existing.length > 0) {
    const taken = new Set(existing.map((r: { slug: string }) => r.slug));
    let n = 2;
    while (taken.has(slug)) { slug = `${baseSlug}-${n++}`; }
  }

  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert({
      owner_user_id: userId,
      slug,
      name: name.trim(),
      logo_url: logo_url ?? null,
      description: description?.trim() ?? "",
      city: city.trim(),
      website: website?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      categories: categories ?? [],
      services: services ?? [],
      portfolio_images: portfolio_images ?? [],
      tagline: tagline?.trim() || null,
      bio_short: bio_short?.trim() || null,
      usp: usp?.trim() || null,
      founded_year: founded_year ? Number(founded_year) : null,
      legal_form: legal_form?.trim() || null,
      hq_address: hq_address?.trim() || null,
      countries: countries ?? [],
      industry_focus: industry_focus ?? [],
      social_links: social_links ?? {},
      published: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-add owner to company_members as owner/accepted
  await supabaseAdmin
    .from("company_members")
    .upsert(
      { company_id: data.id, user_id: userId, role: "owner", status: "accepted", title: owner_title?.trim() || null },
      { onConflict: "company_id,user_id" }
    );

  // Also mark profile as company type
  await supabaseAdmin
    .from("profiles")
    .update({ account_type: "company", updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return NextResponse.json({ data });
}
