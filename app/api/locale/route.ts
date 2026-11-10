import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

import { auth, clerkClient } from "@clerk/nextjs/server";

import { isAppLocale } from "@/lib/i18n/locales";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`locale:${ip}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_666d5c1a7c66') }, { status: 429 });

  const body = await req.json().catch(() => null);
  const locale = body?.locale;
  if (!isAppLocale(locale)) {
    return NextResponse.json({ error: tResponse('System.m_077dc81b1725') }, { status: 400 });
  }

  // Persist the explicit preference for transactional mail on other devices.
  // Cookie-based switching remains available if the account service is busy.
  try {
    const { userId } = await auth();
    if (userId) {
      const client = await clerkClient();
      await client.users.updateUser(userId, { locale });
    }
  } catch {
    console.error("[locale] account language could not be synchronized");
  }

  const res = NextResponse.json({ ok: true });
  if (body?.persistOnly !== true) res.cookies.set("cg_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
