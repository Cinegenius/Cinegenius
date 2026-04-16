import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("id, title, type, category, published, price, city, metadata, created_at")
    .eq("type", "vehicle")
    .order("created_at", { ascending: false });

  return NextResponse.json({ data, error, count: data?.length ?? 0 });
}
