"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, MapPin, SlidersHorizontal } from "lucide-react";
import NativeBrowseToolbar from "./NativeBrowseToolbar";
import NativeBrowseFilterPanel, { NativeFilterChoices, NativeFilterTrigger } from "./NativeBrowseFilterPanel";
import NativeLocationDetailFilters from "./NativeLocationDetailFilters";
import NativeMarketplaceFilterChoices from "./NativeMarketplaceFilterChoices";
import NativeFilterNumber from "./NativeFilterNumber";
import CityPlaceFilter from "@/components/CityPlaceFilter";
import { currencyOptions } from "@/lib/currency";
import BrowseSelect from "@/components/BrowseSelect";
import { departments, getDeptLabel, taxonomyLabel } from "@/lib/departments";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { DEPARTMENTS } from "@/lib/marketplaceCategories";
import { locationCategoryLabel } from "@/lib/location-category-labels";
import { NATIVE_SMART_PRIMARY } from "@/lib/native-smart-controls";
import NativeSmartAreas from "./NativeSmartAreas";
import { type SearchBrowseFilters } from "@/lib/browse-filters";
import { type SearchGroup } from "@/lib/unified-search";
import { type DiscoveryFilters } from "@/lib/smart-discovery";

const AREAS = NATIVE_SMART_PRIMARY;
const flip = (values: string[] = [], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
export default function NativeSmartFilters({ groups, count, busy, failed = false, filters, onChange, views }: {
  groups: SearchGroup[]; count: number; busy: boolean; failed?: boolean; filters: DiscoveryFilters; onChange: (value: DiscoveryFilters) => void; views: React.ReactNode;
}) {
  const ui = useTranslations(), t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), menu = useTranslations("menu"), locale = useLocale();
  const [panel, setPanel] = useState<"place" | "more" | null>(null);
  const [resetEpoch,setResetEpoch]=useState(0);
  const place = useRef<HTMLButtonElement>(null), more = useRef<HTMLButtonElement>(null);
  const browse: SearchBrowseFilters = filters.browse ?? { version: 1 };
  const update = (patch: Partial<SearchBrowseFilters>) => onChange({ ...filters, browse: { ...browse, ...patch } });
  const location = browse.location ?? {};
  const updateLocation = (patch: NonNullable<SearchBrowseFilters["location"]>) => update({ location: { ...location, ...patch } });
  const reset = () => { setResetEpoch(value=>value+1); onChange({ ...filters, hiddenAreas: [], hiddenWishes: [], departments: [], marketplace: [], bounds: null, placeLabel:"", browse: { version: 1 } }); };
  const choices = (field: "departments" | "marketplace" | "locationTypes" | "companyCategories" | "jobTypes", label: string, options: {value:string;label:string}[]) => <fieldset className="min-w-0"><legend className="sr-only">{label}</legend><NativeFilterChoices label={label} options={options} selected={browse[field] ?? []} onChange={value => update({ [field]: flip(browse[field], value) })} /></fieldset>;
  const locationTypes = [...new Set(["Wohnen","Villa","Studio","Fotostudio","Büro","Industrie","Gastronomie","Natur","Speziallocation",...groups.flatMap(group => group.results.flatMap(result => result.facets?.locationType ? [result.facets.locationType] : [])),...(browse.locationTypes ?? [])])];
  const active = AREAS.filter(area => !filters.hiddenAreas.includes(area));
  const section = (area:typeof AREAS[number],label:string,children:React.ReactNode,filtered:boolean) => <details data-smart-filter-area={area} open={active.length===1||filtered} className="border-b border-border pb-2"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"><span className="min-w-0 flex-1">{t(`areas.${area}`)} · {label}</span><ChevronDown size={16} aria-hidden="true"/></summary>{children}</details>;
  const currentPlace = { country: browse.country ?? "", region: browse.region ?? "", city: browse.city ?? "" };
  return <>
    <NativeSmartAreas hidden={filters.hiddenAreas} onChange={hiddenAreas => onChange({ ...filters, hiddenAreas })} />
    <NativeBrowseToolbar count={busy || failed ? null : count} countLabel={failed ? t("error") : busy ? t("loading") : t("discovery.loaded", { count })}
      filters={[
        <NativeFilterTrigger key="place" triggerRef={place} label={ui("BrowseFilters.place")} icon={<MapPin aria-hidden="true" />} active={!!(browse.country || browse.region || browse.city)} open={panel === "place"} onClick={() => setPanel("place")} />,
      ]} moreAction={<button ref={more} type="button" aria-label={t("discovery.filterTitle")} aria-haspopup="dialog" aria-expanded={panel === "more"} onClick={() => setPanel("more")}><SlidersHorizontal size={19} aria-hidden="true" /></button>} viewControls={views} />
    {panel && <NativeBrowseFilterPanel title={panel === "place" ? ui("BrowseFilters.place") : t("discovery.filterTitle")} trigger={panel === "place" ? place : more} onClose={() => setPanel(null)} onReset={reset}>
      {panel === "place" ? <CityPlaceFilter surface="smart" key={resetEpoch} areas={active} value={currentPlace} label={filters.placeLabel ?? ""} radiusKm={browse.radiusKm ?? null}
        onChange={(value,label) => onChange({...filters,bounds:null,placeLabel:label,browse:{...browse,...value,radiusKm:undefined}})}
        onRadiusChange={km => onChange({...filters,bounds:null,browse:{...browse,radiusKm:km??undefined}})} /> : <div className="space-y-4">
          {active.includes("crew") && section("crew",ui("BrowseFilters.crew"),choices("departments",ui("BrowseFilters.crew"),departments.map(dept => ({value:dept.id,label:getDeptLabel(dept,locale,undefined,taxonomy)}))),!!browse.departments?.length)}
          {active.includes("marketplace") && section("marketplace",ui("BrowseFilters.marketplace"),<fieldset><legend className="sr-only">{ui("BrowseFilters.marketplace")}</legend><NativeMarketplaceFilterChoices
            options={DEPARTMENTS.map(dept => ({value:dept.id,label:ui.has(`MarketplaceCatalog.categories.${dept.id}`)?ui(`MarketplaceCatalog.categories.${dept.id}`):taxonomyLabel(dept.label,ui)}))}
            selected={browse.marketplace ?? []} onChange={value => update({marketplace:flip(browse.marketplace,value)})}/></fieldset>,!!browse.marketplace?.length)}
          {active.includes("locations") && section("locations",ui("BrowseFilters.locations"),<div className="space-y-3">{choices("locationTypes",ui("BrowseFilters.locations"),locationTypes.map(value => ({value,label:locationCategoryLabel(value,menu)})))}
            <div className="mobile-filter-field"><label>{ui("Ui.text_295029201d603e")}</label><BrowseSelect label={ui("Ui.text_295029201d603e")} value={location.indoorOutdoor ?? ""} triggerClassName="browse-filter-select" options={[{value:"",label:t("discovery.all")},{value:"innen",label:ui("locations.filterInnen")},{value:"außen",label:ui("locations.filterAussen")},{value:"beides",label:ui("locations.filterInnenAussen")}]} onChange={value => updateLocation({indoorOutdoor:value as typeof location.indoorOutdoor})} /></div>
            <div className="mobile-filter-field"><label>{ui("Regional.currency")}</label><BrowseSelect label={ui("Regional.currency")} value={location.currency ?? "EUR"} options={currencyOptions(locale)} onChange={currency => updateLocation({currency})} triggerClassName="browse-filter-select" /></div>
            <div className="grid grid-cols-2 gap-3">{(["min","max"] as const).map(key => <label key={key} className="mobile-filter-field"><span>{ui(key === "min" ? "Ui.text_84381d6fa4d29d" : "Ui.text_f7abc502297a74")}</span><NativeFilterNumber key={`${resetEpoch}:${key}:${location[key]??""}`} defer min="0" value={location[key] ?? ""} onCommit={value => updateLocation({[key]:value,currency:location.currency || "EUR"})} /></label>)}</div>
            <NativeLocationDetailFilters key={resetEpoch} deferNumbers value={location} onChange={updateLocation} power={location.power === "1"} onPowerChange={power => updateLocation({power:power ? "1" : undefined})} />
          </div>,!!browse.locationTypes?.length||!!browse.location)}
          {active.includes("companies") && section("companies",ui("BrowseFilters.companies"),choices("companyCategories",ui("BrowseFilters.companies"),COMPANY_CATEGORIES.map(category => ({value:category.id,label:taxonomyLabel(category.label,ui)}))),!!browse.companyCategories?.length)}
          {active.includes("jobs") && section("jobs",ui("BrowseFilters.jobs"),choices("jobTypes",ui("BrowseFilters.jobs"),[{value:"freelance",label:ui("jobs.filterFreelance")},{value:"festanstellung",label:ui("jobs.filterFulltime")},{value:"praktikum",label:ui("jobs.filterInternship")}]),!!browse.jobTypes?.length)}
        </div>}
    </NativeBrowseFilterPanel>}
  </>;
}
