export type ContactConnection = {
  id: string; sender_id: string; receiver_id: string; status: "pending" | "accepted" | "rejected"; created_at?: string;
  sender_collab_label?: string | null; receiver_collab_label?: string | null;
  sender_collab_public?: boolean | null; receiver_collab_public?: boolean | null;
};
export const contactUserId = /^[a-zA-Z0-9_-]{1,128}$/;
export const contactId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validContactConnection(value: unknown, actor: string, target?: string): value is ContactConnection {
  if (!value || typeof value !== "object") return false;
  const row = value as ContactConnection;
  return contactId.test(row.id ?? "") && ["pending", "accepted", "rejected"].includes(row.status)
    && [row.sender_id, row.receiver_id].includes(actor) && row.sender_id !== row.receiver_id
    && (!target || [row.sender_id, row.receiver_id].includes(target));
}
/** Preserve old rows while exposing one consistent relationship per person. */
export function canonicalContactConnections(rows: ContactConnection[], actor: string) {
  const rank = { accepted: 2, pending: 1, rejected: 0 };
  const sorted = [...rows].filter(row => validContactConnection(row, actor)).sort((a, b) =>
    rank[b.status] - rank[a.status] || (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id.localeCompare(a.id));
  const pairs = new Map<string, ContactConnection>();
  for (const row of sorted) {
    const other = row.sender_id === actor ? row.receiver_id : row.sender_id;
    if (!pairs.has(other)) pairs.set(other, row);
  }
  return [...pairs.values()];
}
export function publicContactConnection(row: ContactConnection) {
  return { id: row.id, sender_id: row.sender_id, receiver_id: row.receiver_id, status: row.status };
}
