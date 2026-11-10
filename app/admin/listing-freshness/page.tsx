import { getTranslations } from "next-intl/server";
import AdminListingFreshness from "@/components/admin/AdminListingFreshness";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("AdminListingFreshness");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function ListingFreshnessAdminPage() {
  return <AdminListingFreshness />;
}
