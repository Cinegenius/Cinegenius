import { db } from "@/lib/db";
import { requireAuth } from "@/lib/guards";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_MIME_TYPES } from "@/lib/profile-media";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`profile-media:${userId}`, 10, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Uploads. Bitte kurz warten." }, { status: 429 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Upload-Anfrage" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const validation = await validateUpload(file, {
    maxBytes: PROFILE_MEDIA_MAX_BYTES,
    allowedMimeTypes: PROFILE_MEDIA_MIME_TYPES,
    tooLargeMessage: "Das Bild ist nach der Komprimierung größer als 4 MB.",
    unsupportedTypeMessage: "Ungültiges Dateiformat. Unterstützt werden JPG, PNG und WEBP.",
  });
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const path = buildStoragePath(userId, validation.ext, "profile-media");
  const { error: uploadError } = await db.storage
    .from("listing-images")
    .upload(path, validation.buffer, { contentType: validation.mime, upsert: false });
  if (uploadError) {
    console.error("[upload/profile-media]", uploadError);
    return NextResponse.json({ error: "Profilbild konnte nicht gespeichert werden" }, { status: 500 });
  }

  const { data } = db.storage.from("listing-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { headers: { "Cache-Control": "private, no-store" } });
}
