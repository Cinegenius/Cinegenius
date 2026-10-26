/** Official messaging identity; intentionally has no public member profile. */
export const SUPPORT_ACTOR_ID = "cinegenius-support";
export const SUPPORT_NAME = "CineGenius Support";
export const SUPPORT_AVATAR_URL = "/icon.svg";

type ConversationPeer = { kind?: string; sender_id: string; receiver_id: string | null };

export function conversationPeerProfileHref(conversation: ConversationPeer | undefined, currentUserId: string, newRecipient?: string | null): string | null {
  if (conversation?.kind === "support" || conversation?.kind === "group") return null;
  const peer = newRecipient || (conversation && (conversation.sender_id === currentUserId ? conversation.receiver_id : conversation.sender_id));
  return peer && peer !== SUPPORT_ACTOR_ID ? `/profile/${encodeURIComponent(peer)}` : null;
}
