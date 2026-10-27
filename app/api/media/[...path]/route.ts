import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { downloadProtectedMedia, readableProtectedMedia } from "@/lib/protected-media-server";
import { PROTECTED_MEDIA_PREFIX, protectedMediaKey } from "@/lib/protected-media";
import { resizeCommunityPreview, cachedCommunityPreview } from "@/lib/community-preview-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const reference = PROTECTED_MEDIA_PREFIX + (await params).path.join("/");
  const size = req.nextUrl.searchParams.get("size");
  if (!protectedMediaKey(reference) || (size !== null && !["thumbnail", "detail"].includes(size))) return new NextResponse(null, { status: 404, headers });
  try {
    const { userId } = await auth();
    const asset = await readableProtectedMedia(reference, userId);
    if (!asset) return new NextResponse(null, { status: 404, headers });
    // Only small immutable derivatives are cached in server memory. Permission
    // checks always precede cache access, including for previously public URLs.
    const read = async () => {
      const file = await downloadProtectedMedia(reference, userId);
      if (!file) throw new Error("Media no longer readable");
      return size ? resizeCommunityPreview(file.bytes, size as "thumbnail" | "detail") : Buffer.from(file.bytes);
    };
    const bytes = size ? await cachedCommunityPreview(`protected:${asset.storage_path}:${size}`, read) : await read();
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": size ? "image/webp" : asset.mime_type } });
  } catch {
    console.error("[media] permission or storage unavailable");
    return new NextResponse(null, { status: 503, headers });
  }
}
