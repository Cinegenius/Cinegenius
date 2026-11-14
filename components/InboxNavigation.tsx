"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { navigateInboxView, type InboxView } from "@/lib/message-navigation";

export default function InboxNavigation({ active }: { active: InboxView }) {
  const t = useTranslations("InboxNavigation");
  const { leave } = useFormNavigation();
  const nav = useTranslations("nav");
  return <nav aria-label={nav("messages")} className="mt-3 grid grid-cols-2 min-[480px]:grid-cols-4 sm:grid-cols-2 gap-1 rounded-xl border border-border bg-bg-secondary p-1">
    {([{ id: "chats", href: "/messages" }, { id: "notices", href: "/messages?view=notices" }, { id: "friends", href: "/messages?view=friends" }, { id: "groups", href: "/messages?view=groups" }] as const).map(item => <Link
      key={item.id} href={item.href} prefetch={false} scroll={false}
      onClick={event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.location.pathname !== "/messages") return;
        event.preventDefault();
        leave(() => navigateInboxView(window, item.id));
      }} aria-current={active === item.id ? "page" : undefined}
      className={`flex min-h-11 min-w-0 items-center justify-center break-words rounded-lg px-2 py-2 text-center text-sm font-medium ${active === item.id ? "bg-gold/10 text-gold" : "text-text-muted hover:text-text-primary"}`}
    >{t(item.id)}</Link>)}
  </nav>;
}
