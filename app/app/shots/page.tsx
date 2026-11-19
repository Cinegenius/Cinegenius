import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ShotsExperience from "@/components/app/ShotsExperience";

export async function generateMetadata() { const t = await getTranslations("AppShots"); return { title: t("title"), robots: { index: false, follow: false } }; }

export default async function AppShotsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Fapp%2Fshots");
  return <ShotsExperience />;
}
