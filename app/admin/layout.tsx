import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/requireAdmin";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_c1c224b03cd9'),
  robots: { index: false, follow: false },
};
}

/**
 * Server-side layout guard for all /admin pages.
 * The middleware.ts already blocks non-admins before this runs,
 * but this acts as a defence-in-depth second layer.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdminSession();
  if (!admin) redirect("/");
  return <>{children}</>;
}
