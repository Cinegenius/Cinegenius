import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequiredSetupEntry } from "@/lib/profile-setup-entry-server";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const returnPath = safeAuthRedirect((await headers()).get("X-CineGenius-Return-Path") ?? undefined, "/dashboard");
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`);
  let setup: string | null;
  try { setup = await getRequiredSetupEntry(userId); }
  catch {
    return <section className="mx-auto max-w-xl px-4 py-24"><h1 className="font-display text-2xl font-bold">Dein Einrichtungsstand konnte nicht geladen werden.</h1><p className="mt-3 text-sm leading-6 text-text-muted">Deine Eingaben bleiben gespeichert. Bitte prüfe den Status erneut, damit wir dich zum richtigen Schritt führen können.</p><a href={returnPath} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Erneut prüfen</a></section>;
  }
  if (setup) {
    const destination = new URL(setup, "https://cinegenius.co");
    destination.searchParams.set("redirect", returnPath);
    redirect(`${destination.pathname}${destination.search}`);
  }
  return <>{children}</>;
}
