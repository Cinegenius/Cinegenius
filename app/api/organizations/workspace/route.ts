import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { organizationWorkspace } from "@/lib/organization-data";

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
  return NextResponse.json({ workspace: await organizationWorkspace(session.userId, new URL(request.url).searchParams.get("summary") !== "1") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "load" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
