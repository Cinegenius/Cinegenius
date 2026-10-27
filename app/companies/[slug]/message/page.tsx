import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Resolve the actual responsible account on the server; never guess a team member. */
export default async function CompanyMessagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/companies/${encodeURIComponent(slug)}/message`)}`);
  const { data: company, error } = await db.from("companies")
    .select("id,slug,name,owner_user_id,published").eq("slug", slug).maybeSingle();
  const t = await getTranslations("companyMessages");
  if (error) throw new Error(t("unavailable"));
  if (!company || company.published !== true) notFound();
  if (company.owner_user_id === userId) redirect("/company-dashboard");
  if (typeof company.owner_user_id !== "string" || !company.owner_user_id.trim()) {
    return <p role="status" className="site-container py-24 text-text-secondary">{t("noContact")}</p>;
  }
  const query = new URLSearchParams({ to: company.owner_user_id, company_slug: company.slug });
  redirect(`/messages?${query}`);
}
