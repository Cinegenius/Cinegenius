import { createClient } from "@supabase/supabase-js";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/recommendations?userId=xxx — alle Empfehlungen für einen Nutzer
export async function GET(req: NextRequest) {
  const recipientId = req.nextUrl.searchParams.get("userId");
  if (!recipientId) return NextResponse.json({ recommendations: [] });

  const { data, error } = await supabaseAdmin
    .from("recommendations")
    .select("id, author_id, content, author_role, project, created_at")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data?.length) return NextResponse.json({ recommendations: [] });

  // Autoren-Profile nachladen
  const authorIds = [...new Set(data.map((r) => r.author_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", authorIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));

  const recommendations = data.map((r) => ({
    id: r.id,
    author_id: r.author_id,
    author_name: profileMap[r.author_id]?.display_name ?? "Unbekannt",
    author_avatar: profileMap[r.author_id]?.avatar_url ?? null,
    author_role: r.author_role,
    project: r.project,
    content: r.content,
    created_at: r.created_at,
  }));

  return NextResponse.json({ recommendations });
}

// POST /api/recommendations — Empfehlung schreiben
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { recipient_id, content, author_role, project } = body;

  if (!recipient_id || !content?.trim() || !author_role?.trim()) {
    return NextResponse.json({ error: "Empfänger, Inhalt und deine Rolle sind Pflichtfelder" }, { status: 400 });
  }

  if (userId === recipient_id) {
    return NextResponse.json({ error: "Du kannst dir nicht selbst eine Empfehlung schreiben" }, { status: 400 });
  }

  // Nur eine Empfehlung pro Person erlaubt
  const { data: existing } = await supabaseAdmin
    .from("recommendations")
    .select("id")
    .eq("author_id", userId)
    .eq("recipient_id", recipient_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Du hast bereits eine Empfehlung für diese Person geschrieben" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("recommendations")
    .insert({
      author_id: userId,
      recipient_id,
      content: content.trim(),
      author_role: author_role.trim(),
      project: project?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // In-App-Benachrichtigung für den Empfänger
  try {
    const { data: authorProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const authorName = authorProfile?.display_name ?? "Jemand";

    await supabaseAdmin.from("notifications").insert({
      user_id: recipient_id,
      type: "friend_accepted", // nutzt success-Farbe
      title: "Neue Empfehlung",
      body: `${authorName} hat dir eine Empfehlung geschrieben.`,
      href: `/creators/${recipient_id}`,
    });
  } catch { /* fire-and-forget */ }

  return NextResponse.json({ id: data.id });
}

// DELETE /api/recommendations?id=xxx — eigene Empfehlung löschen
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID fehlt" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("recommendations")
    .delete()
    .eq("id", id)
    .eq("author_id", userId); // nur eigene

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
