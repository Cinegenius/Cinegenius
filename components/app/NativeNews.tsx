"use client";

import NewsObservation from "@/components/organizations/NewsObservation";
import { ContentTranslationActions, TranslatedText, type ContentTranslationObservation } from "@/components/ContentTranslation";


import { useCallback, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import MediaImage from "@/components/MediaImage";
import DirectoryViewControls, { type DirectoryView } from "@/components/DirectoryViewControls";
import NewsBrowseControls, { type NewsBrowseControlsProps } from "@/app/news/NewsBrowseControls";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useViewState } from "@/lib/use-view-state";
import { hasCoordinates } from "@/lib/location-map";
import styles from "./NativeNews.module.css";
import NativeNewsSections from "./NativeNewsSections";
import type { PublicOrganization } from "@/lib/organization-discovery";
import type { ContentTranslation } from "@/lib/content-translation";

export type NativeNewsEntry = {
  id: string; href: string; title: string; summary: string | null; image: string | null;
  typeLabel: string; topicLabel: string; organization: string; city: string;
  startsAt: string | null; dateLabel: string; ended: boolean;
  lat: number | null; lng: number | null;
};
type Props = {
  controls: NewsBrowseControlsProps; entries: NativeNewsEntry[]; page: number;
  previousHref: string | null; nextHref: string | null; children: ReactNode;
  notice?: ReactNode; organizationRail?: ReactNode; organizations?: PublicOrganization[]; organizationsHref?: string;
};
function LoadingMap() {
  const t = useTranslations();
  return <p role="status">{t("Ui.text_8cd626fb7674ab")}</p>;
}
const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false, loading: LoadingMap });

export function NativeNewsOrganizationRail({ organizations, href, unavailable = false }: { organizations: PublicOrganization[]; href: string; unavailable?: boolean }) {
  const router = useRouter(), discovery = useTranslations("OrganizationDiscovery"), translation = useTranslations("contentTranslation"), common = useTranslations("common");
  return <nav className={styles.organizations} aria-label={discovery("organizations")} data-native-news-organizations>
    {organizations.map(org => <Link key={org.id} href={`/organizations/${encodeURIComponent(org.slug)}`} aria-label={org.name} title={org.name}>
      {org.logo_url ? <MediaImage src={org.logo_url} alt="" width={64} height={48} className={styles.organizationLogo} /> : <Building2 size={23} aria-hidden="true" />}
    </Link>)}
    <Link href={href} aria-label={discovery("allOrganizations")} title={discovery("allOrganizations")}><ChevronRight size={20} aria-hidden="true" /></Link>
    {unavailable && <><span className="sr-only" role="alert">{common("unavailable")}</span><button type="button" aria-label={translation("retry")} title={translation("retry")} onClick={() => router.refresh()}><RotateCw size={18} aria-hidden="true" /></button></>}
  </nav>;
}

/** Existing server-approved page only; presentation never creates or geocodes news. */
export default function NativeNews({ controls, entries, page, previousHref, nextHref, children, notice, organizationRail, organizations = [], organizationsHref = "/organizations" }: Props) {
  const native = useNativeAppAppearance();
  const [view, setView] = useViewState<DirectoryView>("news.view", "grid");
  const t = useTranslations("Organizations"), news = useTranslations("NativeNews");
  const mapText = useTranslations("directoryMap");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unavailableTranslations, setUnavailableTranslations] = useState<Set<object>>(() => new Set());
  const reportTranslation = useCallback((reference: ContentTranslationObservation, status: ContentTranslation["status"] | undefined) => {
    const key = reference.instance, unavailable = status === "unavailable";
    setUnavailableTranslations(current => {
      if (current.has(key) === unavailable) return current;
      const next = new Set(current); if (unavailable) next.add(key); else next.delete(key); return next;
    });
  }, []);
  // Keep the whole loaded page beneath the map, including all unlocated entries.
  const retainPage = useCallback(() => {}, []);
  const clusterLabel = useCallback((count: number) => mapText("cluster", { count }), [mapText]);
  const locations = useMemo(() => entries.map(entry => ({
    id: entry.id, title: entry.title, city: entry.city, image: entry.image || "", type: "", price: 0,
    lat: entry.lat, lng: entry.lng, titleContent: <TranslatedText kind="news" id={entry.id} field="title" onStatusChange={reportTranslation}>{entry.title}</TranslatedText>,
  })), [entries, reportTranslation]);
  const mapped = locations.filter(hasCoordinates).length;
  const row = (entry: NativeNewsEntry, preview = false) => <Link href={entry.href} className={`${styles.card} ${preview ? styles.preview : ""}`} data-news-id={entry.id} data-news-observation data-has-image={entry.image ? "true" : "false"}>
    {entry.image && <div className={styles.image}><MediaImage src={entry.image} alt="" width={640} height={360} className={styles.photo} /></div>}
    <NewsObservation id={entry.id} /><div className={styles.copy}>
      <p className={styles.type}>{[entry.typeLabel, entry.topicLabel].filter(Boolean).join(" · ")}</p>
    <h2><TranslatedText kind="news" id={entry.id} field="title" onStatusChange={reportTranslation}>{entry.title}</TranslatedText></h2>
      <p className={styles.organization}>{[entry.organization, entry.city].filter(Boolean).join(" · ")}</p>
      {entry.dateLabel && <p className={styles.date}><time dateTime={entry.startsAt ?? undefined}>{entry.dateLabel}</time></p>}
      {entry.ended && <p className={styles.ended}>{t("status.ended")}</p>}
      {entry.summary && <p className={styles.summary}><TranslatedText kind="news" id={entry.id} field="summary" onStatusChange={reportTranslation}>{entry.summary}</TranslatedText></p>}
    </div>
    <ChevronRight size={17} aria-hidden="true" className={styles.chevron} />
  </Link>;
  return <>
    {!native && <div className={styles.websiteNotice} data-native-news-website-notice>{notice}</div>}
    <NativeNewsSections section="entries" country={controls.region.country} />
    <NewsBrowseControls {...controls} nativeViewControls={native ? <DirectoryViewControls value={view} onChange={setView} /> : undefined} />
    {native ? <section className={`site-container ${styles.root}`} data-native-news="v1" data-view={view} aria-label={t("newsTitle")}>
      <div className={styles.context} data-native-news-context>
        <div className={styles.organizationSlot}>{organizationRail ?? <NativeNewsOrganizationRail organizations={organizations} href={organizationsHref} />}</div>
        <div className={styles.tools}>
          <ContentTranslationActions unavailable={unavailableTranslations.size > 0} className={styles.translationTools} />
        </div>
      </div>
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
      <div className={styles.links}><Link href="/organization-dashboard">{t("manageOrganization")} →</Link></div>
    </section> : children}
  </>;
}
