import { Suspense } from "react";
import GuidedProfileWizard from "@/components/GuidedProfileWizard";

export default function GuidedProfilePage() {
  return <Suspense fallback={<main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">Dein Profilstart wird geladen …</main>}><GuidedProfileWizard /></Suspense>;
}
