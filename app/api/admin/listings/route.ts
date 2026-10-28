import { getTranslations,getLocale } from "next-intl/server";
import { DEPARTMENTS,deptValues,groupValues } from "@/lib/marketplaceCategories";
import { listingPriceLabel } from "@/lib/listing-price";
import { isOfferStatus } from "@/lib/offer-moderation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";
import { getListingProvider } from "@/lib/listing-provider";
import { listingDetailPath } from "@/lib/listing-routes";
import { revalidatePath, revalidateTag } from "next/cache";
import { getPrivateProfileIds } from "@/lib/trust";

const LISTING_TYPES = new Set(["all", "location", "prop", "vehicle", "job", "creator", "service", "animal"]);

// GET /api/admin/listings — complete, paginated admin list, including drafts.
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const search = (params.get("search") ?? "").trim().slice(0, 80).replace(/[%,()]/g, " ").trim();
  const rawType = params.get("type") ?? "all";
  const rawStatus = params.get("status") ?? "all";
  if (!LISTING_TYPES.has(rawType) || (!["all", "published"].includes(rawStatus) && !isOfferStatus(rawStatus))) {
    return NextResponse.json({ error: "Ungültiger Filter." }, { status: 400 });
  }

  let query = db.from("listings")
    .select("id, responsible_person, user_id, company_id, type, category, title, city, price, published, created_at, price_negotiable:metadata->price_negotiable, price_on_request:metadata->price_on_request, rental_type:metadata->>rental_type,marketplace:metadata->marketplace,moderation_status,content_revision,reviewed_revision,submitted_at,reviewed_at,moderation_reason", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  const department=params.get("dept"),subcategory=params.get("sub");
  const selected=department?DEPARTMENTS.find(d=>d.id===department):null;
  const group=subcategory?DEPARTMENTS.flatMap(d=>d.groups).find(g=>g.id===subcategory):null;
  if((department&&!selected)||(subcategory&&(!group||(selected&&!selected.groups.some(g=>g.id===subcategory)))))return NextResponse.json({error:(await getTranslations("MarketplaceOffer"))("invalidCategory")},{status:400});
  if(group)query=query.in("category",groupValues(group));else if(selected)query=query.in("category",deptValues(selected));
  if(department||subcategory)query=query.in("type",["prop","vehicle"]);
  if (rawType !== "all") query = query.eq("type", rawType);
  if (rawStatus === "published") query = query.eq("published", true);
  if (rawStatus === "draft") query = query.eq("moderation_status", "draft");
  else if (isOfferStatus(rawStatus)) query = query.eq("moderation_status", rawStatus);
  if (search) query = query.ilike("title", `%${search}%`);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "Inserate konnten nicht geladen werden." }, { status: 500 });
  const companyIds = [...new Set((data ?? []).flatMap((listing) => listing.company_id ? [listing.company_id] : []))];
  const userIds = [...new Set((data ?? []).flatMap((listing) => !listing.company_id && listing.user_id ? [listing.user_id] : []))];
  const { data: companies } = companyIds.length
    ? await db.from("companies").select("id, slug, name, logo_url, owner_user_id, published").in("id", companyIds)
    : { data: [] };
  const profileIds = [...new Set([
    ...userIds,
    ...(companies ?? []).map((company: { owner_user_id: string }) => company.owner_user_id).filter(Boolean),
  ])];
  const { data: profiles } = profileIds.length
    ? await db.from("profiles").select("user_id, display_name, slug, avatar_url").in("user_id", profileIds)
    : { data: [] };
  const privateProfileIds = await getPrivateProfileIds(profileIds);
  const companyMap = new Map((companies ?? []).map((company: { id: string }) => [company.id, company]));
  const profileMap = new Map((profiles ?? []).map((profile: { user_id: string }) => [profile.user_id, profile]));
  const market=await getTranslations("MarketplaceOffer"),locale=await getLocale();
  return NextResponse.json({ listings: (data ?? []).map((listing) => {
    const company = listing.company_id ? companyMap.get(listing.company_id) as { id: string; slug: string | null; name: string; logo_url: string | null; published: boolean; owner_user_id: string } | undefined : undefined;
    const profile = !listing.company_id && listing.user_id ? profileMap.get(listing.user_id) as { user_id: string; display_name: string | null; slug: string | null; avatar_url: string | null } | undefined : undefined;
    const companyOwnerProfileMissing = !!listing.company_id && !!company?.owner_user_id && !profileMap.has(company.owner_user_id);
    const privateProviderProfile = !!profile && privateProfileIds.has(profile.user_id);
    const providerMissing = listing.company_id ? !company?.published || !company?.slug || !company?.name || companyOwnerProfileMissing : !profile?.display_name?.trim() || privateProviderProfile;
    const providerName = listing.company_id ? (providerMissing ? "Firma nicht öffentlich zugeordnet" : company!.name) : privateProviderProfile ? "Personenprofil ist privat" : (profile?.display_name?.trim() || "Kein Anbieterprofil zugeordnet");
    const companySlug = company?.slug ?? null;
    return {
      ...listing,
      priceLabel: listingPriceLabel(listing.price,listing,"/Tag",locale,market),
      company_slug: companySlug,
      provider_name: providerName,
      provider_href: listing.company_id
        ? company?.published && company.slug ? `/companies/${company.slug}` : null
        : profile?.display_name && !privateProviderProfile ? `/profile/${profile.slug || profile.user_id}` : null,
      provider_image: listing.company_id ? company?.logo_url ?? null : profile?.avatar_url ?? null,
      provider_missing: providerMissing,
      detail_href: listingDetailPath(listing.type, listing.id, companySlug),
    };
  }), total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
}

// PATCH /api/admin/listings — publish or hide a listing with an audit reason.
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const listingId = body?.listingId;

  if (body?.providerType === "person" || body?.providerType === "company") {
    const providerType = body.providerType as "person" | "company";
    const providerId = body.providerId;
    const reason = validateAdminReason(body?.reason);
    if (typeof listingId !== "string" || !listingId || typeof providerId !== "string" || !providerId || !reason) {
      return NextResponse.json({ error: "Angebot, Anbieter und eine Begründung sind erforderlich." }, { status: 400 });
    }

    const { data: listing, error: listingError } = await db.from("listings")
      .select("id, type, user_id, company_id, responsible_person")
      .eq("id", listingId)
      .maybeSingle();
    if (listingError) return NextResponse.json({ error: "Angebot konnte nicht geladen werden." }, { status: 500 });
    if (!listing) return NextResponse.json({ error: "Angebot nicht gefunden." }, { status: 404 });

    let update: Record<string, unknown>;
    if (providerType === "person") {
      const { data: profile } = await db.from("profiles").select("user_id, display_name").eq("user_id", providerId).maybeSingle();
      if (!profile?.display_name?.trim()) return NextResponse.json({ error: "Das ausgewählte Personenprofil ist nicht verfügbar." }, { status: 400 });
      if ((await getPrivateProfileIds([providerId])).has(providerId)) return NextResponse.json({ error: "Private Profile können nicht als öffentlicher Anbieter zugeordnet werden." }, { status: 400 });
      update = { user_id: providerId, company_id: null };
    } else {
      const { data: company } = await db.from("companies").select("id, published, owner_user_id, slug").eq("id", providerId).maybeSingle();
      if (!company || company.published !== true || !company.slug) return NextResponse.json({ error: "Die ausgewählte Firma ist nicht öffentlich erreichbar." }, { status: 400 });
      const { data: ownerProfile } = await db.from("profiles").select("user_id").eq("user_id", company.owner_user_id).maybeSingle();
      if (!ownerProfile) return NextResponse.json({ error: "Bei dieser Firma fehlt ein erreichbares Inhaberprofil. Anbieterzuordnung wurde nicht geändert." }, { status: 400 });
      // Keep user_id as the technical submitting account; company_id identifies the actual provider.
      update = { company_id: providerId };
    }

    const previousProvider = await getListingProvider(listing.user_id, listing.company_id, guard.userId, listing.responsible_person);
    const audit = await startAdminAudit({ actorUserId: guard.userId, action: "listing_provider_assign", entityType: "listing", entityId: listingId, reason, metadata: { providerType, providerId, previousUserId: listing.user_id, previousCompanyId: listing.company_id } });
    if (!audit) return NextResponse.json({ error: "Änderung gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
    const { error: updateError } = await db.from("listings").update({ ...update, responsible_person: null, last_editor_id: guard.userId }).eq("id", listingId);
    if (updateError) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Anbieterzuordnung konnte nicht gespeichert werden." }, { status: 500 }); }
    const auditLogged = await finishAdminAudit(audit, "succeeded");
    const assignedCompany = providerType === "company"
      ? await db.from("companies").select("slug").eq("id", providerId).maybeSingle()
      : { data: null };
    const href = listingDetailPath(listing.type, listing.id, assignedCompany.data?.slug);
    revalidatePath("/");
    revalidatePath("/marketplace");
    if (href) revalidatePath(href);
    if (assignedCompany.data?.slug) revalidatePath(`/companies/${assignedCompany.data.slug}`);
    if (previousProvider.href) revalidatePath(previousProvider.href);
    if (providerType === "person") {
      const { data: assignedProfile } = await db.from("profiles").select("slug, user_id").eq("user_id", providerId).maybeSingle();
      if (assignedProfile) revalidatePath(`/profile/${assignedProfile.slug || assignedProfile.user_id}`);
    }
    revalidateTag("listings", { expire: 0 });
    return NextResponse.json({ success: true, auditLogged });
  }

  // A release/hide must name the exact version seen in the protected review.
  const { releaseReviewedListing } = await import("@/lib/admin-review-release");
  return releaseReviewedListing(typeof listingId === "string" ? listingId : "", body ?? {});
}

// DELETE /api/admin/listings — remove a listing
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const listingId = body?.listingId;
  const reason = validateAdminReason(body?.reason);
  if (typeof listingId !== "string" || !listingId || !reason || body?.confirm !== true) {
    return NextResponse.json({ error: "ID, Begründung und ausdrückliche Bestätigung erforderlich." }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: guard.userId, action: "listing_delete", entityType: "listing", entityId: listingId, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
  const { data, error } = await db
    .from("listings")
    .delete()
    .eq("id", listingId)
    .select("id")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Inserat nicht gefunden." }, { status: 404 }); }

  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}
