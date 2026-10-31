import { clerkClient } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { ACCOUNT_RESPONSIBLE_PERSON_KEY, responsibleAccountName } from "@/lib/responsible-person";
import { rateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { accountResponsiblePerson } from "@/lib/responsible-person-server";
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  try { return NextResponse.json({ person: await accountResponsiblePerson(auth.userId), userId: auth.userId }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ person: null }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}

/** Private account identity only. This cannot publish a profile, change another
 * account, alter old offers or grant a company role. */
export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const headers = { "Cache-Control": "private, no-store" };
  const t = await getTranslations("responsiblePerson");
  const body = await request.json().catch(() => null);
  if (body?.userId !== auth.userId)
    return NextResponse.json({ error: t("unauthorized") }, { status: 403, headers });
  const name = responsibleAccountName(body);
  if (!name) return NextResponse.json({ error: t("required") }, { status: 400, headers });
  if (!(await rateLimit(`responsible-name:${auth.userId}`, 30, 60)).allowed)
    return NextResponse.json({ error: t("accountSaveError") }, { status: 429, headers });
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(auth.userId, { privateMetadata: { [ACCOUNT_RESPONSIBLE_PERSON_KEY]: name } });
    return NextResponse.json({ saved: true, person: name }, { headers });
  } catch {
    return NextResponse.json({ error: t("accountSaveError") }, { status: 503, headers });
  }
}
