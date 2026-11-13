import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import ProjectsContent from "@/app/projects/ProjectsContent";
import { getBrowseProjects } from "@/lib/projects-browse-server";

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { alternates: { canonical: "https://www.cinegenius.co/projects" }, title: t("m_df87bfa7519b"), description: t("m_766022476504") };
}

export default async function ProjectsPage() {
  const projectsPromise = getBrowseProjects();
  const t = await getTranslations("projects");
  const projects = await projectsPromise;
  return <div className="min-h-screen bg-bg-primary">
    <PageHeader badge={t("badge")} title={t("titleLead")} titleHighlight={t("titleHighlight")} description={t("browseIntro")} cta={{ label: t("addProject"), href: "/projects/neu" }} />
    <ProjectsContent projects={projects} />
  </div>;
}
