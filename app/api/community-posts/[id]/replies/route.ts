import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const { id } = await context.params;
  const { userId } = await auth();
  const { data: post } = await db.from("community_posts")
    .select("id")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!post) return NextResponse.json({ replies: [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });

  const { data, error } = await db
    .from("community_replies")
    .select("id,post_id,author_id,body,created_at")
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: tResponse('System.m_43e5618b2a88') }, { status: 500 });
  if (!data?.length) return NextResponse.json({ replies: [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });

  const authorIds = [...new Set(data.map((reply) => reply.author_id))];
  const { data: profiles } = await db.from("profiles").select("user_id,display_name,avatar_url").in("user_id", authorIds);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  return NextResponse.json({
    replies: data.map((reply) => {
      const profile = profileById.get(reply.author_id);
      return {
        id: reply.id,
        post_id: reply.post_id,
        body: reply.body,
        created_at: reply.created_at,
        author_name: profile?.display_name ?? "Mitglied",
        author_avatar: profile?.avatar_url ?? null,
        is_mine: Boolean(userId && reply.author_id === userId),
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { allowed } = await rateLimit(`community-reply:${userId}`, 20, 3600);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_ab92a3e2220c') }, { status: 429 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: tResponse('System.m_aab1a65082f7') }, { status: 400 });
  }
  const body = payload && typeof payload === "object" && "body" in payload && typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body || body.length > 1000) return NextResponse.json({ error: tResponse('System.m_89721873a772') }, { status: 400 });

  const { id } = await context.params;
  const { data: post } = await db.from("community_posts").select("id").eq("id", id).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!post) return NextResponse.json({ error: tResponse('System.m_b50fa7ea9061') }, { status: 404 });

  const { data, error } = await db
    .from("community_replies")
    .insert({ post_id: id, author_id: userId, body })
    .select("id,post_id,body,created_at")
    .single();
  if (error || !data) return NextResponse.json({ error: tResponse('System.m_f52de6983c27') }, { status: 500 });

  const { data: profile } = await db.from("profiles").select("display_name,avatar_url").eq("user_id", userId).maybeSingle();
  return NextResponse.json({
    reply: { ...data, author_name: profile?.display_name ?? "Mitglied", author_avatar: profile?.avatar_url ?? null, is_mine: true },
  }, { status: 201, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
