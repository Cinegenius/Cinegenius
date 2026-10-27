import { getTranslations } from "next-intl/server";
import { storeProtectedMedia, removeUnusedProtectedMedia } from "@/lib/protected-media-server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateUpload, buildStoragePath } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_MIME_TYPES } from "@/lib/profile-media";
import { persistAvatarAssociation } from "@/lib/profile-avatar-persistence";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

/** Upload and associate an avatar in one authenticated operation. */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getTranslations("mediaSecurity");

  const limit = await rateLimit(`profile-avatar:${userId}`, 10, 60);
  if (!limit.allowed) return json({ error: "Zu viele Profilfoto-Uploads. Bitte kurz warten." }, 429);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Die Upload-Anfrage konnte nicht gelesen werden. Bitte versuche es erneut." }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return json({ error: "Bitte wähle zuerst ein Profilfoto aus." }, 400);
  const uploadId = formData.get("uploadId");
  if (typeof uploadId !== "string" || !/^[a-f0-9]{32}$/i.test(uploadId)) {
    return json({ error: "Der Upload konnte nicht eindeutig zugeordnet werden. Bitte versuche es erneut." }, 400);
  }

  const validation = await validateUpload(file, {
    maxBytes: PROFILE_MEDIA_MAX_BYTES,
    emptyMessage: t("empty"),
    allowedMimeTypes: PROFILE_MEDIA_MIME_TYPES,
    tooLargeMessage: t("tooLarge"),
    unsupportedTypeMessage: t("invalid"),
  });
  if ("error" in validation) return json({ error: validation.error }, validation.status);

  const { data: current, error: currentError } = await db
    .from("profiles")
    .select("user_id, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (currentError) {
    console.error("[profile avatar] current profile lookup failed:", currentError.message);
    return json({ error: "Dein Profil konnte nicht geprüft werden. Das bisherige Foto bleibt erhalten." }, 500);
  }
  if (!current) return json({ error: "Speichere zuerst die Grunddaten deines Profils. Danach wird das Foto sofort übernommen." }, 409);

  const path = buildStoragePath(userId, validation.ext, "profile-media/avatars", uploadId);
  let savedUrl: string;
  try {
    savedUrl = await storeProtectedMedia(userId, path, validation.buffer, validation.mime);
  } catch {
    console.error("[profile avatar] private upload failed");
    return json({ error: "Das Profilfoto konnte nicht hochgeladen werden. Dein bisheriges Foto bleibt erhalten." }, 500);
  }

  const outcome = await persistAvatarAssociation({
    url: savedUrl,
    path,
    update: async () => {
      let update = db.from("profiles").update({ avatar_url: savedUrl, updated_at: new Date().toISOString() }).eq("user_id", userId);
      update = current.avatar_url == null ? update.is("avatar_url", null) : update.eq("avatar_url", current.avatar_url);
      const { data, error } = await update.select("user_id, avatar_url").maybeSingle();
      if (error) console.error("[profile avatar] association failed:", error.message);
      return { updated: !!data, error };
    },
    readCurrentUrl: async () => {
      const { data, error } = await db.from("profiles").select("avatar_url").eq("user_id", userId).maybeSingle();
      return { ok: !error, url: data?.avatar_url ?? null };
    },
    removeUnusedAsset: (unusedPath) => removeUnusedProtectedMedia(userId, unusedPath),
  });

  if (outcome.status !== "saved") {
    if (outcome.status === "conflict") {
      return json({ error: "Dein Profilfoto wurde in einem anderen Fenster geändert. Lade die Seite neu und versuche es erneut." }, 409);
    }
    return json({ error: "Das Foto wurde hochgeladen, aber die Profilzuordnung konnte nicht bestätigt werden. Dein bisheriges Foto bleibt erhalten." }, 500);
  }

  revalidateTag("profiles", { expire: 0 });
  revalidateTag("creator-directory", { expire: 0 });
  return json({ url: savedUrl, saved: true });
}
