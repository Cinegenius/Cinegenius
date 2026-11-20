import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEditorialAgent, editorialHeaders } from "@/lib/editorial-agent-server";

export async function GET(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const { data, error } = await db.from("organization_editorial_grants").select("organization_id,organization:organizations!inner(id,name,slug,moderation_status)").eq("enabled", true).eq("organization.moderation_status", "approved");
  return error ? NextResponse.json({ error: "editorial_unavailable" }, { status: 503, headers: editorialHeaders }) : NextResponse.json({ newsroom: "CineGenius Redaktion", organizations: data ?? [] }, { headers: editorialHeaders });
}
