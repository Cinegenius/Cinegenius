import { db } from "@/lib/db";
import { requireAuth } from "@/lib/guards";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 1. Auth
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // 2. Per-user rate limit: 3 avatar uploads per minute
  const { allowed } = await rateLimit(`avatar:${userId}`, 3, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Uploads. Bitte kurz warten." }, { status: 429 });

  // 3. Parse form data
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  }

  // 3. Validate — magic bytes, size, allowed types
  const validation = await validateUpload(file);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const { buffer, mime, ext } = validation;

  // 4. Build user-scoped path.
  //    Format: avatars/{userId}/{uuid}.{ext}
  //
  //    Why UUID instead of the old avatars/{userId}.{ext}:
  //    - The old path used upsert: true and a fixed extension.
  //      Uploading a PNG then a JPG left both files as orphans in storage
  //      because the extension changed (avatars/u.png AND avatars/u.jpg).
  //    - UUID path with upsert: false prevents both overwrite and orphan
  //      accumulation within the same upload session.
  //    - Old avatar files become orphans in storage, but that is acceptable
  //      and can be cleaned up with a periodic storage sweep.
  const path = buildStoragePath(userId, ext, "avatars");

  // 5. Upload — upsert: false, no overwriting
  const { error: uploadError } = await db.storage
    .from("listing-images")
    .upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload/avatar]", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = db.storage
    .from("listing-images")
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
