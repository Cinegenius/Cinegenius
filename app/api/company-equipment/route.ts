import { attemptedApproval } from "@/lib/offer-moderation";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { hasCompanyCapability } from "@/lib/company-access";
import { canPersistCompanyImages } from "@/lib/company-media";
import { NextRequest, NextResponse } from "next/server";

const admin = db;

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  const category  = req.nextUrl.searchParams.get("category");
  if (!companyId) return NextResponse.json({ error: "company_id fehlt" }, { status: 400 });
  const caller = await getCurrentUser();
  if (!caller || !(await hasCompanyCapability(companyId, caller.userId, "read"))) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });

  let query = admin
    .from("company_equipment")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (category && category !== "alle") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  if (attemptedApproval(body)) return NextResponse.json({ error: (await getTranslations("OfferModeration"))("adminOnly") }, { status: 403 });
  const { company_id, category, name } = body;

  if (!company_id || !category || !name?.trim())
    return NextResponse.json({ error: "company_id, category und name sind Pflicht" }, { status: 400 });

  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const initialImages = body.images ?? [];
  if (!canPersistCompanyImages(initialImages, [], userId, storageUrl)) return NextResponse.json({ error: "Die Bilder müssen aus eigenen CineGenius-Uploads stammen (maximal 12 Fotos)." }, { status: 400 });

  if (!(await hasCompanyCapability(company_id, userId, "edit_offers")))
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
      images:              initialImages,
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
      published:           false,
      moderation_status:   body.draft === true ? "draft" : "pending",
      last_editor_id:     userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => ({}));
  if (attemptedApproval(body)) return NextResponse.json({ error: (await getTranslations("OfferModeration"))("adminOnly") }, { status: 403 });
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: eq } = await admin.from("company_equipment").select("company_id, images").eq("id", id).single();
  if (!eq || !(await hasCompanyCapability(eq.company_id, userId, "edit_offers")))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const fields: Record<string, unknown> = {};
  const stringFields = ["category", "subcategory", "name", "brand", "model", "description", "condition", "currency"] as const;
  for (const key of stringFields) {
    if (typeof body[key] === "string") fields[key] = key === "name" ? body[key].trim() : body[key].trim() || null;
  }
  for (const key of ["available", "price_on_request", "pickup_available", "delivery_available", "shipping_available", "insured", "deposit_required"] as const) {
    if (typeof body[key] === "boolean") fields[key] = body[key];
  }
  for (const key of ["price_day", "price_week", "delivery_radius_km", "deposit_amount", "quantity"] as const) {
    if (body[key] === null || (typeof body[key] === "number" && Number.isFinite(body[key]))) fields[key] = body[key];
  }
  if (Array.isArray(body.images) && body.images.every((image: unknown) => typeof image === "string")) fields.images = body.images;
  if (!Object.keys(fields).length) return NextResponse.json({ error: "Keine gültigen Änderungen angegeben" }, { status: 400 });
  if ("name" in fields && !(fields.name as string)) return NextResponse.json({ error: "Der Name darf nicht leer sein." }, { status: 400 });
  if ("images" in fields && !canPersistCompanyImages(fields.images, eq.images, userId, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    return NextResponse.json({ error: "Die Bilder müssen bereits gespeichert oder eigene CineGenius-Uploads sein (maximal 12 Fotos)." }, { status: 400 });
  }

  const { data, error } = await admin.from("company_equipment").update({ ...fields, last_editor_id: userId }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: eq } = await admin.from("company_equipment").select("company_id").eq("id", id).single();
  if (!eq || !(await hasCompanyCapability(eq.company_id, userId, "edit_offers")))
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { error } = await admin.from("company_equipment").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
