"use client";

import { useSession } from "@clerk/nextjs";
import { Fragment } from "react";

/**
 * Clear client component state when Clerk changes the active account/session.
 * This prevents a previous account's profile or inbox data lingering during a
 * multi-session switch.
 */
export default function AuthSessionBoundary({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  return <Fragment key={session?.id ?? "signed-out"}>{children}</Fragment>;
}
