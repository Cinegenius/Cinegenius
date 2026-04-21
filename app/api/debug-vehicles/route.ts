import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

// SECURITY: admin-only debug endpoint
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { data, error } = await db
    .from("listings")
    .select("id, title, type, category, published, price, city, metadata, created_at")
    .eq("type", "vehicle")
    .order("created_at", { ascending: false });

  return NextResponse.json({ data, error, count: data?.length ?? 0 });
}
