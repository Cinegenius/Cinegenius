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
  if (!companyId) return NextResponse.json({ error: "company_id fehlt" }, { status: 400 });

  const { data, error } = await admin
    .from("company_services")
    .select("*")
    .eq("company_id", companyId)
    .order("order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { company_id, type, title, description, use_cases, price_on_request, price_note } = body;

  if (!company_id || !type || !title?.trim())
    return NextResponse.json({ error: "company_id, type und title sind Pflicht" }, { status: 400 });

  if (!(await verifyOwner(company_id, userId)))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { data, error } = await admin
    .from("company_services")
    .insert({
      company_id,
      type,
      title: title.trim(),
      description: description?.trim() || null,
      use_cases: use_cases ?? [],
      price_on_request: price_on_request ?? true,
      price_note: price_note?.trim() || null,
      order: 0,
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

  const { data: svc } = await admin.from("company_services").select("company_id").eq("id", id).single();
  if (!svc || !(await verifyOwner(svc.company_id, userId)))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { data, error } = await admin.from("company_services").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: svc } = await admin.from("company_services").select("company_id").eq("id", id).single();
  if (!svc || !(await verifyOwner(svc.company_id, userId)))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { error } = await admin.from("company_services").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
