import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { MESSAGING_HEADERS } from "@/lib/messaging-backend";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

/** Search public profiles only; account IDs and email addresses are not a directory. */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const t = await getTranslations("MessagingBackend");
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const fail = () => NextResponse.json({ error: t("searchError") }, { status: 503, headers: MESSAGING_HEADERS });
  if (query.length < 2 || query.length > 80) return NextResponse.json({ users: [] }, { headers: MESSAGING_HEADERS });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8000)]);
  try {
    const result = await db.from("profiles").select("user_id,display_name,avatar_url,role,location")
      .neq("user_id", authResult.userId).not("display_name", "is", null)
      .ilike("display_name", `%${query.replace(/[\\%_]/g, "\\$&")}%`).order("display_name", { ascending: true }).limit(25).abortSignal(signal);
    if (result.error) return fail();
    const profiles = result.data ?? [];
    if (!profiles.length) return NextResponse.json({ users: [] }, { headers: MESSAGING_HEADERS });
    const settings = await db.from("user_settings").select("user_id,profile_visibility").in("user_id", profiles.map(profile => profile.user_id)).abortSignal(signal);
    if (settings.error) return fail();
    const privateIds = new Set((settings.data ?? []).filter(setting => setting.profile_visibility === "private").map(setting => setting.user_id));
    const publicProfiles = profiles.filter(profile => !privateIds.has(profile.user_id));
    const eligible = await db.rpc("messaging_available_recipients", { p_sender: authResult.userId, p_recipients: publicProfiles.map(profile => profile.user_id) }).abortSignal(signal);
    if (eligible.error || !Array.isArray(eligible.data)) return fail();
    const allowed = new Set(eligible.data.map((item: { user_id: string }) => item.user_id));
    return NextResponse.json({ users: publicProfiles.filter(profile => allowed.has(profile.user_id)).map(profile => ({
      id: profile.user_id, name: profile.display_name ?? t("senderFallback"), avatar: profile.avatar_url ?? null,
      role: profile.role ?? null, location: profile.location ?? null,
    })) }, { headers: MESSAGING_HEADERS });
  } catch { return fail(); }
}
