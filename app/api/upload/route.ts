import { getTranslations } from "next-intl/server";
import { storeProtectedMedia } from "@/lib/protected-media-server";
import { requireAuth } from "@/lib/guards";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 1. Auth
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getTranslations("mediaSecurity");

  // A location may use twenty uploads in one batch. Leave room for retries
  // and replacement uploads while keeping a per-user abuse limit.
  const { allowed } = await rateLimit(`upload:${userId}`, 40, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Uploads. Bitte kurz warten." }, { status: 429 });

  // 3. Parse form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Die Upload-Anfrage war ungültig oder zu groß. Bitte wähle ein kleineres Foto." }, { status: 400 });
  }
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  }

  // 4. Validate — magic bytes, size, allowed types.
  //    Returns { buffer, mime, ext } or { error, status }.
  //    The buffer is used below to avoid reading the file twice.
  const validation = await validateUpload(file, { emptyMessage: t("empty"), tooLargeMessage: t("tooLarge"), unsupportedTypeMessage: t("invalid") });
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const { buffer, mime, ext } = validation;

  // 5. Build a user-scoped, UUID-based path.
  //    Format: {userId}/{uuid}.{ext}
  //    - User-scoped: prevents cross-user overwrite
  //    - UUID: prevents collision and enumeration
  //    - Extension from magic bytes: not from client filename or Content-Type
  const uploadId = formData.get("upload_id");
  if (uploadId !== null && (typeof uploadId !== "string" || !/^[a-f0-9]{32}$/i.test(uploadId))) {
    return NextResponse.json({ error: t("invalid") }, { status: 400 });
  }
  // A retried upload uses the same immutable owner-scoped path. The media
  // journal verifies identical bytes; a different file cannot overwrite it.
  const path = buildStoragePath(userId, ext, undefined, typeof uploadId === "string" ? uploadId : undefined);

  try {
    const url = await storeProtectedMedia(userId, path, buffer, mime);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[upload] private file persistence failed");
    return NextResponse.json({ error: t("saveFailed") }, { status: 500 });
  }
}
