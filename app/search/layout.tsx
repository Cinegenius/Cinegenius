import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_a4f2922e2d95'),
  description: tMetadata('m_94b147884a71'),
};
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
