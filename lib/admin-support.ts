import "server-only";

import { db } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { hasProfileBasics, requiredSetupDestination, type SetupProgress } from "@/lib/profile-setup-flow";
export { fillSupportTemplate, validateSupportTemplateBody } from "@/lib/support-message-templates";

export type AdminSupportTargetType = "profile" | "company" | "listing";
export type AdminSupportTarget = {
  targetType: "profile" | "company" | "location" | "marketplace";
  targetId: string; targetLabel: string; editUrl: string; recipientUserId: string;
  recipientName: string; recipientProfileUrl: string | null; recipientAvatarUrl: string | null;
  firstName: string | null; companyName: string | null; listingTitle: string | null;
  missingFields: string[]; isDraft: boolean;
  setupIncomplete?: boolean;
};
export class SupportTargetError extends Error {
  constructor(message: string, public status = 404) { super(message); }
}

export async function resolveAdminSupportTarget(
  type: AdminSupportTargetType, id: string, adminUserId: string,
): Promise<AdminSupportTarget> {
  let recipientUserId = "";
  let targetType: AdminSupportTarget["targetType"] = "profile";
  let targetId = id;
  let targetLabel = "";
  let editUrl = "/dashboard?tab=profil";
  let listingTitle: string | null = null;
  let companyName: string | null = null;
  let missingFields: string[] = [];
  let isDraft = false;

  if (type === "profile") {
    const { data: profile, error } = await db.from("profiles")
      .select("user_id, display_name, slug, avatar_url, location, positions, role, profile_types, profile_type")
      .eq("user_id", id).maybeSingle();
    if (error) throw new SupportTargetError("Profil konnte nicht geprüft werden.", 500);
    if (!hasProfileBasics(profile)) {
      const t = await getTranslations("AdminAccounts");
      let member;
      try { member = await (await clerkClient()).users.getUser(id); }
      catch (error) {
        throw new SupportTargetError(t("accountLookupError"), (error as { status?: number }).status === 404 ? 404 : 503);
      }
      const saved = member.privateMetadata.cinegeniusOnboarding;
      const destination = requiredSetupDestination(profile, saved && typeof saved === "object" ? saved as SetupProgress : null);
      const name = profile?.display_name?.trim() || [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
      return {
        ...finishTarget({
          targetType: "profile", targetId: member.id, targetLabel: t("accountTarget"),
          editUrl: destination ?? "/dashboard", recipientUserId: member.id,
          profileName: name || t("unnamed"), profileSlug: null, avatarUrl: profile?.avatar_url ?? null,
          missingFields: [], isDraft: destination !== null,
        }, adminUserId),
        recipientProfileUrl: null, firstName: member.firstName || null,
        setupIncomplete: destination !== null,
      };
    }
    if (!profile) throw new SupportTargetError("Profil nicht gefunden.");
    recipientUserId = profile.user_id;
    targetLabel = profile.display_name?.trim() || "Profil";
    missingFields = [
      !profile.display_name?.trim() ? "Name" : "",
      !profile.location?.trim() ? "Standort" : "",
      !(Array.isArray(profile.positions) && profile.positions.some((value: unknown) => typeof value === "string" && value.trim()))
        && !(Array.isArray(profile.profile_types) && profile.profile_types.length > 0)
        && !profile.profile_type ? "Tätigkeit" : "",
    ].filter(Boolean);
    return finishTarget({
      targetType, targetId, targetLabel, editUrl, recipientUserId, profileName: profile.display_name,
      profileSlug: profile.slug, avatarUrl: profile.avatar_url, missingFields, isDraft: false,
    }, adminUserId);
  }

  if (type === "company") {
    const { data: company, error } = await db.from("companies")
      .select("id, slug, owner_user_id, name, logo_url, categories, published")
      .eq("id", id).maybeSingle();
    if (error) throw new SupportTargetError("Firmenprofil konnte nicht geprüft werden.", 500);
    if (!company) throw new SupportTargetError("Firma nicht gefunden.");
    recipientUserId = company.owner_user_id;
    targetType = "company";
    targetLabel = company.name;
    companyName = company.name;
    editUrl = "/company-setup?company_id=" + encodeURIComponent(company.id);
    isDraft = company.published !== true;
    if (!Array.isArray(company.categories) || company.categories.length === 0) missingFields.push("Branche");
    const { data: owner, error: ownerError } = await db.from("profiles")
      .select("user_id, display_name, slug, avatar_url")
      .eq("user_id", recipientUserId).maybeSingle();
    if (ownerError) throw new SupportTargetError("Firmenverantwortliche konnten nicht geprüft werden.", 500);
    if (!owner) throw new SupportTargetError("Für diese Firma ist kein erreichbares Inhaberkonto hinterlegt.", 409);
    return finishTarget({
      targetType, targetId, targetLabel, editUrl, recipientUserId, profileName: owner.display_name,
      profileSlug: owner.slug, avatarUrl: owner.avatar_url, companyName, missingFields, isDraft,
    }, adminUserId);
  }

  const { data: listing, error: listingError } = await db.from("listings")
    .select("id, user_id, company_id, type, title, city, published")
    .eq("id", id).maybeSingle();
  if (listingError) throw new SupportTargetError("Angebot konnte nicht geprüft werden.", 500);
  if (!listing) throw new SupportTargetError("Angebot nicht gefunden.");
  targetType = listing.type === "location" ? "location" : "marketplace";
  targetId = listing.id;
  listingTitle = listing.title?.trim() || "Angebot";
  targetLabel = listingTitle + (targetType === "location" ? " · Location" : " · Marktplatz");
  isDraft = listing.published !== true;
  editUrl = "/dashboard?tab=listings&editListing=" + encodeURIComponent(listing.id);
  if (!listing.title?.trim()) missingFields.push("Titel");
  if (!listing.city?.trim()) missingFields.push("Standort");

  if (listing.company_id) {
    const { data: company, error } = await db.from("companies")
      .select("id, owner_user_id, name, logo_url")
      .eq("id", listing.company_id).maybeSingle();
    if (error) throw new SupportTargetError("Anbieterfirma konnte nicht geprüft werden.", 500);
    if (!company?.owner_user_id) throw new SupportTargetError("Für dieses Angebot ist keine verantwortliche Firmenperson hinterlegt.", 409);
    recipientUserId = company.owner_user_id;
    companyName = company.name;
    const { data: owner, error: ownerError } = await db.from("profiles")
      .select("user_id, display_name, slug, avatar_url")
      .eq("user_id", recipientUserId).maybeSingle();
    if (ownerError) throw new SupportTargetError("Anbieterprofil konnte nicht geprüft werden.", 500);
    if (!owner) throw new SupportTargetError("Das verantwortliche Firmenkonto besitzt kein erreichbares Profil.", 409);
    return finishTarget({
      targetType, targetId, targetLabel, editUrl, recipientUserId, profileName: owner.display_name,
      profileSlug: owner.slug, avatarUrl: company.logo_url ?? owner.avatar_url, companyName, listingTitle,
      missingFields, isDraft,
    }, adminUserId);
  }

  recipientUserId = listing.user_id ?? "";
  if (!recipientUserId) throw new SupportTargetError("Für dieses Angebot ist kein Anbieter zugeordnet.", 409);
  const { data: owner, error: ownerError } = await db.from("profiles")
    .select("user_id, display_name, slug, avatar_url")
    .eq("user_id", recipientUserId).maybeSingle();
  if (ownerError) throw new SupportTargetError("Anbieterprofil konnte nicht geprüft werden.", 500);
  if (!owner) throw new SupportTargetError("Das Anbieterprofil ist nicht verfügbar.", 409);
  return finishTarget({
    targetType, targetId, targetLabel, editUrl, recipientUserId, profileName: owner.display_name,
    profileSlug: owner.slug, avatarUrl: owner.avatar_url, listingTitle, missingFields, isDraft,
  }, adminUserId);
}

function finishTarget(
  input: {
    targetType: AdminSupportTarget["targetType"]; targetId: string; targetLabel: string; editUrl: string;
    recipientUserId: string; profileName: string | null; profileSlug: string | null; avatarUrl: string | null;
    companyName?: string | null; listingTitle?: string | null; missingFields: string[]; isDraft: boolean;
  }, adminUserId: string,
): AdminSupportTarget {
  if (input.recipientUserId === adminUserId) {
    throw new SupportTargetError("Das Zielprofil gehört zu deinem Admin-Konto. Versand an dich selbst wurde verhindert.", 409);
  }
  const recipientName = input.profileName?.trim() || "Mitglied ohne Profilnamen";
  const firstName = input.profileName?.trim().split(/\s+/)[0] || null;
  return {
    targetType: input.targetType, targetId: input.targetId, targetLabel: input.targetLabel,
    editUrl: input.editUrl, recipientUserId: input.recipientUserId, recipientName,
    recipientProfileUrl: input.profileSlug || input.recipientUserId
      ? "/profile/" + encodeURIComponent(input.profileSlug || input.recipientUserId) : null,
    recipientAvatarUrl: input.avatarUrl, firstName, companyName: input.companyName ?? null,
    listingTitle: input.listingTitle ?? null, missingFields: input.missingFields, isDraft: input.isDraft,
  };
}


