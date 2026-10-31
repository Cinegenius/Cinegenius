import { clerkClient } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { adminAccountRow } from "@/lib/admin-account-status";
import { loadAccountContent } from "@/lib/admin-account-content";

const PAGE_SIZE = 50;
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const t = await getTranslations("AdminAccounts");
  const rawPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 160);
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const clerk = await clerkClient();
    const { data: users, totalCount } = await clerk.users.getUserList({
      limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, orderBy: "-created_at",
      ...(search.startsWith("user_") ? { userId: [search] } : search ? { query: search } : {}),
    });
    const ids = users.map(user => user.id);
    const [{ data: profiles, error }, { data: settings, error: settingsError }, content] = await Promise.all([
      ids.length ?
      db.from("profiles").select("user_id, display_name, slug, avatar_url, location, positions, role, profile_type, profile_types").in("user_id", ids)
      : Promise.resolve({ data: [], error: null }),
      ids.length ? db.from("user_settings").select("user_id, profile_visibility").in("user_id", ids)
        : Promise.resolve({ data: [], error: null }),
      loadAccountContent(users),
    ]);
    if (error || settingsError) return NextResponse.json({ error: t("loadError") }, { status: 503, headers });
    const profileMap = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
    const visibilityMap = new Map((settings ?? []).map(setting => [setting.user_id, setting.profile_visibility]));
    return NextResponse.json({
      accounts: users.map(user => ({ ...adminAccountRow(user, profileMap.get(user.id) ?? null, visibilityMap.get(user.id) ?? null), content: content.get(user.id)! })),
      total: totalCount, page, pageSize: PAGE_SIZE,
    }, { headers });
  } catch {
    // Never log Clerk user objects, addresses or credentials.
    return NextResponse.json({ error: t("loadError") }, { status: 503, headers });
  }
}
