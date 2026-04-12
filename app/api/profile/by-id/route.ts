import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, avatar_url, slug")
    .eq("user_id", id)
    .maybeSingle();

  return NextResponse.json({ profile: data ?? null });
}
