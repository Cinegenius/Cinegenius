import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileSetupWizard from "@/components/ProfileSetupWizard";

export default async function ProfileSetupPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Fprofile-setup");
  return <Suspense fallback={<main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">Dein Start wird geladen …</main>}><ProfileSetupWizard /></Suspense>;
}
