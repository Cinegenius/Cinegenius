"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import InboxNavigation from "@/components/InboxNavigation";

/** One conversation inbox; secondary utilities retain a clear return route. */
export default function InboxPaneHeader({ active, action, children }: {
  active: "chats" | "groups" | "notices" | "friends";
  action?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations("nav");
  const contacts = useTranslations("Contacts");
  const inbox = useTranslations("InboxNavigation");
  const title = active === "friends" ? contacts("title") : active === "notices" ? inbox("notices") : t("messages");
  return <header className="shrink-0 border-b border-border px-4 py-3">
    <InboxNavigation active={active} />
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-3">
      <h1 className="min-w-0 break-words text-xl font-semibold text-text-primary">{title}</h1>
      {action && <div className="flex min-h-11 shrink-0 items-center justify-center">{action}</div>}
    </div>
    {children}
  </header>;
}
