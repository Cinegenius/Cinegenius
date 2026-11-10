import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_b4f83e2e6b86'),
  robots: { index: false, follow: false },
};
}

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
