"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const INTERVAL_MS = 2 * 60 * 1000; // ping every 2 minutes

export default function PresencePing() {
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!isSignedIn) return;

    // Only ping when the tab is actually visible — prevents showing as online
    // when the user has the tab open in the background
    const ping = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/presence", { method: "POST" }).catch(() => {});
      }
    };

    ping();

    const id = setInterval(ping, INTERVAL_MS);

    // Also ping immediately when user switches back to this tab
    document.addEventListener("visibilitychange", ping);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [isSignedIn]);

  return null;
}
