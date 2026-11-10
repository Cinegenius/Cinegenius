import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ListingFreshnessStatus from "@/components/ListingFreshnessStatus";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("ListingFreshness");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ListingStatusPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const initialAction = query.action === "renew" || query.action === "end" ? query.action : undefined;
  const returnTo = `/listing-status/${encodeURIComponent(id)}${initialAction ? `?action=${initialAction}` : ""}`;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  return <ListingFreshnessStatus key={id} listingId={id} initialAction={initialAction} />;
}
