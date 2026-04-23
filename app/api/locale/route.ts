import { NextRequest, NextResponse } from "next/server";

const SUPPORTED = new Set(["de", "en", "es", "cs", "hu", "it"]);

export async function POST(req: NextRequest) {
  const { locale } = await req.json();
  if (!SUPPORTED.has(locale)) {
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
