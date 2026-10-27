"use client";

import { useSession } from "@clerk/nextjs";
import { Fragment } from "react";

/**
 * Clear client component state when Clerk changes the active account/session.
 * This prevents a previous account's profile or inbox data lingering during a
 * multi-session switch.
 */
export default function AuthSessionBoundary({ children, initialSessionId = null }: { children: React.ReactNode; initialSessionId?: string | null }) {
  const { session, isLoaded } = useSession();
  // Hydrating the same server-verified session must not remount every private page.
  const sessionId = isLoaded ? session?.id : initialSessionId;
  return <Fragment key={sessionId ?? "signed-out"}>{children}</Fragment>;
}
