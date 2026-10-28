import "server-only";
import { db } from "@/lib/db";
import { canEditListing } from "@/lib/listing-access";
import { hasCompanyCapability } from "@/lib/company-access";

/** Recheck current edit rights before exposing a recovery copy of existing content. */
export async function canUseFormDraft(userId: string, key: string) {
  const [kind, id] = key.split(":");
  if (!/^[0-9a-f-]{36}$/.test(id)) return true;
  if (kind === "company") return hasCompanyCapability(id, userId, "edit_company");
  if (kind === "listing") {
    const { data, error } = await db.from("listings").select("user_id, company_id").eq("id", id).maybeSingle();
    if (error) throw new Error("draft_access_unavailable");
    return !!data && canEditListing(userId, data);
  }
  if (kind === "project") {
    const { data, error } = await db.from("projects").select("created_by").eq("id", id).maybeSingle();
    if (error) throw new Error("draft_access_unavailable");
    return data?.created_by === userId;
  }
  return false;
}
