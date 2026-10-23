import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { hasCompanyCapability } from "@/lib/company-access";
import { NextRequest, NextResponse } from "next/server";

const admin = db;

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ error: "company_id fehlt" }, { status: 400 });
  const caller = await getCurrentUser();
  if (!caller || !(await hasCompanyCapability(companyId, caller.userId, "read"))) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });

  const { data, error } = await admin
    .from("company_services")
    .select("*")
    .eq("company_id", companyId)
    .order("order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const { company_id, type, title, description, use_cases, price_on_request, price_note } = body;

  if (!company_id || !type || !title?.trim())
    return NextResponse.json({ error: "company_id, type und title sind Pflicht" }, { status: 400 });

  if (!(await hasCompanyCapability(company_id, userId, "edit_offers")))
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
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: svc } = await admin.from("company_services").select("company_id").eq("id", id).single();
  if (!svc || !(await hasCompanyCapability(svc.company_id, userId, "edit_offers")))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const fields: Record<string, unknown> = {};
  if (typeof body.type === "string") fields.type = body.type;
  if (typeof body.title === "string" && body.title.trim()) fields.title = body.title.trim();
  if (body.description === null || typeof body.description === "string") fields.description = body.description?.trim() || null;
  if (Array.isArray(body.use_cases) && body.use_cases.every((item: unknown) => typeof item === "string")) fields.use_cases = body.use_cases;
  if (typeof body.price_on_request === "boolean") fields.price_on_request = body.price_on_request;
  if (body.price_note === null || typeof body.price_note === "string") fields.price_note = body.price_note?.trim() || null;
  if (Number.isInteger(body.order)) fields.order = body.order;
  if (!Object.keys(fields).length) return NextResponse.json({ error: "Keine gültigen Änderungen angegeben" }, { status: 400 });

  const { data, error } = await admin.from("company_services").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: svc } = await admin.from("company_services").select("company_id").eq("id", id).single();
  if (!svc || !(await hasCompanyCapability(svc.company_id, userId, "edit_offers")))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { error } = await admin.from("company_services").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
