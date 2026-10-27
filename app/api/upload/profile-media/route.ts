import { getTranslations } from "next-intl/server";
import { storeProtectedMedia } from "@/lib/protected-media-server";
import { requireAuth } from "@/lib/guards";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_MIME_TYPES } from "@/lib/profile-media";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getTranslations("mediaSecurity");

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
    emptyMessage: t("empty"),
    allowedMimeTypes: PROFILE_MEDIA_MIME_TYPES,
    tooLargeMessage: t("tooLarge"),
    unsupportedTypeMessage: t("invalid"),
  });
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const path = buildStoragePath(userId, validation.ext, "profile-media");
  try {
    const url = await storeProtectedMedia(userId, path, validation.buffer, validation.mime);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[upload] private file persistence failed");
    return NextResponse.json({ error: t("saveFailed") }, { status: 500 });
  }
}
