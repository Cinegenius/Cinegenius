import "server-only";
import { db } from "@/lib/db";

/** Always scoped to the verified account, with no persistent/shared cache. */
export async function getInboxNotifications(userId: string) {
  const { data, error } = await db
    .from("notifications")
    .select("id, type, title, body, href, read, created_at")
    .eq("user_id", userId)
    // Message counts come from per-user message receipts, not notification rows.
    .neq("type", "new_message")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("notifications_unavailable");
  return data ?? [];
}
