import "server-only";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { localizedNotification } from "@/lib/i18n/notification-copy";
import { sendFriendAcceptedEmail, sendFriendRequestEmail } from "@/lib/email";
import { publicContactConnection, validContactConnection } from "@/lib/contact-connections";

export const contactHeaders = { "Cache-Control": "private, no-store, max-age=0" };
export const contactJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: contactHeaders });
export async function mutateContact(actor: string, action: string, input: { target?: string; id?: string; label?: string | null; isPublic?: boolean }) {
  const t = await getTranslations("Contacts");
  let name = t("member");
  if (action === "request" || action === "accepted") {
    const { data: profile, error } = await db.from("profiles").select("display_name").eq("user_id", actor).maybeSingle();
    if (error) return contactJson({ error: t("error") }, 503);
    name = profile?.display_name?.trim() || name;
  }
  const notification = action === "request" ? localizedNotification({ title: { key: "n_cbf93b99dd39" }, body: { key: "n_aa80d88f1a90", values: { value0: name } } })
    : action === "accepted" ? localizedNotification({ title: { key: "n_e3ef2e08afb3" }, body: { key: "n_8a8b90197586", values: { value0: name } } }) : null;
  const { data, error } = await db.rpc("contact_connection", {
    p_actor: actor, p_action: action, p_target: input.target ?? null, p_id: input.id ?? null,
    p_label: input.label ?? null, p_public: input.isPublic ?? false, p_notification: notification,
  });
  if (error || !data || typeof data !== "object") return contactJson({ error: t("error") }, 503);
  const failures: Record<string, [string, number]> = { invalid: ["invalid", 400], missing: ["unavailable", 404], forbidden: ["unavailable", 403], blocked: ["unavailable", 403], stale: ["changed", 409], busy: ["busy", 409] };
  if (failures[data.status]) { const [key, status] = failures[data.status]; return contactJson({ error: t(key) }, status); }
  if (!["saved", "existing"].includes(data.status) || typeof data.changed !== "boolean"
    || (action === "remove" ? data.friendship !== null : !validContactConnection(data.friendship, actor, input.target))
    || (data.changed && action === "request" && (data.event !== "friend_request" || data.friendship?.status !== "pending"))
    || (data.changed && action === "accepted" && (data.event !== "friend_accepted" || data.friendship?.status !== "accepted"))) return contactJson({ error: t("error") }, 503);
  const connection = data.friendship;
  if (data.changed && (action === "accepted" || action === "remove" || action === "collab")) revalidateTag("profiles", { expire: 0 });
  // The transaction returns changed=true once only, so retries and concurrent
  // acceptance cannot repeat in-app notifications or optional email.
  if (data.changed && ["friend_request", "friend_accepted"].includes(data.event)) {
    const recipient = data.event === "friend_request" ? connection.receiver_id : connection.sender_id;
    try {
      const client = await clerkClient();
      const member = await client.users.getUser(recipient);
      const email = member.emailAddresses.find(address => address.id === member.primaryEmailAddressId)?.emailAddress ?? member.emailAddresses[0]?.emailAddress;
      if (email) await (data.event === "friend_request" ? sendFriendRequestEmail(email, name) : sendFriendAcceptedEmail(email, name));
    } catch { /* The saved contact and in-app notification remain authoritative. */ }
  }
  return contactJson({ success: true, friendship: connection ? publicContactConnection(connection) : null, changed: data.changed });
}
