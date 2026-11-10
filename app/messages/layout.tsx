import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_1fd65f7e85bb'),
  robots: { index: false, follow: false },
};
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
