"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const INTERVAL_MS = 2 * 60 * 1000; // ping every 2 minutes

export default function PresencePing() {
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!isSignedIn) return;

    const ping = () => fetch("/api/presence", { method: "POST" }).catch(() => {});
    ping();

    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, [isSignedIn]);

  return null;
}
