import { Suspense } from "react";
import GuidedListingWizard from "@/components/GuidedListingWizard";

export default function GuidedListingPage() {
  return <Suspense fallback={<main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">Einrichtung wird geladen …</main>}><GuidedListingWizard /></Suspense>;
}
