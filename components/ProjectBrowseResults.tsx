"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clapperboard } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import { projectTypeLabel } from "@/lib/project-type-labels";
import type { BrowseProject } from "@/lib/projects-browse";

/** The same project facts reflow from a filmography row to a compact card. */
export default function ProjectBrowseResults({ projects, view }: {
  projects: BrowseProject[];
  view: "list" | "grid";
}) {
  const t = useTranslations("projects");
  const ui = useTranslations();

  return <div className={`browse-directory browse-directory--${view} ${view === "list" ? "browse-card" : ""}`}>
    {view === "list" && <div className="browse-directory__head" aria-hidden="true">
      <span>{t("colYear")}</span><span>{t("colTitle")}</span><span>{t("colType")}</span>
      <span>{t("colDirector")}</span><span title={t("creditsCountHint")}>{t("colCredits")}</span>
    </div>}
    <ul className="browse-directory__items" role="list">
      {projects.map(project => <li key={project.id} className={view === "grid" ? "browse-card" : undefined}>
        <Link href={`/projects/${project.id}`} className="browse-directory__row">
          <span className="browse-directory__year"><span className="sr-only">{t("colYear")}: </span>{project.year ?? "—"}</span>
          <div className="browse-directory__identity">
            <span className={`browse-directory__poster ${project.poster_url ? "" : "browse-directory__poster--empty"}`}>
              {project.poster_url
                ? <MediaImage src={project.poster_url} alt="" width={48} height={68} className="h-full w-full object-cover" />
                : <Clapperboard size={20} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h2 className="browse-directory__title">{project.title}</h2>
              <p className="browse-directory__facts">
                {project.year !== null && <span>{project.year}</span>}
                {project.type && <span>{projectTypeLabel(project.type, ui)}</span>}
              </p>
            </div>
          </div>
          <span className="browse-directory__type"><span className="sr-only">{t("colType")}: </span>{project.type ? projectTypeLabel(project.type, ui) : "—"}</span>
          <div className="browse-directory__details">
            <span className={`browse-directory__director ${project.director ? "" : "browse-directory__director--empty"}`}>
              {project.director ? <><span className="browse-directory__director-label">{t("colDirector")}: </span>{project.director}</> : "—"}
            </span>
            <span className={`browse-directory__credits ${project.crew_count ? "" : "browse-directory__credits--empty"}`} title={t("creditsCountHint")}>
              {project.crew_count ? t("creditCount", { count: project.crew_count }) : "—"}
            </span>
          </div>
        </Link>
      </li>)}
    </ul>
  </div>;
}
