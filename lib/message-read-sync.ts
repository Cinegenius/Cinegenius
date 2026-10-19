const MESSAGE_READ_EVENT = "cinegenius:messages-read";
const MESSAGE_READ_CHANNEL = "cinegenius:message-read-sync";
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type MessageReadSyncPayload = { userId: string; senderTabId: string };

export function notifyMessagesRead(userId: string) {
  if (typeof window === "undefined") return;
  const payload: MessageReadSyncPayload = { userId, senderTabId: TAB_ID };
  window.dispatchEvent(new CustomEvent(MESSAGE_READ_EVENT, { detail: payload }));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(MESSAGE_READ_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  }
}

export function subscribeToMessageReads(userId: string, onRead: () => void) {
  if (typeof window === "undefined") return () => {};
  const onLocalRead = (event: Event) => {
    const payload = (event as CustomEvent<MessageReadSyncPayload>).detail;
    if (payload?.userId === userId) onRead();
  };
  window.addEventListener(MESSAGE_READ_EVENT, onLocalRead);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(MESSAGE_READ_CHANNEL);
    channel.addEventListener("message", (event: MessageEvent<MessageReadSyncPayload>) => {
      if (event.data?.userId === userId && event.data.senderTabId !== TAB_ID) onRead();
    });
  }

  return () => {
    window.removeEventListener(MESSAGE_READ_EVENT, onLocalRead);
    channel?.close();
  };
}
