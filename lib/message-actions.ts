import { mergeMessagesById, type ConversationMessage } from "./conversation-logic";

type DirectContactConversation = { sender_id: string; receiver_id: string | null; kind?: string; listing_id?: string | null };
export function findContactConversation<T extends DirectContactConversation>(conversations: T[], currentUser: string, contact: string): T | undefined {
  const matches = conversations.filter(c => (!c.kind || c.kind === "direct") &&
    ((c.sender_id === currentUser && c.receiver_id === contact) || (c.receiver_id === currentUser && c.sender_id === contact)));
  return matches.find(c => !c.listing_id) ?? matches[0];
}

/** Fresh latest pages are authoritative; retain loaded older history and local hides. */
export function mergeVisibleMessagePage<T extends ConversationMessage>(current: T[], page: T[], hiddenIds: ReadonlySet<string>, latest: boolean): T[] {
  const oldest = page[0];
  const ids = new Set(page.map(m => m.id));
  const retained = latest ? current.filter(m => oldest &&
    (m.created_at < oldest.created_at || (m.created_at === oldest.created_at && m.id < oldest.id) || ids.has(m.id))) : current;
  return mergeMessagesById(retained, page).filter(m => !hiddenIds.has(m.id));
}
