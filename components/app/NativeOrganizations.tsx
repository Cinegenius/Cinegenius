"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Search } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import DirectoryPage from "@/components/DirectoryPage";
import DirectoryViewControls, { type DirectoryView } from "@/components/DirectoryViewControls";
import NativeBrowseToolbar, { NativeBrowseQuickFilter } from "./NativeBrowseToolbar";
import NativeCountrySelect from "./NativeCountrySelect";
import NativeNewsSections from "./NativeNewsSections";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useViewState } from "@/lib/use-view-state";
import { browseCountryChoice } from "@/lib/browse-country";
import { countryName } from "@/lib/places/core";
import { hasCoordinates } from "@/lib/location-map";
import type { OrganizationDirectoryData, OrganizationDirectoryEntry } from "@/lib/organization-directory";
import { organizationDirectoryHref, type OrganizationDirectoryFilters } from "@/lib/organization-directory-filters";
import styles from "./NativeOrganizations.module.css";

function LoadingMap() { const t = useTranslations("directoryMap"); return <p role="status">{t("loading")}</p>; }
const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false, loading: LoadingMap });

export default function NativeOrganizations({ data, children }: { data: OrganizationDirectoryData; children: ReactNode }) {
  const native = useNativeAppAppearance(), router = useRouter(), locale = useLocale();
  const t = useTranslations("NativeOrganizations"), discovery = useTranslations("OrganizationDiscovery"), places = useTranslations("Places"), ui = useTranslations();
  const [view, setView] = useViewState<DirectoryView>("organizations.view", "list");
  const [search, setSearch] = useState({ query: data.filters.q, text: data.filters.q });
  const [pending, startTransition] = useTransition();
  if (search.query !== data.filters.q) setSearch({ query: data.filters.q, text: data.filters.q });
  const text = search.query === data.filters.q ? search.text : data.filters.q;
  const [activeId, setActiveId] = useState<string | null>(null);
  const change = (changes: Partial<OrganizationDirectoryFilters>) => startTransition(() => router.push(organizationDirectoryHref({ ...data.filters, q: text, page: 1, ...changes }), { scroll: false }));
  const locations = useMemo(() => data.organizations.map(org => ({ id: org.id, title: org.name, city: org.city, image: org.logo_url ?? "", type: "", price: 0, lat: org.lat, lng: org.lng })), [data.organizations]);
  const mapped = locations.filter(hasCoordinates).length;
  const retainPage = useCallback(() => {}, []);
  const cluster = useCallback((count: number) => ui("directoryMap.cluster", { count }), [ui]);
  const card = (org: OrganizationDirectoryEntry) => <Link href={`/organizations/${encodeURIComponent(org.slug)}`} className={styles.card} data-organization-id={org.id}>
    <div className={styles.logo}>{org.logo_url ? <MediaImage src={org.logo_url} alt="" width={96} height={80} className={styles.image} /> : <Building2 size={24} aria-hidden="true" />}</div>
    <div className={styles.copy}><h2>{org.name}</h2><p>{[org.city, countryName(org.country, locale)].filter(Boolean).join(" · ")}</p></div>
  </Link>;
  if (!native) return children;
  return <DirectoryPage area="news">
    <NativeNewsSections section="organizations" country={data.filters.country} />
    <main className={`site-container ${styles.root}`} data-native-organizations data-view={view} aria-busy={pending}>
      <h1 className="sr-only">{discovery("organizations")}</h1>
      <form className={`native-browse-search ${styles.search}`} onSubmit={event => { event.preventDefault(); change({ q: text.trim() }); }}>
        <input aria-label={t("searchLabel")} placeholder={t("searchLabel")} value={text} maxLength={120} onChange={event => setSearch({ query: data.filters.q, text: event.target.value })} />
        <button type="submit" aria-label={ui("Organizations.search")}><Search size={19} aria-hidden="true" /></button>
      </form>
      <NativeBrowseToolbar keepTwoFilters countScope="total" count={pending ? null : data.count} countLabel={pending ? ui("common.loading") : ui("BrowseFilters.results", { count: data.count })}
        filters={[
          <NativeCountrySelect compact key="country" value={data.filters.country} onChange={value => { const country = browseCountryChoice(value); if (country !== undefined) change({ country, city: "" }); }} />,
          <NativeBrowseQuickFilter key="city" kind="place" label={places("city")} value={data.filters.city}
            options={[{ value: "", label: places("allCities") }, ...data.cities.map(city => ({ ...city, label: city.label || places("city") }))]} onChange={city => change({ city })} />,
        ]} viewControls={<DirectoryViewControls views={["list", "map"]} value={view === "map" ? "map" : "list"} onChange={setView} />} />
      {pending && <p role="status">{ui("common.loading")}</p>}
      {view === "map" && <section className={styles.map} aria-label={discovery("organizations")}>
        <div className={styles.mapFrame}><LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50}
          appliedBounds={null} onApplyBounds={retainPage} onBoundsChange={retainPage} visibleCount={mapped} countPending={pending}
          labels={{ label: discovery("organizations"), results: pending ? ui("common.loading") : t("mapScope", { mapped, loaded: locations.length }), empty: ui("directoryMap.empty"), unknownCoordinates: "", cluster, error: ui("directoryMap.error") }}
          renderPreview={selected => { const org = data.organizations.find(item => item.id === selected.id); return org ? <div className={styles.preview}>{card(org)}</div> : null; }} /></div>
        {!pending && <p role="status">{t("mapScope", { mapped, loaded: locations.length })}</p>}<p>{ui("directoryMap.cityNotice")}</p>
      </section>}
      <div className={styles.results} data-organization-results>{data.organizations.length ? data.organizations.map(org => <article key={org.id}>{card(org)}</article>) : <p>{t("empty")}</p>}</div>
      {(data.filters.country || data.filters.city || data.filters.q) && <Link className={styles.reset} href={organizationDirectoryHref({ country: "", city: "", q: "", page: 1 })}>{ui("common.resetFilters")}</Link>}
      <p className={styles.scope}>{t("pageScope", { page: data.filters.page, loaded: data.organizations.length, total: data.count })}</p>
      <nav className={styles.pagination} aria-label={discovery("pages")}>
        {data.filters.page > 1 ? <Link href={organizationDirectoryHref({ ...data.filters, page: data.filters.page - 1 })}>{discovery("previous")}</Link> : <span />}
        {data.hasMore && <Link href={organizationDirectoryHref({ ...data.filters, page: data.filters.page + 1 })}>{discovery("next")}</Link>}
      </nav>
    </main>
  </DirectoryPage>;
}
