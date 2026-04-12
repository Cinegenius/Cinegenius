import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { type, title, description, price, city, category, image_url, company_id } = body;

  if (!type || !title || !city) {
    return NextResponse.json({ error: "Pflichtfelder fehlen (type, title, city)" }, { status: 400 });
  }

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
      price: price ?? 0,
      city,
      image_url: image_url ?? null,
      company_id: company_id ?? null,
      published: true,
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
