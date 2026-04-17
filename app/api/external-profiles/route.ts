// Required Supabase table:
// CREATE TABLE IF NOT EXISTS external_profiles (
//   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id     text NOT NULL,
//   platform_type   text NOT NULL,
//   platform_name   text,
//   url         text NOT NULL,
//   custom_label    text,
//   sort_order  integer NOT NULL DEFAULT 0,
//   is_public   boolean NOT NULL DEFAULT true,
//   created_at  timestamptz DEFAULT now(),
//   updated_at  timestamptz DEFAULT now()
// );
// CREATE INDEX external_profiles_user_idx ON external_profiles(user_id, sort_order);

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/external-profiles — fetch all entries for current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ profiles: [] });

  const { data, error } = await supabaseAdmin
    .from("external_profiles")
    .select("id, platform_type, platform_name, url, custom_label, sort_order, is_public")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data ?? [] });
}

// POST /api/external-profiles — create a new entry
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { platform_type, platform_name, url, custom_label, sort_order, is_public } = body;

  if (!platform_type || !url?.trim()) {
    return NextResponse.json({ error: "Plattform und URL sind Pflichtfelder" }, { status: 400 });
  }

  // Normalise URL — add https:// if missing scheme
  const normUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;

  const { data, error } = await supabaseAdmin
    .from("external_profiles")
    .insert({
      user_id: userId,
      platform_type,
      platform_name: platform_name?.trim() || null,
      url: normUrl,
      custom_label: custom_label?.trim() || null,
      sort_order: sort_order ?? 0,
      is_public: is_public !== false,
    })
    .select("id, platform_type, platform_name, url, custom_label, sort_order, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
