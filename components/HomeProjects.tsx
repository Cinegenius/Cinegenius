import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Film } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import MediaImage from "@/components/MediaImage";
import HomeCardRail from "@/components/HomeCardRail";
import { getHomeProjects, type HomeProject } from "@/lib/home-projects-server";
import { projectTypeLabel } from "@/lib/project-type-labels";

async function ProjectCards() {
  const [t, ui, locale] = await Promise.all([getTranslations("home"), getTranslations(), getLocale()]);
  let projects: HomeProject[] = [];
  try { projects = await getHomeProjects(); }
  catch { console.error("[homepage] Project previews unavailable"); }
  if (!projects.length) return null;
  return <HomeCardRail id="home-projects-rail" labelledBy="home-projects-title" hint={t("projectScrollHint")} itemCount={projects.length} variant="project">
      {projects.map(project => <Link key={project.id} href={`/projects/${project.id}`} className="browse-card group flex h-full min-h-28 gap-3 rounded-xl border border-border bg-bg-secondary p-3">
        {project.poster_url ? <MediaImage src={project.poster_url} alt="" width={64} height={88} sizes="64px" className="h-[88px] w-16 shrink-0 rounded-md object-contain" /> : <span className="flex h-[88px] w-16 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-text-muted"><Film size={24} aria-hidden="true" /></span>}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-text-primary group-hover:text-gold">{project.title}</h3>
          <p className="text-xs text-text-muted">{[project.type ? projectTypeLabel(project.type, ui) : null, project.year === null ? null : new Intl.NumberFormat(locale, { useGrouping: false }).format(project.year)].filter(Boolean).join(" · ")}</p>
          {project.image_credit && <p className="line-clamp-1 text-[10px] text-text-muted" title={project.image_credit}>© {project.image_credit}</p>}
        </div>
      </Link>)}
    </HomeCardRail>;
}

export default async function HomeProjects() {
  const t = await getTranslations("home");
  return <section className="site-container py-5 sm:py-7" aria-labelledby="home-projects-title">
    <div className="home-section-divider home-section-divider--border mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-transparent pt-4">
      <h2 id="home-projects-title" className="flex items-center gap-2 font-display text-xl font-bold text-text-primary sm:text-2xl"><Film size={18} aria-hidden="true" />{t("projectsTitle")}</h2>
      <Link href="/projects/alle" className="inline-flex min-h-11 items-center gap-1 text-sm text-gold hover:text-gold-light">{t("findProjectsLink")} <ArrowRight size={13} /></Link>
    </div>
    <Suspense fallback={null}><ProjectCards /></Suspense>
  </section>;
}
