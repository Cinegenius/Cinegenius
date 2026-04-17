import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  // SECURITY: admin-only debug endpoint
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("id, title, type, category, published, price, city, metadata, created_at")
    .eq("type", "vehicle")
    .order("created_at", { ascending: false });

  return NextResponse.json({ data, error, count: data?.length ?? 0 });
}
