import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

  let query = supabaseAdmin
    .from("companies")
    .select("*")
    .eq("slug", slug);

  if (!preview) query = query.eq("published", true);

  const { data: company, error } = await query.single();
  if (error || !company) {
    return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });
  }

  // Preview mode requires ownership — fetch auth and verify server-side
  if (preview) {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const ownershipError = assertOwner(company.owner_user_id, userId);
    if (ownershipError) return ownershipError;
  }

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("id, title, type, category, price, city, image_url, created_at")
    .eq("company_id", company.id)
    .eq("published", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ company, listings: listings ?? [] });
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
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, owner_user_id")
    .eq("slug", slug)
    .maybeSingle();

  const ownershipError = assertOwner(company?.owner_user_id, userId);
  if (ownershipError) return ownershipError;

  const { error } = await supabaseAdmin
    .from("companies")
    .delete()
    .eq("id", company!.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
