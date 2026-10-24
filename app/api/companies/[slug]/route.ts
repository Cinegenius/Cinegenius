import { db } from "@/lib/db";
import { requireAuth, assertOwner } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";

// GET /api/companies/[slug] — fetch company + its published listings
// ?preview=true allows the owner to view their unpublished company
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const preview = req.nextUrl.searchParams.get("preview") === "true";

  // Preview must authenticate before reading any private company fields.
  let previewUserId: string | null = null;
  if (preview) {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    previewUserId = authResult.userId;
  }

  const safeFields = "id, owner_user_id, slug, name, logo_url, cover_url, description, city, website, email_public, phone_public, hq_address_public, categories, services, portfolio_images, tagline, bio_short, usp, founded_year, legal_form, countries, industry_focus, social_links, catering_details, published, verified, created_at";
  let query = db.from("companies")
    .select(safeFields)
    .eq("slug", slug);

  if (!preview) query = query.eq("published", true);

  const { data: company, error } = await query.single();
  if (error || !company) {
    return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });
  }

  // Preview mode requires ownership before any private columns are selected.
  if (preview) {
    const ownershipError = assertOwner(company.owner_user_id, previewUserId!);
    if (ownershipError) return ownershipError;
  }

  const safeCompany = { ...company };
  delete safeCompany.owner_user_id;
  let visibleCompany: Record<string, unknown> = safeCompany;
  if (preview) {
    const { data: privateCompany, error: privateError } = await db.from("companies")
      .select("email, phone, hq_address")
      .eq("id", company.id)
      .single();
    if (privateError || !privateCompany) return NextResponse.json({ error: "Firmendaten konnten nicht geladen werden" }, { status: 500 });
    visibleCompany = { ...safeCompany, ...privateCompany };
  } else {
    const publicContactColumns = [
      ...(company.email_public === true ? ["email"] : []),
      ...(company.phone_public === true ? ["phone"] : []),
      ...(company.hq_address_public === true ? ["hq_address"] : []),
    ];
    if (publicContactColumns.length > 0) {
      const { data: publicContacts } = await db.from("companies")
        .select(publicContactColumns.join(", "))
        .eq("id", company.id)
        .maybeSingle();
      visibleCompany = { ...safeCompany, ...((publicContacts ?? {}) as Record<string, unknown>) };
    }
  }

  const { data: listings } = await db
    .from("listings")
    .select("id, title, type, category, price, city, image_url, created_at")
    .eq("company_id", company.id)
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (!preview) {
    visibleCompany = {
      ...visibleCompany,
      email: company.email_public === true ? (visibleCompany.email as string | null | undefined) ?? null : null,
      phone: company.phone_public === true ? (visibleCompany.phone as string | null | undefined) ?? null : null,
      hq_address: company.hq_address_public === true ? (visibleCompany.hq_address as string | null | undefined) ?? null : null,
    };
  }

  return NextResponse.json({ company: visibleCompany, listings: listings ?? [] }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

// DELETE /api/companies/[slug] — delete own company
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { slug } = await params;

  // Fetch company to verify existence and ownership
  const { data: company } = await db
    .from("companies")
    .select("id, owner_user_id")
    .eq("slug", slug)
    .maybeSingle();

  const ownershipError = assertOwner(company?.owner_user_id, userId);
  if (ownershipError) return ownershipError;

  const { error } = await db
    .from("companies")
    .delete()
    .eq("id", company!.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
