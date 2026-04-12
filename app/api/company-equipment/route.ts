import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
const admin = supabaseAdmin;
import { NextRequest, NextResponse } from "next/server";

async function verifyOwner(companyId: string, userId: string) {
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_user_id", userId)
    .single();
  return !!data;
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  const category  = req.nextUrl.searchParams.get("category");
  if (!companyId) return NextResponse.json({ error: "company_id fehlt" }, { status: 400 });

  let query = admin
    .from("company_equipment")
    .select("*")
    .eq("company_id", companyId)
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (category && category !== "alle") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { company_id, category, name } = body;

  if (!company_id || !category || !name?.trim())
    return NextResponse.json({ error: "company_id, category und name sind Pflicht" }, { status: 400 });

  if (!(await verifyOwner(company_id, userId)))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { data, error } = await admin
    .from("company_equipment")
    .insert({
      company_id,
      category,
      subcategory:         body.subcategory?.trim()    || null,
      name:                name.trim(),
      brand:               body.brand?.trim()          || null,
      model:               body.model?.trim()          || null,
      description:         body.description?.trim()    || null,
      images:              body.images               ?? [],
      condition:           body.condition            ?? "gut",
      available:           body.available            ?? true,
      price_day:           body.price_day            ?? null,
      price_week:          body.price_week           ?? null,
      price_on_request:    body.price_on_request     ?? true,
      currency:            "EUR",
      pickup_available:    body.pickup_available     ?? false,
      delivery_available:  body.delivery_available   ?? false,
      delivery_radius_km:  body.delivery_radius_km   ?? null,
      shipping_available:  body.shipping_available   ?? false,
      insured:             body.insured              ?? false,
      deposit_required:    body.deposit_required     ?? false,
      deposit_amount:      body.deposit_amount       ?? null,
      quantity:            body.quantity             ?? 1,
      published:           true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: eq } = await admin.from("company_equipment").select("company_id").eq("id", id).single();
  if (!eq || !(await verifyOwner(eq.company_id, userId)))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { data, error } = await admin.from("company_equipment").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: eq } = await admin.from("company_equipment").select("company_id").eq("id", id).single();
  if (!eq || !(await verifyOwner(eq.company_id, userId)))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { error } = await admin.from("company_equipment").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
