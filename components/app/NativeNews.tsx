"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Building2, ChevronRight, Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";
import MediaImage from "@/components/MediaImage";
import DirectoryViewControls, { type DirectoryView } from "@/components/DirectoryViewControls";
import NewsBrowseControls, { type NewsBrowseControlsProps } from "@/app/news/NewsBrowseControls";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useViewState } from "@/lib/use-view-state";
import { hasCoordinates } from "@/lib/location-map";
import styles from "./NativeNews.module.css";
import type { PublicOrganization } from "@/lib/organization-discovery";

export type NativeNewsEntry = {
  id: string; href: string; title: string; summary: string | null; image: string | null;
  typeLabel: string; topicLabel: string; organization: string; city: string;
  startsAt: string | null; dateLabel: string; ended: boolean;
  lat: number | null; lng: number | null;
};
type Props = {
  controls: NewsBrowseControlsProps; entries: NativeNewsEntry[]; page: number;
  previousHref: string | null; nextHref: string | null; children: ReactNode;
  organizations?: PublicOrganization[]; organizationsUnavailable?: boolean; organizationsHref?: string;
};
function LoadingMap() {
  const t = useTranslations();
  return <p role="status">{t("Ui.text_8cd626fb7674ab")}</p>;
}
const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false, loading: LoadingMap });

/** Existing server-approved page only; presentation never creates or geocodes news. */
export default function NativeNews({ controls, entries, page, previousHref, nextHref, children,
  organizations = [], organizationsUnavailable = false, organizationsHref = "/organizations" }: Props) {
  const native = useNativeAppAppearance();
  const [view, setView] = useViewState<DirectoryView>("news.view", "grid");
  const t = useTranslations("Organizations"), news = useTranslations("NativeNews");
  const discovery = useTranslations("OrganizationDiscovery"), mapText = useTranslations("directoryMap");
  const common = useTranslations("common");
  const [activeId, setActiveId] = useState<string | null>(null);
  // Keep the whole loaded page beneath the map, including all unlocated entries.
  const retainPage = useCallback(() => {}, []);
  const clusterLabel = useCallback((count: number) => mapText("cluster", { count }), [mapText]);
  const locations = useMemo(() => entries.map(entry => ({
    id: entry.id, title: entry.title, city: entry.city, image: entry.image || "", type: "", price: 0,
    lat: entry.lat, lng: entry.lng,
  })), [entries]);
  const mapped = locations.filter(hasCoordinates).length;
  const row = (entry: NativeNewsEntry, preview = false) => <Link href={entry.href} className={`${styles.card} ${preview ? styles.preview : ""}`} data-news-id={entry.id}>
    <div className={styles.image}>{entry.image ? <MediaImage src={entry.image} alt="" width={640} height={360} className={styles.photo} /> : <Newspaper size={24} aria-hidden="true" />}</div>
    <div className={styles.copy}>
      <p className={styles.type}>{[entry.typeLabel, entry.topicLabel].filter(Boolean).join(" · ")}</p>
      <h2>{entry.title}</h2>
      <p className={styles.organization}>{[entry.organization, entry.city].filter(Boolean).join(" · ")}</p>
      {entry.dateLabel && <p className={styles.date}><time dateTime={entry.startsAt ?? undefined}>{entry.dateLabel}</time></p>}
      {entry.ended && <p className={styles.ended}>{t("status.ended")}</p>}
      {entry.summary && <p className={styles.summary}>{entry.summary}</p>}
    </div>
    <ChevronRight size={17} aria-hidden="true" className={styles.chevron} />
  </Link>;
  return <>
    {native && <nav className={`site-container ${styles.organizationRail}`} aria-label={discovery("organizations")} data-native-news-organizations>
      {organizations.map(organization => <Link key={organization.id} className={styles.organizationIcon}
        href={`/organizations/${encodeURIComponent(organization.slug)}`} aria-label={organization.name} title={organization.name}>
        {organization.logo_url ? <MediaImage src={organization.logo_url} alt="" width={42} height={42} className={styles.organizationLogo} /> : <Building2 size={23} aria-hidden="true" />}
      </Link>)}
      {organizationsUnavailable && <span role="status" className={styles.organizationStatus}>{common("unavailable")}</span>}
      <Link className={styles.organizationIcon} href={organizationsHref} aria-label={discovery("allOrganizations")} title={discovery("allOrganizations")}><ChevronRight size={21} aria-hidden="true" /></Link>
    </nav>}
    <NewsBrowseControls {...controls} nativeViewControls={native ? <DirectoryViewControls value={view} onChange={setView} /> : undefined} />
    {native ? <section className={`site-container ${styles.root}`} data-native-news="v1" data-view={view} aria-label={t("newsTitle")}>
      {view === "map" && <section className={styles.map} aria-label={t("newsTitle")}>
        <div className={styles.mapFrame}><LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50}
          appliedBounds={null} onApplyBounds={retainPage} onBoundsChange={retainPage} visibleCount={mapped}
          labels={{ label: t("newsTitle"), results: news("mapScope", { mapped, loaded: entries.length }), empty: mapText("empty"), unknownCoordinates: "", cluster: clusterLabel, error: mapText("error") }}
          renderPreview={selected => { const entry = entries.find(item => item.id === selected.id); return entry ? row(entry, true) : null; }} /></div>
        <div className={styles.mapMeta}><p role="status">{news("mapScope", { mapped, loaded: entries.length })}</p><details><summary>{mapText("information")}</summary>
          <p>{mapText("cityNotice")}</p><p>{mapText.rich("source", { provider: text => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">{text}</a>, license: text => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{text}</a> })}</p>
        </details></div>
      </section>}
      {entries.length ? <div className={styles.results} data-news-results>{entries.map(entry => <article key={entry.id}>{row(entry)}</article>)}</div> : <p className={styles.empty}>{t("empty")}</p>}
      <p className={styles.scope}>{news("pageScope", { page, loaded: entries.length, total: controls.count })}</p>
      <nav className={styles.pagination} aria-label={t("newsTitle")}>
        {previousHref ? <Link href={previousHref}>← {t("previous")}</Link> : <span />}
        {nextHref && <Link href={nextHref}>{t("next")} →</Link>}
      </nav>
      <div className={styles.links}><Link href={organizationsHref}>{discovery("allOrganizations")} →</Link><Link href="/organization-dashboard">{t("manageOrganization")} →</Link></div>
    </section> : children}
  </>;
}
