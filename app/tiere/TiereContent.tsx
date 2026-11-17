"use client";

import DirectoryViewControls from "@/components/DirectoryViewControls";
import BrowseGeography from "@/components/BrowseGeography";
import ListingImage from "@/components/ListingImage";
import MobileBrowseControls,{ MobileFilterField,MobileFilterSelect } from "@/components/MobileBrowseControls";
import PlaceFilters,{ EMPTY_PLACE_FILTERS } from "@/components/PlaceFilters";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { matchesPlace,browsePlaceOptions as placeOptions, UNASSIGNED_COUNTRY } from "@/lib/places/core";
import { useBrowseGeography } from "@/lib/use-browse-geography";
import { useViewState } from "@/lib/use-view-state";

import { animalSpecies } from "@/lib/animal-taxonomy";
import { useAuth } from "@clerk/nextjs";
import { Heart,MapPin,PawPrint,Truck,Users } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect,useLayoutEffect,useMemo,useRef,useState } from "react";

type Animal = {
  id: string;
  title: string;
  category: string;
  location: string;
  dailyRate: number;
  image: string;
  trainingLevel: string | null;
  handlerIncluded: boolean;
  count: string;
  specialSkills: string | null;
  delivery: boolean;
  focalPoint?: { x: number; y: number } | null;
  description?: string;
  ownerId?: string;
};


export default function TiereContent({ serverListings }: { serverListings: Animal[] }) {
  const uiText = useTranslations();

  const { isSignedIn, userId, sessionId } = useAuth();
  const animals = useTranslations("FilmAnimals");
  const locale = useLocale();
  const [view, setView] = useViewState<"grid" | "list">("animals.view", "grid");
  const [search, setSearch] = useViewState("animals.search", "");
  const [place, setPlace] = useViewState("animals.place", EMPTY_PLACE_FILTERS);
  const [sort, setSort] = useViewState("animals.sort", "newest");
  const geography = useBrowseGeography(sort === "newest" && !place.country && !place.region && !place.city);
  const speciesLabel = (value: string) => animalSpecies(value) ? animals(`species.${animalSpecies(value)!.id}`) : value;
  const trainingLabel = (value: string) => ({ "Kinoprofi": uiText("BrowseFilters.trainingPro"), "Erfahren": uiText("BrowseFilters.trainingExperienced"), "Grundgehorsam": uiText("BrowseFilters.trainingBasic"), "Ungeübt": uiText("BrowseFilters.trainingNone") })[value] ?? value;

  const [species, setSpecies] = useViewState("animals.species", "Alle");
  const [training, setTraining] = useViewState("animals.training", "Alle");
  const [deliveryOnly, setDeliveryOnly] = useViewState("animals.delivery", false);
  const [liveRatings, setLiveRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const favoriteScope = JSON.stringify([userId, sessionId]);
  const currentFavoriteScope = useRef(favoriteScope), favoriteRequestGeneration = useRef(0), pendingFavorites = useRef(new Set<string>());
  const [favoriteState, setFavoriteState] = useState<{ scope: string; ids: Set<string> }>({ scope: "", ids: new Set() });
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritePending, setFavoritePending] = useState(new Set<string>());
  const favorites = favoriteState.scope === favoriteScope ? favoriteState.ids : new Set<string>();
  useLayoutEffect(() => {
    currentFavoriteScope.current = favoriteScope;
    return () => { currentFavoriteScope.current = ""; favoriteRequestGeneration.current += 1; };
  }, [favoriteScope]);

  const handleFavorite = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault(); e.stopPropagation();
    const key = `${favoriteScope}:${listingId}`;
    if (!isSignedIn || !userId || pendingFavorites.current.has(key)) return;
    pendingFavorites.current.add(key); favoriteRequestGeneration.current += 1;
    setFavoritePending(previous => new Set(previous).add(key));
    const wasFav = favorites.has(listingId);
    const update = (value: boolean) => setFavoriteState(current => {
      if (currentFavoriteScope.current !== favoriteScope) return current;
      const ids = new Set(current.scope === favoriteScope ? current.ids : []);
      if (value) ids.add(listingId); else ids.delete(listingId);
      return { scope: favoriteScope, ids };
    });
    update(!wasFav); setFavoriteError("");
    try {
      const response = await fetch("/api/favorites", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "X-Favorites-Account": userId }, signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ listing_id: listingId, action: wasFav ? "remove" : "add" }),
      });
      const result = await response.json();
      if (currentFavoriteScope.current !== favoriteScope) return;
      if (!response.ok || typeof result.isFavorited !== "boolean") throw new Error();
      update(result.isFavorited);
    } catch {
      if (currentFavoriteScope.current === favoriteScope) { update(wasFav); setFavoriteError(favoriteScope); }
    } finally {
      pendingFavorites.current.delete(key);
      if (currentFavoriteScope.current === favoriteScope) setFavoritePending(previous => { const next = new Set(previous); next.delete(key); return next; });
    }
  };

  const filtered = useMemo(() => {
    const rows = serverListings.filter((a) => {
      if (!matchesPlace(a, "country", place.country) || !matchesPlace(a, "region", place.region) || !matchesPlace(a, "city", place.city)) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
          !a.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (species !== "Alle" && (animalSpecies(a.category)?.id ?? a.category) !== (animalSpecies(species)?.id ?? species)) return false;
      if (training !== "Alle" && a.trainingLevel !== training) return false;
      if (deliveryOnly && !a.delivery) return false;
      return true;
    });
    if (sort === "name") rows.sort((a,b) => a.title.localeCompare(b.title,locale));
    return prioritizeGeographically(rows, geography.preferred);
  }, [serverListings, search, species, training, deliveryOnly, place, sort, locale, geography.preferred]);

  const [pageState, setPageState] = useViewState("animals.page", { key: "", count: 24 });
  const filterKey = JSON.stringify([search, place, sort, species, training, deliveryOnly, geography.preferred]);
  const visibleCount = pageState.key === filterKey ? pageState.count : 24;
  const visible = filtered.slice(0, visibleCount);
  const visibleIds = visible.map(row => row.id).join(",");

  useEffect(() => {
    if (!visibleIds) return;
    const abort = new AbortController();
    const ids = visibleIds.split(",");
    const batches = Array.from({ length: Math.ceil(ids.length / 24) }, (_, index) => ids.slice(index * 24, index * 24 + 24).join(","));
    Promise.all(batches.map(ids => fetch(`/api/listing-ratings?ids=${ids}`, { signal: abort.signal }).then(r => r.ok ? r.json() : Promise.reject())))
      .then(rows => {
        if (abort.signal.aborted) return;
        setLiveRatings(Object.assign({}, ...rows.map(row => row.ratings ?? {})));
      }).catch(() => {});
    return () => abort.abort();
  }, [visibleIds, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !userId || !visibleIds) return;
    const abort = new AbortController(), version = ++favoriteRequestGeneration.current;
    const current = () => !abort.signal.aborted && currentFavoriteScope.current === favoriteScope && favoriteRequestGeneration.current === version;
    const ids = visibleIds.split(",");
    const batches = Array.from({ length: Math.ceil(ids.length / 24) }, (_, index) => ids.slice(index * 24, index * 24 + 24).join(","));
    Promise.all(batches.map(ids => fetch(`/api/favorites?ids=${ids}`, { signal: abort.signal, cache: "no-store", headers: { "X-Favorites-Account": userId } }).then(async response => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.favorited)) throw new Error();
      return data;
    }))).then(rows => {
      if (current()) { setFavoriteState({ scope: favoriteScope, ids: new Set(rows.flatMap(row => row.favorited)) }); setFavoriteError(""); }
    }).catch(() => { if (current()) setFavoriteError(favoriteScope); });
    return () => abort.abort();
  }, [visibleIds, isSignedIn, userId, favoriteScope]);

  const reset = () => { setSearch(""); setSpecies("Alle"); setTraining("Alle"); setDeliveryOnly(false); setPlace(EMPTY_PLACE_FILTERS); };
  const chips = [
    ...(species !== "Alle" ? [{ id: "species", label: speciesLabel(species), onRemove: () => setSpecies("Alle") }] : []),
    ...(training !== "Alle" ? [{ id: "training", label: trainingLabel(training), onRemove: () => setTraining("Alle") }] : []),
    ...(deliveryOnly ? [{ id: "delivery", label: animals("delivery"), onRemove: () => setDeliveryOnly(false) }] : []),
    ...(["country", "region", "city"] as const).flatMap(kind => place[kind] ? [{ id: kind, label: place[kind] === UNASSIGNED_COUNTRY ? uiText("Places.countryUnassigned") : placeOptions(serverListings, kind, locale).find(option => option.value === place[kind])?.label ?? place[kind], onRemove: () => setPlace(kind === "country" ? EMPTY_PLACE_FILTERS : kind === "region" ? { ...place, region: "", city: "" } : { ...place, city: "" }) }] : []),
  ];
  return <div className="mobile-bottom-nav-clear">
    <MobileBrowseControls preference={<BrowseGeography geography={geography} />} query={search} onQueryChange={setSearch} searchPlaceholder={uiText("Ui.text_daec3cc1690074")}
      sortValue={sort} onSortChange={value => { geography.setEnabled(false); setSort(value); }} sortOptions={[{ value: "newest", label: geography.preferred ? uiText("BrowseGeography.recommended") : uiText("jobs.sortNewest") }, { value: "name", label: uiText("Ui.text_7ed96629073e83") }]}
      categoryLabel={animals("speciesField")} allCategoryLabel={animals("allSpecies")} categoryValue={species === "Alle" ? "" : species} onCategoryChange={value => setSpecies(value || "Alle")}
      categories={[...new Set(serverListings.map(row => animalSpecies(row.category)?.id ?? row.category))].map(value => ({ value, label: speciesLabel(value) }))}
      viewControls={<DirectoryViewControls value={view} views={["grid", "list"]} onChange={value => setView(value === "grid" ? "grid" : "list")} />}
      resultCount={filtered.length} resultSummary={uiText("BrowseFilters.results", { count: filtered.length })} filterCount={chips.length} chips={chips} onReset={reset} resetLabel={uiText("projects.resetFilters")} showResultsLabel={uiText("Ui.text_52ca04e867ebdc", { value1: String(filtered.length) })}>
      <PlaceFilters rows={serverListings} value={place} onChange={setPlace} />
      <MobileFilterField label={animals("training")}><MobileFilterSelect value={training === "Alle" ? "" : training} onChange={value => setTraining(value || "Alle")} placeholder={uiText("common.all")} options={[...new Set(serverListings.flatMap(row => row.trainingLevel ? [row.trainingLevel] : []))].map(value => ({ value, label: trainingLabel(value) }))} /></MobileFilterField>
      {(deliveryOnly || serverListings.some(row => row.delivery)) && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={deliveryOnly} onChange={event => setDeliveryOnly(event.target.checked)} />{animals("delivery")}</label>}
    </MobileBrowseControls>
    <div className="site-container py-6">
      {favoriteError === favoriteScope && <p role="alert" className="mb-4 text-sm text-text-secondary">{uiText("System.requestFailed")}</p>}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 bg-bg-secondary border border-border rounded-2xl flex items-center justify-center mb-5">
            <PawPrint size={28} className="text-text-muted" />
          </div>
          <h3 className="font-display text-xl font-bold text-text-primary mb-2">{animals("empty")}</h3>
          <p className="text-text-muted text-sm max-w-xs leading-relaxed mb-6">{animals("portfolioHelp")}</p>
          <Link href="/inserat?animal=1" className="inline-flex min-h-11 items-center px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
            {animals("addPortfolio")}
          </Link>
        </div>
      ) : (
        <div className={view === "grid" ? "directory-cards" : "directory-list"}>
          {visible.map(animal => (
            <article key={animal.id} className="directory-entry">
              <Link href={`/tiere/${animal.id}`} className="directory-entry-link">
                <div className="directory-entry-photo">
                  {animal.image ? <ListingImage fill sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw" mediaSize="thumbnail" src={animal.image} alt={animal.title} style={{ objectPosition: animal.focalPoint ? `${animal.focalPoint.x}% ${animal.focalPoint.y}%` : "50% 40%" }} /> : <div className="flex h-full items-center justify-center"><PawPrint size={28} className="text-text-muted" aria-hidden="true" /></div>}
                </div>
                <div className="directory-entry-body">
                  <h2 className="directory-entry-title">{animal.title}</h2>
                  <p className="text-xs text-text-muted">{speciesLabel(animal.category)}</p>
                  {animal.trainingLevel && <p className="text-xs text-text-secondary">{trainingLabel(animal.trainingLevel)}</p>}
                  <p className="directory-entry-place"><MapPin size={12} aria-hidden="true" /><span>{animal.location || uiText("FilmAnimals.locationRequest")}</span></p>
                  {(animal.handlerIncluded || animal.delivery) && <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-muted">{animal.handlerIncluded && <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden="true" />{animals("handler")}</span>}{animal.delivery && <span className="inline-flex items-center gap-1"><Truck size={12} aria-hidden="true" />{animals("delivery")}</span>}</p>}
                  {(liveRatings[animal.id]?.count ?? 0) > 0 && <p className="text-xs text-text-muted">★ {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(liveRatings[animal.id].avg)} · {liveRatings[animal.id].count}</p>}
                  <span className="directory-entry-price">{animals("inquire")}</span>
                </div>
              </Link>
              {isSignedIn && <button type="button" onClick={event => void handleFavorite(event, animal.id)} disabled={favoritePending.has(`${favoriteScope}:${animal.id}`)} aria-pressed={favorites.has(animal.id)} aria-label={uiText(favorites.has(animal.id) ? "Ui.text_53968e5832d074" : "Ui.text_9203de1d551aa8")} className={`directory-entry-favorite flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-bg-secondary ${favorites.has(animal.id) ? "text-gold" : "text-text-muted"}`}><Heart size={17} aria-hidden="true" className={favorites.has(animal.id) ? "fill-current" : ""} /></button>}
            </article>
          ))}
        </div>
      )}
      {visibleCount < filtered.length && <div className="mt-7 flex justify-center"><button type="button" className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm text-text-secondary hover:border-gold" onClick={() => setPageState({ key: filterKey, count: visibleCount + 24 })}>{uiText("creators.loadMore", { count: filtered.length - visibleCount })}</button></div>}
    </div></div>
  ;
}
