import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COMMUNITY_ALLOWED_SOURCE_TYPES, isOwnPublicStorageUrl } from "@/lib/community-media";
import { cachedCommunityPreview, readPreviewSource, resizeCommunityPreview } from "@/lib/community-preview-server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  const image = request.nextUrl.searchParams.get("image") ?? "";
  const size = request.nextUrl.searchParams.get("size") ?? "thumbnail";
  if (image.length > 2048 || !isOwnPublicStorageUrl(image, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") || !["thumbnail", "detail"].includes(size)) {
    return NextResponse.json({ error: "Ungültige Bildanfrage." }, { status: 400, headers });
  }
  // Never turn the resizing service into a proxy for private or excluded media.
  const { data, error } = await db.from("public_community_media")
    .select("storage_id,uploaded_at").in("source_type", [...COMMUNITY_ALLOWED_SOURCE_TYPES])
    .eq("image_url", image).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Bildstatus derzeit nicht erreichbar." }, { status: 503, headers });
  if (!data) return NextResponse.json({ error: "Bild nicht öffentlich verfügbar." }, { status: 404, headers });
  try {
    const output = await cachedCommunityPreview(`${data.storage_id}:${data.uploaded_at}:${image}:${size}`, async () => {
      const response = await fetch(image, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return resizeCommunityPreview(await readPreviewSource(response), size as "thumbnail" | "detail");
    });
    return new Response(new Uint8Array(output), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch {
    console.error("[community-image] bounded preview unavailable", { storageId: data.storage_id, size });
    return NextResponse.json({ error: "Bildvorschau derzeit nicht erreichbar." }, { status: 502, headers });
  }
}
