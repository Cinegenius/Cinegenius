import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { accountResponsiblePerson } from "@/lib/responsible-person-server";
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  try { return NextResponse.json({ person: await accountResponsiblePerson(auth.userId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ person: null }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
