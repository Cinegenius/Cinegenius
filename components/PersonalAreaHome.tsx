"use client";

import { useContext } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { ChevronRight, ShieldCheck } from "lucide-react";
import NavigationIcon from "@/components/NavigationIcon";
import { PERSONAL_ACTIVITY_ITEMS, PERSONAL_CONTENT_ITEMS } from "@/lib/site-navigation";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { useAdminSupportUnread } from "@/lib/use-admin-support-unread";

/** One compact home for account management; every row opens its canonical flow. */
export default function PersonalAreaHome() {
  const t = useTranslations("nav"), area = useTranslations("PersonalArea"), feedback = useTranslations("Feedback");
  const { userId, isLoaded, isSignedIn } = useAuth();
  const serverAdminId = useContext(ServerAdminContext);
  const adminId = isLoaded && isSignedIn && userId && userId === serverAdminId ? userId : null;
  const support = useAdminSupportUnread(adminId);
  const groups = [
    { title: area("content"), items: PERSONAL_CONTENT_ITEMS },
    { title: area("activity"), items: PERSONAL_ACTIVITY_ITEMS },
  ];
  return <div className="space-y-6">
    {groups.map(group => <section key={group.title}>
      <h2 className="mb-2 px-1 text-sm font-semibold text-text-muted">{group.title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-secondary">
        {group.items.map(item => <Link key={item.id} href={item.href} prefetch={false}
          className="flex min-h-14 min-w-0 items-center gap-3 px-4 py-3 text-sm text-text-primary transition-colors hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-gold focus-visible:-outline-offset-2">
          <NavigationIcon name={item.icon} size={20} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1 break-words">{item.id === "profile" ? area("editProfile") : t(item.key)}</span>
          <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-text-muted" />
        </Link>)}
      </div>
    </section>)}
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-secondary">
      <Link href="/dashboard?tab=settings" prefetch={false} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-elevated">
        <NavigationIcon name="settings" size={20} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 break-words">{area("settings")}</span><ChevronRight size={17} aria-hidden="true" className="shrink-0 text-text-muted" />
      </Link>
      {adminId && <Link href="/admin" prefetch={false} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-elevated">
        <ShieldCheck size={20} aria-hidden="true" className="shrink-0 text-text-muted" /><span className="min-w-0 flex-1 break-words">{t("adminArea")}</span>
        {support.count != null && support.count > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-bg-primary">{support.count > 99 ? "99+" : support.count}</span>}
        <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-text-muted" />
      </Link>}
    </div>
    <Link href="/mitgestalten" prefetch={false} className="inline-flex min-h-11 items-center px-1 text-sm text-text-muted hover:text-gold focus-visible:outline-2 focus-visible:outline-gold">{feedback("link")}</Link>
  </div>;
}
