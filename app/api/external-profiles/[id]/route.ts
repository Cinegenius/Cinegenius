import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/external-profiles/[id] — update (owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Only update fields that were actually provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.platform_type !== undefined) patch.platform_type = body.platform_type;
  if (body.platform_name !== undefined) patch.platform_name = body.platform_name?.trim() || null;
  if (body.url !== undefined) {
    const normUrl = body.url.trim().startsWith("http") ? body.url.trim() : `https://${body.url.trim()}`;
    patch.url = normUrl;
  }
  if (body.custom_label !== undefined) patch.custom_label = body.custom_label?.trim() || null;
  if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
  if (body.is_public !== undefined) patch.is_public = body.is_public;

  const { data, error } = await supabaseAdmin
    .from("external_profiles")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId) // ownership check
    .select("id, platform_type, platform_name, url, custom_label, sort_order, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json({ profile: data });
}

// DELETE /api/external-profiles/[id] — delete (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("external_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId); // ownership check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
