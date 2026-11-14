"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import InboxNavigation from "@/components/InboxNavigation";

/** The same title and navigation geometry for chats, notices and loading. */
export default function InboxPaneHeader({ active, action, children }: {
  active: "chats" | "groups" | "notices";
  action?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations("nav");
  return <header className="shrink-0 border-b border-border px-4 py-3">
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-3">
      <h1 className="min-w-0 break-words font-display text-xl font-bold text-text-primary">{t("messages")}</h1>
      <div className="flex size-11 shrink-0 items-center justify-center">{action}</div>
    </div>
    <InboxNavigation active={active} />
    {children}
  </header>;
}
