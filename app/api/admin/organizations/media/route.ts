import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROTECTED_MEDIA_BUCKET, protectedMediaKey, protectedMediaUrl } from "@/lib/protected-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const reference = request.nextUrl.searchParams.get("reference")?.trim() ?? "";
  const key = protectedMediaKey(reference);
  if (!key || protectedMediaUrl(key) !== reference) return new NextResponse(null, { status: 404, headers });

  const { data: asset, error } = await db
    .from("media_assets")
    .select("storage_path,mime_type,source_type")
    .eq("storage_path", key)
    .eq("reference_url", reference)
    .in("source_type", ["organization", "organization_entry"])
    .maybeSingle();
  if (error || !asset) return new NextResponse(null, { status: 404, headers });

  const { data: file, error: downloadError } = await db.storage.from(PROTECTED_MEDIA_BUCKET).download(asset.storage_path);
  if (downloadError || !file) return new NextResponse(null, { status: 404, headers });
  return new NextResponse(new Uint8Array(await file.arrayBuffer()), { headers: { ...headers, "Content-Type": asset.mime_type } });
}
