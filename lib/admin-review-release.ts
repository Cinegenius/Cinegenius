import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { readReviewImage } from "@/lib/admin-review-media";
import { db } from "@/lib/db";
import { loadAdminReview, REVIEW_HEADERS, ReviewError } from "@/lib/admin-review-server";
import { validateAdminReason } from "@/lib/admin-audit";
import { getListingProvider } from "@/lib/listing-provider";
import { responsibleForCompany } from "@/lib/responsible-person-server";
import { validateListingPublication } from "@/lib/listing-publication";

export async function releaseReviewedListing(id: string, body: Record<string, unknown>) {
  const t = await getTranslations("AdminReview");
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: REVIEW_HEADERS });
  try {
    // Guard runs before validation/database reads, including calls through the older endpoint.
    const review = await loadAdminReview("listing", id);
    const reason = validateAdminReason(body.reason);
    if (typeof body.revision !== "string" || !/^[a-f0-9]{64}$/.test(body.revision) || typeof body.published !== "boolean" || !reason) return fail("reviewRequired", 400);
    if (review.dto.revision !== body.revision) return fail("stale", 409);
    const listing = review.record;
    if (body.published) {
      if (!review.dto.canPublish) return fail("incomplete", 422);
      if (listing.company_id && !await responsibleForCompany(listing.responsible_person, String(listing.company_id), String(review.providerCompany?.owner_user_id ?? ""))) return fail("incomplete", 422);
      if (!listing.company_id && (listing.responsible_person as { userId?: string })?.userId !== listing.user_id) return fail("incomplete", 422);
      const provider = await getListingProvider(listing.user_id as string, listing.company_id as string, review.admin.userId, listing.responsible_person);
      const validation = validateListingPublication({ type: String(listing.type), title: listing.title as string, city: listing.city as string, category: listing.category as string, imageUrl: listing.image_url as string, companySlug: review.providerCompany?.slug as string, providerAssigned: provider.kind !== "unassigned", providerContactable: Boolean(provider.contactUserId) });
      if (validation) return fail("incomplete", 422);
      // Verify every current attached file; no success from a local preview alone.
      // Bound concurrency avoids loading all large originals into memory at once.
      for (let index = 0; index < review.images.length; index += 3) {
        try { await Promise.all(review.images.slice(index, index + 3).map((_, offset) => readReviewImage(review, index + offset, 480))); }
        catch { return fail("mediaError", 422); }
      }
    }
    const result = await db.rpc("admin_review_listing_transition", {
      p_id: id, p_expected: listing, p_provider_company: review.providerCompany, p_provider_profile: review.providerProfile,
      p_published: body.published, p_actor: review.admin.userId, p_reason: reason,
    });
    if (result.error) return fail("saveError", 503);
    if (result.data === "stale") return fail("stale", 409);
    if (result.data === "missing") return fail("notFound", 404);
    if (result.data !== "saved" && result.data !== "unchanged") return fail("saveError", 503);
    // Publication succeeded independently of cache invalidation. Never report a failed write after commit.
    let cacheRefreshed = true;
    try {
      for (const path of ["/", "/admin", "/locations", "/props", "/vehicles", "/jobs", review.dto.publicHref]) if (path) revalidatePath(path);
      revalidateTag("listings", { expire: 0 });
    } catch { cacheRefreshed = false; console.error("[admin-review] cache revalidation failed after saved transition"); }
    return NextResponse.json({ success: true, published: body.published, cacheRefreshed }, { headers: REVIEW_HEADERS });
  } catch (error) { return fail(error instanceof ReviewError ? error.code : "saveError", error instanceof ReviewError ? error.status : 503); }
}
