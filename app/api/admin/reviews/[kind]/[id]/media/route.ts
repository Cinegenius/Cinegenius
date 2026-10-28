import { NextRequest, NextResponse } from "next/server";
import { readReviewImage } from "@/lib/admin-review-media";
import { loadReviewSource, REVIEW_HEADERS, ReviewError, reviewRevision } from "@/lib/admin-review-server";

/** No arbitrary URL proxy: the index must still belong to this reviewed parent. */
export async function GET(request: NextRequest, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await context.params;
    const review = await loadReviewSource(kind, id);
    const rawIndex = request.nextUrl.searchParams.get("index") ?? "";
    if (!/^\d{1,4}$/.test(rawIndex)) throw new ReviewError("notFound", 404);
    const reference = review.images[Number(rawIndex)];
    if (!reference) throw new ReviewError("notFound", 404);
    if (request.nextUrl.searchParams.get("ref") !== reviewRevision(reference)) throw new ReviewError("stale", 409);
    const image = await readReviewImage(review, Number(rawIndex), request.nextUrl.searchParams.get("size") === "thumbnail" ? 480 : 1920);
    return new NextResponse(new Uint8Array(image), { headers: { ...REVIEW_HEADERS, "Content-Type": "image/webp", "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ReviewError ? error.code : "mediaError" }, { status: error instanceof ReviewError ? error.status : 503, headers: REVIEW_HEADERS });
  }
}
