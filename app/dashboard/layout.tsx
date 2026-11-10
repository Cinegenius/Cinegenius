import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequiredSetupEntry } from "@/lib/profile-setup-entry-server";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { getTranslations } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_67b696468610'),
  robots: { index: false, follow: false },
};
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const uiText = await getTranslations();

  const returnPath = safeAuthRedirect((await headers()).get("X-CineGenius-Return-Path") ?? undefined, "/dashboard");
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`);
  let setup: string | null;
  try { setup = await getRequiredSetupEntry(userId); }
  catch {
    return <section className="mx-auto max-w-xl px-4 py-24"><h1 className="font-display text-2xl font-bold">{uiText("Ui.text_3fd2ffa9bff532")}</h1><p className="mt-3 text-sm leading-6 text-text-muted">{uiText("Ui.text_8cc701ff56167d")}</p><a href={returnPath} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{uiText("Ui.text_7da626487f352e")}</a></section>;
  }
  if (setup) {
    const destination = new URL(setup, "https://cinegenius.co");
    destination.searchParams.set("redirect", returnPath);
    redirect(`${destination.pathname}${destination.search}`);
  }
  return <>{children}</>;
}
