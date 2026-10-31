"use client";

import { useClerk, useSession } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

function SessionTransition() {
  const t = useTranslations("SessionTransition");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p role="status" className="flex items-center gap-2 text-text-secondary">
        <Loader2 size={18} className="animate-spin text-gold motion-reduce:animate-none" aria-hidden="true" />
        {t("loading")}
      </p>
      {/* A recovery click must fetch a new server tree even if Clerk navigation failed. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="inline-flex min-h-11 items-center text-sm text-gold hover:underline">
        {t("home")}
      </a>
    </div>
  );
}

/**
 * Clear client component state when Clerk changes the active account/session.
 * This prevents a previous account's profile or inbox data lingering during a
 * multi-session switch.
 */
export default function AuthSessionBoundary({ children, initialSessionId = null }: { children: React.ReactNode; initialSessionId?: string | null }) {
  const { session, isLoaded } = useSession();
  const clerk = useClerk();
  // Clerk clears the client session before its sign-out request/navigation has
  // finished. Do not remount the old server-authenticated page as a guest in
  // that gap: its mount effects and Link prefetches would start again while
  // the document is being replaced. The server refresh supplies the new tree.
  // During sign-out Clerk first emits session=undefined (isLoaded=false).
  // Its loaded instance distinguishes that gap from initial SDK hydration.
  if ((isLoaded || clerk.loaded) && !session && initialSessionId) return <SessionTransition />;
  // Hydrating the same server-verified session must not remount every private page.
  const sessionId = isLoaded ? session?.id : initialSessionId;
  return <Fragment key={sessionId ?? "signed-out"}>{children}</Fragment>;
}
