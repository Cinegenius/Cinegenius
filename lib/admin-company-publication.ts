import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { adminReviewReason } from "@/lib/admin-review";
import { loadAdminReview, REVIEW_HEADERS, ReviewError } from "@/lib/admin-review-server";
import { readReviewImage } from "@/lib/admin-review-media";
import { responsibleForCompany } from "@/lib/responsible-person-server";

export async function publishReviewedCompany(id: string, body: Record<string, unknown>) {
  const t = await getTranslations("AdminReview");
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: REVIEW_HEADERS });
  try {
    const review = await loadAdminReview("company", id); // Server admin guard, before account/media reads.
    const reason = adminReviewReason("approve", body.reason, t("approvalReasonDefault"));
    if (body.action !== "approve" || !reason || typeof body.revision !== "string" || !/^[a-f0-9]{64}$/.test(body.revision)) return fail("reviewRequired", 400);
    if (body.revision !== review.dto.revision) return fail("stale", 409);
    if (!review.dto.canPublish || !review.dto.provider.userId) return fail("incomplete", 422);
    const owner = await (await clerkClient()).users.getUser(review.dto.provider.userId);
    if (owner.id !== review.dto.provider.userId) return fail("incomplete", 422);
    const contact = review.record.responsible_person as { userId?: string } | null;
    if (contact?.userId && !await responsibleForCompany(contact, id, owner.id)) return fail("responsibleMismatch", 422);
    const warnings = [...review.dto.issues];
    for (let index = 0; index < review.images.length; index += 3) {
      await Promise.all(review.images.slice(index, index + 3).map(async (_, offset) => {
        try { await readReviewImage(review, index + offset, 480); }
        catch (error) { if (error instanceof ReviewError && error.code === "mediaError") warnings.push("mediaUnavailable"); else throw error; }
      }));
    }
    const { data, error } = await db.rpc("admin_review_company_publication", { p_id: id, p_expected: review.record, p_owner_profile: review.providerProfile, p_actor: review.admin.userId, p_reason: reason });
    if (error) return fail("saveError", 503);
    if (data === "stale") return fail("stale", 409);
    if (data === "missing") return fail("notFound", 404);
    if (data !== "saved" && data !== "unchanged") return fail("saveError", 503);
    let cacheRefreshed = true;
    try {
      for (const path of ["/", "/admin", "/companies", review.dto.publicHref]) if (path) revalidatePath(path);
      revalidatePath("/", "layout");
      for (const tag of ["companies", "profiles"]) revalidateTag(tag, { expire: 0 });
    } catch { cacheRefreshed = false; }
    return NextResponse.json({ success: true, published: true, warnings: [...new Set(warnings)], cacheRefreshed }, { headers: REVIEW_HEADERS });
  } catch (error) { return fail(error instanceof ReviewError ? error.code : "saveError", error instanceof ReviewError ? error.status : 503); }
}
