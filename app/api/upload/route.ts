import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Nur JPG, PNG, WEBP oder HEIC erlaubt" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from("listing-images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[upload]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("listing-images")
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
