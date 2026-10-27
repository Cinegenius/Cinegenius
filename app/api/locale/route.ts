import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

import { isAppLocale } from "@/lib/i18n/locales";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`locale:${ip}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const locale = body?.locale;
  if (!isAppLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("cg_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
