"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LegalLanguageNotice from "@/components/LegalLanguageNotice";
import { PageBackdrop } from "@/components/PageHeader";

export default function GuestChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("footer");
  return <div className="relative isolate flex min-h-dvh flex-1 flex-col">
    <PageBackdrop image="/hero-bg-v2.jpg" imageOpacity={100} overlayClassName="absolute inset-0 bg-bg-primary/85" className="pointer-events-none fixed inset-0 z-[-1]" />
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/50 bg-bg-primary/95 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2.5" aria-label="CineGenius">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="5.5,4 18.5,12 5.5,20" stroke="var(--color-gold)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="font-sans text-lg leading-none"><span className="font-medium text-text-primary">Cine</span><span className="font-bold text-gold">Genius</span></span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
    <main className="flex-1 min-w-0 pt-[env(safe-area-inset-top)]"><LegalLanguageNotice />{children}</main>
    <footer className="mx-auto w-full max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-text-muted">
      <nav className="flex flex-wrap justify-center gap-x-4">
        <Link href="/impressum" className="inline-flex min-h-11 items-center hover:text-gold">{t("links_imprint")}</Link>
        <Link href="/datenschutz" className="inline-flex min-h-11 items-center hover:text-gold">{t("links_privacy")}</Link>
        <Link href="/agb" className="inline-flex min-h-11 items-center hover:text-gold">{t("links_terms")}</Link>
        <a href="mailto:hello@cinegenius.co" className="inline-flex min-h-11 items-center hover:text-gold">hello@cinegenius.co</a>
      </nav>
    </footer>
  </div>;
}
