import { Suspense } from "react";
import GuidedProfileWizard from "@/components/GuidedProfileWizard";
import { useTranslations } from "next-intl";


export default function GuidedProfilePage() {
  const uiText = useTranslations();

  return <Suspense fallback={<main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">{uiText("Ui.text_4d7de5b67ab6dd")}</main>}><GuidedProfileWizard /></Suspense>;
}
