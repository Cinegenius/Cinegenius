import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_4f2308fdddb2'),
  robots: { index: false, follow: false },
};
}

export default function ProfileEditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
