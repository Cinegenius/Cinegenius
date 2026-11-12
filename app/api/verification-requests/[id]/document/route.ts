import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { verificationDocument } from "@/lib/verification";
import { protectedMediaKey, PROTECTED_MEDIA_BUCKET } from "@/lib/protected-media";
import sharp from "sharp";

const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" };
/** Identity documents never use a public image proxy, an arbitrary URL fetch or shared optimizer. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const t = await getTranslations("VerificationReview");
  const fail = (status: number) => NextResponse.json({ error: t("documentUnavailable") }, { status, headers });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404);
  const result = await db.from("verification_requests").select("user_id,notes,review_version").eq("id", id).maybeSingle();
  if (result.error) return fail(503);
  if (!result.data) return fail(404);
  if (String(result.data.review_version) !== request.nextUrl.searchParams.get("version")) return fail(409);
  const reference = verificationDocument(result.data.notes);
  const key = reference && protectedMediaKey(reference);
  if (!key || key.split("/").at(-2) !== result.data.user_id) return fail(404);
  const asset = await db.from("media_assets").select("owner_user_id,source_type,reference_url").eq("storage_path", key).maybeSingle();
  if (asset.error) return fail(503);
  if (!asset.data || asset.data.owner_user_id !== result.data.user_id || asset.data.source_type || asset.data.reference_url !== reference) return fail(404);
  try {
    const download = await db.storage.from(PROTECTED_MEDIA_BUCKET).download(key);
    if (download.error || !download.data || download.data.size > 15 * 1024 * 1024) return fail(404);
    const image = await sharp(new Uint8Array(await download.data.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return new NextResponse(new Uint8Array(image), { headers: { ...headers, "Content-Type": "image/webp", "Content-Disposition": "inline; filename=verification.webp" } });
  } catch { return fail(503); }
}
