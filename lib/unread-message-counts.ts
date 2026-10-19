import "server-only";
import { db } from "@/lib/db";

export async function getUnreadMessageCounts(userId: string) {
  const { data, error } = await db.rpc("unread_message_counts", { p_user_id: userId });
  if (error) throw new Error("Ungelesene Nachrichten konnten nicht geladen werden.");

  const byConversation: Record<string, number> = {};
  for (const row of data ?? []) {
    const conversationId = String(row.conversation_id);
    byConversation[conversationId] = Number(row.unread_count) || 0;
  }

  return {
    count: Object.values(byConversation).reduce((total, count) => total + count, 0),
    byConversation,
  };
}
