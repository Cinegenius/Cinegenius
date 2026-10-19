export type GroupMemberState = {
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  left_at: string | null;
};

export type ConversationMessage = {
  id: string;
  sender_id: string;
  created_at: string;
  read_at?: string | null;
  read_by?: string[];
};

export function activeMemberFor(
  members: GroupMemberState[],
  userId: string,
): GroupMemberState | undefined {
  return members.find((member) => member.user_id === userId && member.left_at === null);
}

export function canManageGroup(members: GroupMemberState[], userId: string): boolean {
  return activeMemberFor(members, userId)?.role === "admin";
}

export function canReadMessageForMember(
  message: Pick<ConversationMessage, "created_at">,
  member: GroupMemberState | undefined,
): boolean {
  return !!member && member.left_at === null && message.created_at >= member.joined_at;
}

/** Only current, incoming, unreceipted messages count for this participant. */
export function countUnreadForMember(
  messages: ConversationMessage[],
  member: GroupMemberState | undefined,
  userId: string,
  receiptMessageIds: ReadonlySet<string>,
): number {
  if (!member || member.left_at !== null) return 0;
  return new Set(messages
    .filter((message) => message.sender_id !== userId)
    .filter((message) => canReadMessageForMember(message, member))
    .filter((message) => !receiptMessageIds.has(message.id))
    .map((message) => message.id)).size;
}

export function normalizeMemberIds(userId: string, memberIds: unknown): string[] | null {
  if (!Array.isArray(memberIds) || memberIds.some((id) => typeof id !== "string" || id.length > 128)) return null;
  return [...new Set(memberIds.map((id) => id.trim()).filter((id) => id && id !== userId))];
}

export function mergeMessagesById<T extends ConversationMessage>(
  current: T[],
  incoming: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const message of [...current, ...incoming]) {
    const previous = byId.get(message.id);
    const merged = { ...previous, ...message } as T;
    if (previous && message.read_at == null && previous.read_at != null) merged.read_at = previous.read_at;
    if (previous?.read_by && message.read_by) merged.read_by = [...new Set([...previous.read_by, ...message.read_by])];
    byId.set(message.id, merged);
  }
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
