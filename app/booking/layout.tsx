import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  title: tMetadata('m_ca31c86794a3'),
  robots: { index: false, follow: false },
};
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
