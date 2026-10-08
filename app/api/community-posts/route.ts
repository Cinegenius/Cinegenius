import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

const POST_KINDS = ["question", "recommendation", "request", "offer"] as const;
type PostKind = (typeof POST_KINDS)[number];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawLimit = Number.parseInt(params.get("limit") ?? "3", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 3;
  const rawKind = params.get("kind");
  const queryText = (params.get("q") ?? "").trim().slice(0, 80);
  const now = new Date().toISOString();

  // Remove expired posts (and their replies) as people open the board.
  await db.from("community_posts").delete().lte("expires_at", now);

  let query = db
    .from("community_posts")
    .select("id,author_id,kind,title,body,city,created_at,expires_at")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rawKind && POST_KINDS.includes(rawKind as PostKind)) query = query.eq("kind", rawKind);
  if (queryText) {
    const safeQuery = queryText.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
    if (safeQuery) query = query.or(`title.ilike.%${safeQuery}%,body.ilike.%${safeQuery}%,city.ilike.%${safeQuery}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Aushänge konnten nicht geladen werden." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ posts: [] });

  const authorIds = [...new Set(data.map((post) => post.author_id))];
  const postIds = data.map((post) => post.id);
  const [{ data: profiles }, { data: replies }] = await Promise.all([
    db.from("profiles").select("user_id,display_name,avatar_url").in("user_id", authorIds),
    db.from("community_replies").select("post_id").in("post_id", postIds),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const replyCounts = new Map<string, number>();
  for (const reply of replies ?? []) replyCounts.set(reply.post_id, (replyCounts.get(reply.post_id) ?? 0) + 1);

  return NextResponse.json({
    posts: data.map((post) => {
      const profile = profileById.get(post.author_id);
      return {
        ...post,
        author_name: profile?.display_name ?? "Mitglied",
        author_avatar: profile?.avatar_url ?? null,
        reply_count: replyCounts.get(post.id) ?? 0,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { allowed } = await rateLimit(`community-post:${userId}`, 5, 3600);
  if (!allowed) return NextResponse.json({ error: "Zu viele Aushänge. Bitte versuche es später erneut." }, { status: 429 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const input = payload as Record<string, unknown>;
  const kind = input.kind;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  if (typeof kind !== "string" || !POST_KINDS.includes(kind as PostKind)) {
    return NextResponse.json({ error: "Bitte wähle eine gültige Art des Aushangs." }, { status: 400 });
  }
  if (title.length < 5 || title.length > 140 || body.length < 10 || body.length > 3000 || city.length > 100) {
    return NextResponse.json({ error: "Bitte prüfe Titel, Text und Ort. Titel: 5–140 Zeichen, Text: 10–3000 Zeichen." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("community_posts")
    .insert({ author_id: userId, kind, title, body, city: city || null, expires_at: expiresAt })
    .select("id,author_id,kind,title,body,city,created_at,expires_at")
    .single();
  if (error || !data) return NextResponse.json({ error: "Aushang konnte nicht gespeichert werden." }, { status: 500 });

  const { data: profile } = await db.from("profiles").select("display_name,avatar_url").eq("user_id", userId).maybeSingle();
  return NextResponse.json({
    post: { ...data, author_name: profile?.display_name ?? "Mitglied", author_avatar: profile?.avatar_url ?? null, reply_count: 0 },
  }, { status: 201 });
}
