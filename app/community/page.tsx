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
      <header className="relative isolate overflow-hidden border-b border-border px-4 pb-6 pt-24 sm:px-6 sm:pb-10 sm:pt-28">
        <div aria-hidden="true" className="absolute inset-0 bg-cover bg-[center_42%]" style={{ backgroundImage: "url('/hero-bg.jpg')" }} />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-bg-primary/90 via-bg-primary/78 to-bg-primary/58" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-bg-primary/40 via-transparent to-bg-primary/90" />
        <div className="relative z-10 mx-auto max-w-5xl">
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
