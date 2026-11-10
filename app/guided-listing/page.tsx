import { Suspense } from "react";
import GuidedListingWizard from "@/components/GuidedListingWizard";
import { useTranslations } from "next-intl";


export default function GuidedListingPage() {
  const uiText = useTranslations();

  return <Suspense fallback={<main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">{uiText("Ui.text_9b8f67714a0bda")}</main>}><GuidedListingWizard /></Suspense>;
}
