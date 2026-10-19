export type MessageReadState = {
  id: string;
  sender_id: string;
  read_at: string | null;
};

export type MessageReadReceipt = {
  message_id: string;
  user_id: string;
  read_at: string;
};

/** The person who can mark this message as read in a one-to-one conversation. */
export function messageReaderId(
  message: Pick<MessageReadState, "sender_id">,
  currentUserId: string,
  otherParticipantId: string,
): string {
  return message.sender_id === currentUserId ? otherParticipantId : currentUserId;
}

/** Resolve display receipts by participant, keeping read state user-specific. */
export function applyParticipantReadReceipts<T extends MessageReadState>(
  messages: T[],
  receipts: MessageReadReceipt[],
  currentUserId: string,
  otherParticipantId: string,
): T[] {
  const byMessageAndUser = new Map(
    receipts.map((receipt) => [`${receipt.message_id}:${receipt.user_id}`, receipt.read_at]),
  );

  return messages.map((message) => {
    const readerId = messageReaderId(message, currentUserId, otherParticipantId);
    const readAt = byMessageAndUser.get(`${message.id}:${readerId}`);
    return readAt ? { ...message, read_at: readAt } : message;
  });
}

/** Snapshot only unread incoming messages currently rendered by the client. */
export function incomingUnreadMessageIds(
  messages: MessageReadState[],
  currentUserId: string,
): string[] {
  return [...new Set(
    messages
      .filter((message) => message.sender_id !== currentUserId && !message.read_at)
      .map((message) => message.id),
  )];
}

export function unreadIncomingMessageCount(
  messages: MessageReadState[],
  currentUserId: string,
): number {
  return incomingUnreadMessageIds(messages, currentUserId).length;
}

/** Apply only receipts returned by the server; never infer a read from opening a chat. */
export function applyReadReceiptTimestamps<T extends MessageReadState>(
  messages: T[],
  receipts: Array<{ id: string; read_at: string }>,
): T[] {
  const byId = new Map(receipts.map((receipt) => [receipt.id, receipt.read_at]));
  return messages.map((message) => {
    const readAt = byId.get(message.id);
    return readAt ? { ...message, read_at: readAt } : message;
  });
}
