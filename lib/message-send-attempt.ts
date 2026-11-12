export type MessageSendAttempt = { signature: string; content: string; key: string };
export function restoredSendAttempt(value: unknown): MessageSendAttempt | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return typeof item.signature === "string" && typeof item.content === "string" && item.content.length <= 5000
    && typeof item.key === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(item.key)
    ? { signature: item.signature, content: item.content, key: item.key } : null;
}
/** Locale changes do not rewrite a retry's already prepared message. */
export function prepareMessageSend(previous: MessageSendAttempt | null, signature: string, content: string): MessageSendAttempt {
  return previous?.signature === signature ? previous : { signature, content, key: crypto.randomUUID() };
}
