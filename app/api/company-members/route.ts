import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/company-members?company_id=xxx  → members of a company
// GET /api/company-members?user_id=xxx     → company of a specific user
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  const userId    = req.nextUrl.searchParams.get("user_id");

  if (companyId) {
    const { userId: callerId } = await auth();

    // Check if caller is owner (owners see pending too)
    let isOwner = false;
    if (callerId) {
      const { data: co } = await admin
        .from("companies")
        .select("owner_user_id")
        .eq("id", companyId)
        .single();
      isOwner = co?.owner_user_id === callerId;
    }

    let query = admin
      .from("company_members")
      .select("id, user_id, role, title, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (!isOwner) query = query.eq("status", "accepted");

    const { data: members, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch profiles for all members
    const userIds = (members ?? []).map((m) => m.user_id);
    let profiles: Record<string, { display_name: string; avatar_url: string | null; slug: string | null; role: string | null }> = {};

    if (userIds.length > 0) {
      const { data: pData } = await admin
        .from("profiles")
        .select("user_id, display_name, avatar_url, slug, role")
        .in("user_id", userIds);
      if (pData) {
        for (const p of pData) profiles[p.user_id] = p;
      }
    }

    const result = (members ?? []).map((m) => ({
      ...m,
      profile: profiles[m.user_id] ?? null,
    }));

    return NextResponse.json({ data: result });
  }

  if (userId) {
    const { data, error } = await admin
      .from("company_members")
      .select("id, company_id, role, title, status, companies(id, slug, name, logo_url)")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? null });
  }

  return NextResponse.json({ error: "company_id oder user_id erforderlich" }, { status: 400 });
}

// POST /api/company-members  { company_id, title? }  → user requests to join
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { company_id, title } = await req.json();
  if (!company_id) return NextResponse.json({ error: "company_id fehlt" }, { status: 400 });

  // Check company exists
  const { data: co } = await admin
    .from("companies")
    .select("id, owner_user_id")
    .eq("id", company_id)
    .single();

  if (!co) return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });

  // Owner cannot join their own company as member
  if (co.owner_user_id === userId) {
    return NextResponse.json({ error: "Du bist bereits Inhaber dieser Firma" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("company_members")
    .upsert(
      { company_id, user_id: userId, title: title ?? null, status: "pending", role: "member" },
      { onConflict: "company_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH /api/company-members  { id, status?, title?, role? }  → owner manages member
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id, status, title, role } = await req.json();
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  // Verify caller is owner of the company this member belongs to
  const { data: member } = await admin
    .from("company_members")
    .select("company_id, user_id")
    .eq("id", id)
    .single();

  if (!member) return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });

  const { data: co } = await admin
    .from("companies")
    .select("owner_user_id")
    .eq("id", member.company_id)
    .single();

  // Owner can update any member; member can only update their own title
  const isOwner = co?.owner_user_id === userId;
  const isSelf  = member.user_id === userId;

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (isOwner && status !== undefined) updates.status = status;
  if (isOwner && role !== undefined) updates.role = role;

  const { data, error } = await admin
    .from("company_members")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/company-members?id=xxx  → leave (self) or owner removes member
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: member } = await admin
    .from("company_members")
    .select("company_id, user_id")
    .eq("id", id)
    .single();

  if (!member) return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 });

  const { data: co } = await admin
    .from("companies")
    .select("owner_user_id")
    .eq("id", member.company_id)
    .single();

  const isOwner = co?.owner_user_id === userId;
  const isSelf  = member.user_id === userId;

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { error } = await admin.from("company_members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
