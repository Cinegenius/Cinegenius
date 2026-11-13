import { getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import ProjectsContent from "@/app/projects/ProjectsContent";
import { getBrowseProjects } from "@/lib/projects-browse-server";
import { canonicalProjectCategoryId } from "@/lib/project-category-filter";

export interface CategoryConfig {
  slug: string;
  label: string;
  headline: string;
  highlight: string;
  description: string;
  image: string;
  imagePosition?: string;
  typeKeywords: string[];
  badge: string;
}

export default async function ProjectCategoryPage({ config }: { config: CategoryConfig }) {
  const [t, projects] = await Promise.all([getTranslations(), getBrowseProjects()]);
  return <DirectoryPage area="projects">
    <PageHeader withBackdrop={false} badge={config.badge} title={config.headline} titleHighlight={config.highlight} description={config.description}
      cta={{ label: t("projects.addProject"), href: "/projects/neu" }} ctaSecondary={{ label: t("common.allProjects"), href: "/projects" }} />
    <ProjectsContent projects={projects} category={canonicalProjectCategoryId(config.slug)} />
  </DirectoryPage>;
}
