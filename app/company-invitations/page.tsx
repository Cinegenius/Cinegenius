import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CompanyMemberInvitations } from "@/components/CompanyMemberInvitations";
import { getTranslations } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return { title: tMetadata('m_32063e627aef'), robots: { index: false, follow: false } };
}
export default async function CompanyInvitationsPage() {
  const uiText = await getTranslations();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Fcompany-invitations");
  return <main className="site-container min-h-screen pb-28 pt-28"><h1 className="mb-4 font-display text-3xl text-text-primary">{uiText("Ui.text_62023503e7185e")}</h1><p className="mb-6 max-w-2xl text-sm text-text-muted">{uiText("Ui.text_e5ea9f9a00e4fc")}</p><CompanyMemberInvitations mode="received" /></main>;
}
