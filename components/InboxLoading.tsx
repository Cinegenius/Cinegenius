"use client";

import { useTranslations } from "next-intl";
import InboxPaneHeader from "@/components/InboxPaneHeader";

export default function InboxLoading({ active }: { active: "chats" | "notices" }) {
  const t = useTranslations();
  return <div className={`inbox-shell bottom-[var(--mobile-nav-clearance)] lg:bottom-0 ${active === "notices" ? "flex-col sm:flex-row" : ""}`}>
    <aside className="flex min-w-0 w-full shrink-0 flex-col border-r border-border sm:w-80">
      <InboxPaneHeader active={active}>
        {active === "chats" && <div aria-hidden="true" className="mt-2 h-11 rounded-xl border border-border bg-bg-secondary" />}
      </InboxPaneHeader>
      {active === "chats" && <p role="status" className="px-4 py-8 text-sm text-text-muted">{t("Ui.text_9767238939207a")}</p>}
    </aside>
    {active === "notices" && <p role="status" className="min-w-0 flex-1 p-4 text-sm text-text-muted">{t("Ui.text_9767238939207a")}</p>}
  </div>;
}
