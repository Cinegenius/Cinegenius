import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_8f83e788e841'),
  robots: { index: false, follow: false },
};
}

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
