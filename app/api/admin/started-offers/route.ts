import { clerkClient } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { loadStartedOffers } from "@/lib/admin-started-offers-server";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const t = await getTranslations("AdminStartedOffers");
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  const offsetValue = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const offset = Number.isSafeInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0;
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 160);
  const kind = request.nextUrl.searchParams.get("kind") ?? "all";
  try {
    const clerk = await clerkClient();
    let next = offset;
    let hasMore = false;
    const offers = [];
    // At most 100 accounts per request; skip empty batches without scanning the entire account store.
    for (let batch = 0; batch < 4; batch++) {
      const { data: users, totalCount } = await clerk.users.getUserList({
        limit: 25, offset: next, orderBy: "-created_at",
        ...(search.startsWith("user_") ? { userId: [search] } : search ? { query: search } : {}),
      });
      const summaries = await loadStartedOffers(users);
      const names = new Map(users.map(user => [user.id, [user.firstName, user.lastName].filter(Boolean).join(" ").trim()]));
      offers.push(...summaries.filter(offer => kind === "all" || offer.kind === kind)
        .map(offer => ({ ...offer, accountName: offer.accountName || names.get(offer.userId) || t("unnamedAccount") })));
      next += users.length;
      hasMore = users.length > 0 && next < totalCount;
      if (offers.length >= 10 || !hasMore) break;
    }
    return NextResponse.json({ offers, nextOffset: hasMore ? next : null, scanned: next - offset }, { headers });
  } catch {
    // No Clerk objects or recovery contents in logs or errors.
    return NextResponse.json({ error: t("loadError") }, { status: 503, headers });
  }
}
