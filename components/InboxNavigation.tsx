"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { navigateInboxView, type InboxView } from "@/lib/message-navigation";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import NativeInboxShortcuts from "@/components/app/NativeInboxShortcuts";

/** Contacts and notices are utility destinations, never competing inbox tabs. */
export default function InboxNavigation({ active, part = "all" }: { active: InboxView; part?: "all" | "shortcuts" | "back" }) {
  const { leave } = useFormNavigation();
  const nav = useTranslations("nav");
  const nativeAppearance = useNativeAppAppearance();
  const shortcuts = nativeAppearance && part !== "back" ? <NativeInboxShortcuts active={active} /> : null;
  if (part === "shortcuts") return shortcuts;
  if (active !== "friends" && active !== "notices" && !(nativeAppearance && active === "groups")) return shortcuts;
  return <>{shortcuts}<Link aria-label={nav("messages")} href="/messages" prefetch={false} scroll={false}
    onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.location.pathname !== "/messages") return;
      event.preventDefault();
      leave(() => navigateInboxView(window, "chats"));
    }} className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary ${nativeAppearance ? "justify-center" : "mb-1 pr-3"}`}>
    <ArrowLeft size={18} aria-hidden="true" /><span className={nativeAppearance ? "sr-only" : undefined}>{nav("messages")}</span>
  </Link></>;
}
