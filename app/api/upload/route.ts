import { db } from "@/lib/db";
import { requireAuth } from "@/lib/guards";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 1. Auth
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // 2. Parse form data
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  }

  // 3. Validate — magic bytes, size, allowed types.
  //    Returns { buffer, mime, ext } or { error, status }.
  //    The buffer is used below to avoid reading the file twice.
  const validation = await validateUpload(file);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const { buffer, mime, ext } = validation;

  // 4. Build a user-scoped, UUID-based path.
  //    Format: {userId}/{uuid}.{ext}
  //    - User-scoped: prevents cross-user overwrite
  //    - UUID: prevents collision and enumeration
  //    - Extension from magic bytes: not from client filename or Content-Type
  const path = buildStoragePath(userId, ext);

  // 5. Upload to Supabase Storage.
  //    upsert: false — never overwrite an existing file at the same path.
  //    (UUID makes collision effectively impossible, but we enforce it anyway.)
  const { error: uploadError } = await db.storage
    .from("listing-images")
    .upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload]", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = db.storage
    .from("listing-images")
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
