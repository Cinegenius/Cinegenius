import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ProjectsPage from "@/app/projects/page";

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { alternates: { canonical: "https://www.cinegenius.co/projects/alle" }, title: t("m_1e8f7f76eb11"), description: t("m_59b147ab3a40") };
}
export default ProjectsPage;
