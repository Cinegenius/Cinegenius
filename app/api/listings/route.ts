import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const mine = req.nextUrl.searchParams.get("mine") === "true";

  if (mine) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[listings GET mine]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  let query = supabaseAdmin
    .from("listings")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) {
    console.error("[listings GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await req.json();
  const { type, title, description, price, city, category, image_url, company_id,
          metadata, blocked_dates, floor_plan_url, extra_images, rental_type } = body;

  if (!type || !title || !city) {
    return NextResponse.json({ error: "Pflichtfelder fehlen (type, title, city)" }, { status: 400 });
  }

  // SECURITY: input length limits and price sanitization
  if (title.length > 200) return NextResponse.json({ error: "Titel zu lang (max. 200 Zeichen)" }, { status: 400 });
  if (city.length > 100) return NextResponse.json({ error: "Stadt zu lang (max. 100 Zeichen)" }, { status: 400 });
  if (description && description.length > 5000) return NextResponse.json({ error: "Beschreibung zu lang (max. 5000 Zeichen)" }, { status: 400 });
  const safePrice = Math.max(0, Math.min(Number(price) || 0, 1_000_000));

  // If company_id is provided, verify the current user owns that company
  if (company_id) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .eq("owner_user_id", userId)
      .single();
    if (!company) {
      return NextResponse.json({ error: "Firma nicht gefunden oder keine Berechtigung" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .insert({
      user_id: userId,
      type,
      category: category ?? null,
      title,
      description: description ?? "",
      price: safePrice,
      city,
      image_url: image_url ?? null,
      company_id: company_id ?? null,
      published: true,
      ...(rental_type !== undefined && { rental_type }),
      ...(metadata !== undefined && { metadata }),
      ...(blocked_dates !== undefined && { blocked_dates }),
      ...(floor_plan_url !== undefined && { floor_plan_url }),
      ...(extra_images !== undefined && { extra_images }),
    })
    .select()
    .single();

  if (error) {
    console.error("[listings POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID fehlt" }, { status: 400 });

  // Only allow deleting own listings
  const { error } = await supabaseAdmin
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[listings DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
