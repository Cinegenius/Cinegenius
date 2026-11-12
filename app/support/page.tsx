import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SupportContactForm from "@/components/SupportContactForm";

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fsupport");
  const t = await getTranslations("SupportContact");
  return <div className="min-h-screen bg-bg-primary pb-[calc(7rem+env(safe-area-inset-bottom))]">
    <PageHeader badge={t("badge")} title={t("title")} description={t("description")} />
    <div className="site-container py-6 sm:py-8">
      <SupportContactForm key={user.userId} accountId={user.userId} />
    </div>
  </div>;
}
