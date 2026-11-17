import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import DirectoryPage from "@/components/DirectoryPage";
import PageHeader from "@/components/PageHeader";
import CommunityBoard from "@/components/CommunityBoard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("boardPageHeading"), description: t("boardPageDescription") };
}

export default async function CommunityPage() {
  const [{ userId }, t] = await Promise.all([auth(), getTranslations("home")]);

  return (
    <DirectoryPage area="community">
      <PageHeader withBackdrop={false} badge={t("boardLabel")} title={t("boardPageHeading")} description={t("boardPageDescription")} />
      <CommunityBoard fullPage loggedIn={!!userId} />
    </DirectoryPage>
  );
}
