"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, Star, Users, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { inboxHomies, navigateInboxView, type InboxView } from "@/lib/message-navigation";
import styles from "./NativeInboxShortcuts.module.css";

/** Shortcuts expose existing account-scoped inbox data, never a second contact source. */
export default function NativeInboxShortcuts({ active }: { active: InboxView }) {
  const params = useSearchParams(), homies = inboxHomies(params);
  const t = useTranslations("InboxNavigation"), contacts = useTranslations("Contacts"), app = useTranslations("NativeAppChrome");
  const { leave } = useFormNavigation();
  const items = [
    { id: "homies", view: "friends", label: contacts("homies"), href: "/messages?view=friends&homies=1", icon: Star, selected: active === "friends" && homies },
    { id: "colleagues", view: "friends", label: app("colleagues"), href: "/messages?view=friends", icon: UsersRound, selected: active === "friends" && !homies },
    { id: "groups", view: "groups", label: t("groups"), href: "/messages?view=groups", icon: Users, selected: active === "groups" },
    { id: "notices", view: "notices", label: t("notices"), href: "/messages?view=notices", icon: Bell, selected: active === "notices" },
  ] as const;
  return <nav className={styles.shortcuts} aria-label={t("chats")} data-native-inbox-shortcuts="v1">
    {items.map(item => <Link key={item.id} href={item.href} prefetch={false} scroll={false} aria-label={item.label} aria-current={item.selected ? "page" : undefined}
      onClick={event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.location.pathname !== "/messages") return;
        event.preventDefault();
        leave(() => navigateInboxView(window, item.view, { homies: item.id === "homies", nativeGroups: true }));
      }}><item.icon size={17} aria-hidden="true" />{item.id !== "notices" && <span>{item.label}</span>}</Link>)}
  </nav>;
}
