"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Building2, CalendarDays, Camera, Clapperboard, Film, Megaphone, Music2, Smartphone, Tv, Video } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import { projectTypeLabel } from "@/lib/project-type-labels";
import type { BrowseProject } from "@/lib/projects-browse";
import styles from "./NativeProjectResults.module.css";

const appearances = {
  feature: { hue: 276, icon: Film }, short: { hue: 212, icon: Clapperboard },
  series: { hue: 145, icon: Tv }, documentary: { hue: 42, icon: Video },
  advertising: { hue: 335, icon: Megaphone }, music: { hue: 12, icon: Music2 },
  corporate: { hue: 188, icon: Building2 }, photo: { hue: 230, icon: Camera },
  social: { hue: 305, icon: Smartphone }, event: { hue: 25, icon: CalendarDays },
  neutral: { hue: 210, icon: Clapperboard },
} as const;
type Tone = keyof typeof appearances;
const types: Readonly<Record<string, Tone>> = {
  spielfilm: "feature", film: "feature", kurzfilm: "short", serie: "series", "tv / serie": "series", "tv / episodic": "series", "serie / tv": "series",
  dokumentation: "documentary", dokumentarfilm: "documentary", reportage: "documentary",
  werbung: "advertising", werbefilm: "advertising", "werbefilm / commercial": "advertising", commercial: "advertising", spot: "advertising",
  musikvideo: "music", corporate: "corporate", "corporate film": "corporate", "corporate video": "corporate", imagefilm: "corporate",
  foto: "photo", "foto / shooting": "photo", fotografie: "photo", "fashion shooting": "photo", "produkt-shooting": "photo", "event-fotografie": "photo", "hochzeits-fotografie": "photo", "portrait-shooting": "photo", "werbe-fotografie": "photo",
  "social media": "social", "social media content": "social", "instagram / reels": "social", tiktok: "social", youtube: "social", "ugc content": "social", "brand content": "social",
  event: "event", "event / live": "event",
};

/** Fixed known format identities only; arbitrary member-written types stay neutral. */
export function nativeProjectTone(type: string | null): Tone {
  const key = type?.trim().toLowerCase() ?? "";
  return Object.hasOwn(types, key) ? types[key] : "neutral";
}

export default function NativeProjectResults({ projects, view }: { projects: BrowseProject[]; view: "list" | "grid" }) {
  const t = useTranslations("projects"), ui = useTranslations(), locale = useLocale();
  return <ul role="list" className={`${styles.results} ${view === "grid" ? styles.grid : styles.list}`} data-native-projects={view}>
    {projects.map(project => {
      const tone = nativeProjectTone(project.type), { hue, icon: Icon } = appearances[tone];
      const initials = project.title.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? "").join("").toLocaleUpperCase(locale);
      const country = project.place_country_code;
      return <li key={project.id} className={styles.item} data-native-project-tone={tone}
        style={{ "--project-hue": hue, "--project-saturation": tone === "neutral" ? "0%" : "50%" } as CSSProperties}>
        <Link href={`/projects/${project.id}`} className={styles.card} data-native-project-id={project.id}>
          <span className={styles.poster} data-project-poster={project.poster_url ? "image" : "fallback"} aria-hidden="true">
            {project.poster_url ? <MediaImage src={project.poster_url} alt="" fill sizes={view === "grid" ? "(max-width: 639px) 50vw, 33vw" : "44px"} className={styles.posterImage} />
              : <span className={styles.fallback}><Icon size={20} aria-hidden="true" />{initials && <span>{initials}</span>}</span>}
          </span>
          <div className={styles.body}>
            {project.type && <span className={styles.type}><Icon size={14} aria-hidden="true" /><span>{projectTypeLabel(project.type, ui)}</span></span>}
            <h2 className={styles.title}>{project.title}</h2>
            {(project.year !== null || country) && <span className={styles.facts}>
              {project.year !== null && <span><span className={styles.srOnly}>{t("colYear")}: </span>{project.year}</span>}
              {country && <span>{ui.has(`CountryNames.${country}`) ? ui(`CountryNames.${country}`) : country}</span>}
            </span>}
            {project.director && <span className={styles.director}><span className={styles.label}>{t("colDirector")}: </span>{project.director}</span>}
            {project.crew_count > 0 && <span className={styles.credits} title={t("creditsCountHint")}>{t("creditCount", { count: project.crew_count })}</span>}
          </div>
        </Link>
      </li>;
    })}
  </ul>;
}
