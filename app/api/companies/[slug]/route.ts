import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/companies/[slug] — fetch single company + its listings
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
  if (error || !company) return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });

  // If preview mode, verify ownership
  if (preview) {
    const { userId } = await auth();
    if (!userId || userId !== company.owner_user_id) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
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
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { slug } = await params;

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .eq("owner_user_id", userId)
    .single();

  if (!company) return NextResponse.json({ error: "Firma nicht gefunden oder keine Berechtigung" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("companies")
    .delete()
    .eq("id", company.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
