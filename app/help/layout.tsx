import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/help" },
  title: tMetadata('m_fc11eaec134a'),
  description: tMetadata('m_e656680dfaa5'),
};
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
