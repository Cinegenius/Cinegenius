"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { createInboxPolling, type InboxSnapshot } from "@/lib/inbox-polling";
import { subscribeToMessageReads } from "@/lib/message-read-sync";
import { publishUnreadCount } from "@/lib/unread-count-store";

export function useAuthenticatedInbox() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const { session, isLoaded: sessionLoaded } = useSession();
  const active = isLoaded && sessionLoaded && isSignedIn && !!userId && !!sessionId
    && session?.status === "active" && session.id === sessionId && session.user.id === userId;
  const key = active ? `${userId}:${sessionId}` : null;
  const [data, setData] = useState<{ key: string; snapshot: InboxSnapshot } | null>(null);
  const current = useRef<{ key: string; poll: ReturnType<typeof createInboxPolling> } | null>(null);

  useEffect(() => {
    if (!key || !userId || !sessionId) {
      publishUnreadCount(null, 0);
      return;
    }
    const poll = createInboxPolling({ userId, sessionId }, getToken);
    current.current = { key, poll };
    const unsubscribe = poll.subscribe(() => {
      const snapshot = poll.getSnapshot();
      setData({ key, snapshot });
      // Unknown/error is not published as a successful zero-count response.
      if (snapshot.status === "ready" && snapshot.count !== null) publishUnreadCount(userId, snapshot.count);
      else if (snapshot.status === "expired") publishUnreadCount(null, 0);
    });
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void poll.refresh();
    };
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    const unsubscribeReads = subscribeToMessageReads(userId, () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void poll.refreshAfterMessageRead();
    });
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      current.current = null;
      unsubscribe();
      unsubscribeReads();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      poll.stop();
      publishUnreadCount(null, 0);
    };
  }, [getToken, key, sessionId, userId]);

  const refresh = useCallback((retry = false) => current.current?.key === key
    ? current.current.poll.refresh(retry) : Promise.resolve(), [key]);
  const markRead = useCallback((id?: string) => current.current?.key === key
    ? current.current.poll.markRead(id) : Promise.resolve(false), [key]);
  const snapshot: InboxSnapshot = key && data?.key === key ? data.snapshot : {
    status: !isLoaded || !sessionLoaded || active ? "loading" : isSignedIn ? "expired" : "idle",
    count: null, notifications: [],
  };
  return { ...snapshot, refresh, markRead };
}

export type AuthenticatedInbox = ReturnType<typeof useAuthenticatedInbox>;
