import { isMessageCursorTimestamp } from "./message-cursor";
import { validConversationId } from "./messaging-ui";

export type NativeInboxConversation = {
  id: string; kind?: string; sender_id?: string; receiver_id?: string;
  otherName?: string; otherAvatar?: string | null; group_name?: string;
  unread_count?: number; updated_at?: string;
  messages?: { content?: string; created_at?: string }[];
};
export type NativeInboxFriend = { user_id: string; is_favorite?: boolean };
export type NativeInboxCategory = "homies" | "colleagues" | "groups";
export type NativeInboxCursor = { before: string; before_id: string };

export function nativeInboxCursor(value: unknown): NativeInboxCursor | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!isMessageCursorTimestamp(item.before) || !validConversationId(item.before_id) || item.before_id.length !== 36) return null;
  return { before: item.before, before_id: item.before_id };
}
export function nativeInboxPageURL(cursor: NativeInboxCursor | null): string {
  return `/api/conversations${cursor ? `?${new URLSearchParams(cursor).toString()}` : ""}`;
}

/** Categorize only conversations and relationships already authorized by the server. */
export function nativeInboxConversations(rows: NativeInboxConversation[], friends: NativeInboxFriend[], account: string, category: NativeInboxCategory, query: string, locale: string) {
  const contacts = new Set(friends.filter(friend => category !== "homies" || friend.is_favorite === true).map(friend => friend.user_id));
  const search = query.trim().toLocaleLowerCase(locale);
  return rows.filter(row => {
    if (!validConversationId(row.id)) return false;
    if (category === "groups") { if (row.kind !== "group") return false; }
    else {
      if (row.kind && row.kind !== "direct") return false;
      const other = row.sender_id === account ? row.receiver_id : row.receiver_id === account ? row.sender_id : null;
      if (!other || !contacts.has(other)) return false;
    }
    return !search || `${row.otherName ?? ""} ${row.group_name ?? ""}`.toLocaleLowerCase(locale).includes(search);
  });
}

export function nativeInboxPreview(row: NativeInboxConversation): string {
  let last: { content?: string; created_at?: string } | undefined;
  let latest = -Infinity;
  for (const message of row.messages ?? []) {
    const at = Date.parse(message.created_at ?? "");
    if (Number.isFinite(at) && at >= latest) { last = message; latest = at; }
  }
  return typeof last?.content === "string" ? last.content.trim().slice(0, 240) : "";
}
