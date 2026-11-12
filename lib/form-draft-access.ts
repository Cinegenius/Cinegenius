import "server-only";
import { canManageOrganization } from "@/lib/organization-access";
import { db } from "@/lib/db";
import { canEditListing } from "@/lib/listing-access";
import { hasCompanyCapability } from "@/lib/company-access";

/** Recheck current edit rights before exposing a recovery copy of existing content. */
export async function canUseFormDraft(userId: string, key: string) {
  if (key.startsWith("booking:") || key.startsWith("inquiry:")) {
    const recipient = key.startsWith("booking:") ? key.split(":")[1] : key.split(":")[2];
    const result = await db.rpc("messaging_recipient_available", { p_sender: userId, p_recipient: recipient });
    if (result.error) throw new Error("draft_access_unavailable");
    return result.data === true;
  }
  if (key.startsWith("message:")) {
    const [, type, target] = key.split(":");
    if (type === "recipient") {
      const result = await db.rpc("messaging_recipient_available", { p_sender: userId, p_recipient: target });
      if (result.error) throw new Error("draft_access_unavailable");
      return result.data === true;
    }
    const [conversation, member] = await Promise.all([
      db.from("conversations").select("kind,receiver_id").eq("id", target).maybeSingle(),
      db.from("conversation_members").select("role").eq("conversation_id", target).eq("user_id", userId).is("left_at", null).maybeSingle(),
    ]);
    if (conversation.error || member.error) throw new Error("draft_access_unavailable");
    if (!conversation.data || !member.data) return false;
    if (type === "group") return conversation.data.kind === "group" && member.data.role === "admin";
    return conversation.data.kind !== "support" || conversation.data.receiver_id === userId;
  }
  const [kind, id] = key.split(":");
  if (!/^[0-9a-f-]{36}$/.test(id)) return true;
  if (kind === "organization") return canManageOrganization(id, userId);
  if (kind === "organization-entry") {
    const { data, error } = await db.from("organization_entries").select("organization_id").eq("id", id).maybeSingle();
    if (error) throw new Error("draft_access_unavailable");
    return !!data && canManageOrganization(data.organization_id, userId);
  }
  if (kind === "company") return hasCompanyCapability(id, userId, "edit_company");
  if (kind === "listing" || kind === "location-private") {
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
