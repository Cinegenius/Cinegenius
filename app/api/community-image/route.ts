import { downloadProtectedMedia, readableProtectedMedia } from "@/lib/protected-media-server";
import { protectedMediaKey } from "@/lib/protected-media";
import { auth } from "@clerk/nextjs/server";
import { blockedMediaOwnerIds } from "@/lib/linked-profile-access";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwnPublicStorageUrl } from "@/lib/community-media";
import { cachedCommunityPreview, readPreviewSource, resizeCommunityPreview } from "@/lib/community-preview-server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const image = request.nextUrl.searchParams.get("image") ?? "";
  const size = request.nextUrl.searchParams.get("size") ?? "thumbnail";
  if (image.length > 2048 || !isOwnPublicStorageUrl(image, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") || !["thumbnail", "detail"].includes(size)) {
    return NextResponse.json({ error: tResponse('System.m_573f1f11c4a9') }, { status: 400, headers });
  }
  // Never turn the resizing service into a proxy for private or excluded media.
  const { data: matches, error } = await db.rpc("public_community_image", { p_image: image });
  const data = Array.isArray(matches) ? matches[0] : null;
  if (error) return NextResponse.json({ error: tResponse('System.m_9a5e91b6061d') }, { status: 503, headers });
  if (!data) return NextResponse.json({ error: tResponse('System.m_e3d2d6e03512') }, { status: 404, headers });
  try {
    const { userId } = await auth();
    const blocked = await blockedMediaOwnerIds(userId);
    if (data.owner_id && blocked.includes(data.owner_id)) return new Response(null, { status: 404, headers });
    // Recheck source rights before even looking up a cached derivative.
    const protectedAsset = protectedMediaKey(image) ? await readableProtectedMedia(image, userId) : null;
    if (protectedMediaKey(image) && !protectedAsset) return new Response(null, { status: 404, headers });
    const output = await cachedCommunityPreview(`${data.storage_id}:${data.uploaded_at}:${image}:${size}`, async () => {
      if (protectedAsset) {
        const file = await downloadProtectedMedia(image, userId);
        if (!file) throw new Error("Public source no longer readable");
        return resizeCommunityPreview(file.bytes, size as "thumbnail" | "detail");
      }
      const response = await fetch(image, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return resizeCommunityPreview(await readPreviewSource(response), size as "thumbnail" | "detail");
    });
    return new Response(new Uint8Array(output), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch {
    console.error("[community-image] bounded preview unavailable", { storageId: data.storage_id, size });
    return NextResponse.json({ error: tResponse('System.m_e3cf3aca9605') }, { status: 502, headers });
  }
}
