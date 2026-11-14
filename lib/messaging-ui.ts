export type MessagePerson = { id: string; name: string; avatar?: string | null; role?: string | null; location?: string | null };
export type MessageDestination = { conversationId?: string | null; recipientId?: string | null; companySlug?: string | null };
import {restoredAttachments,type MessageAttachment} from './message-attachments';
export type ChatMessage = { id: string; sender_id: string; content: string; created_at: string; read_at: string | null; attachments?:MessageAttachment[] };
export const validMessageRequestKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
export function messageDestinationKey(destination: MessageDestination) {
  return destination.conversationId ? `conversation:${destination.conversationId}` : destination.recipientId ? `recipient:${destination.recipientId}` : "";
}
export function suggestedGroupName(people: MessagePerson[], fallback: string) {
  return (people.map(person => person.name.trim()).filter(Boolean).join(", ") || fallback).slice(0, 80);
}
export function restoredMessageValue(value: Record<string, unknown>, destination: string) {
  if (value.destination !== destination || typeof value.content !== "string" || value.content.length > 5000) return null;
  const attachments=restoredAttachments(value.attachments);if(!attachments)return null;
  return { destination, content: value.content, requestKey: validMessageRequestKey(value.requestKey) ? value.requestKey : "", attachments };
}
export function restoredPeople(value: unknown): MessagePerson[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is MessagePerson => Boolean(item && typeof item.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(item.id) && typeof item.name === "string" && item.name.length <= 200 && !seen.has(item.id) && seen.add(item.id)))
    .slice(0, 49).map(({id, name}) => ({id, name}));
}

/** Known contacts remain available even when absent from public search. */
export function messagingPeople(contacts: MessagePerson[], remote: MessagePerson[], query: string, exclude: string[] = []) {
  const search = query.trim().toLocaleLowerCase();
  const local = contacts.filter(person => person.name.toLocaleLowerCase().includes(search));
  return [...new Map([...local, ...remote].map(person => [person.id, person])).values()].filter(person => !exclude.includes(person.id));
}
export const validConversationId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function confirmedChatMessage(value: unknown, accountId: string, content: string, expectedAttachments:string[]=[]): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  const files=restoredAttachments(message.attachments);
  return !!files && JSON.stringify(files.map(a=>a.id).sort())===JSON.stringify([...expectedAttachments].sort()) && validConversationId(message.id) && message.sender_id === accountId && message.content === content && typeof message.created_at === "string" && Number.isFinite(Date.parse(message.created_at)) && (message.read_at === null || typeof message.read_at === "string" && Number.isFinite(Date.parse(message.read_at)));
}
