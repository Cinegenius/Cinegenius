import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_d436eb0ca11c'),
  robots: { index: false, follow: false },
};
}

export default function InseratLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
