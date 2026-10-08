import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { MessageSquareText } from "lucide-react";
import CommunityBoard from "@/components/CommunityBoard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("boardPageHeading"), description: t("boardPageDescription") };
}

export default async function CommunityPage() {
  const [{ userId }, t] = await Promise.all([auth(), getTranslations("home")]);

  return (
    <main className="min-h-[70vh]">
      <header className="border-b border-border bg-gradient-to-br from-gold/[0.07] via-bg-secondary/50 to-transparent px-4 pb-6 pt-24 sm:px-6 sm:pb-10 sm:pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <MessageSquareText size={15} />{t("boardLabel")}
          </p>
          <h1 id="community-board-title" className="font-display text-2xl font-bold text-text-primary sm:text-4xl">
            {t("boardPageHeading")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
            {t("boardPageDescription")}
          </p>
        </div>
      </header>
      <CommunityBoard fullPage loggedIn={!!userId} />
    </main>
  );
}
