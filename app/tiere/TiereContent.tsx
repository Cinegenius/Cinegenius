"use client";

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
import { useEffect,useMemo,useState } from "react";

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

const TRAINING_COLORS: Record<string, string> = {
  "Kinoprofi": "text-gold border-gold/30 bg-gold-subtle",
  "Erfahren": "text-success border-success/30 bg-success/10",
  "Grundgehorsam": "text-text-secondary border-border bg-bg-elevated",
  "Ungeübt": "text-text-muted border-border bg-bg-elevated",
};

export default function TiereContent({ serverListings }: { serverListings: Animal[] }) {
  const uiText = useTranslations();

  const { isSignedIn } = useAuth();
  const animals = useTranslations("FilmAnimals");
  const locale = useLocale();
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
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [eligible, setEligible] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const handleFavorite = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!isSignedIn) return;
    const wasFav = favorites.has(listingId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    try {
      await fetch("/api/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
    } catch {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    }
  };

  const handleRate = async (e: React.MouseEvent, animal: Animal, star: number) => {
    e.preventDefault(); e.stopPropagation();
    if (!eligible.has(animal.id)) return;
    const prev = myRatings[animal.id];
    setMyRatings(m => ({ ...m, [animal.id]: star }));
    setLiveRatings(r => {
      const cur = r[animal.id] ?? { avg: 0, count: 0 };
      const newCount = prev ? cur.count : cur.count + 1;
      const newSum = prev ? cur.avg * cur.count - prev + star : cur.avg * cur.count + star;
      return { ...r, [animal.id]: { avg: Math.round((newSum / newCount) * 10) / 10, count: newCount } };
    });
    try {
      await fetch("/api/listing-ratings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: animal.id, owner_id: animal.ownerId, rating: star }),
      });
    } catch {
      setMyRatings(m => { const n = { ...m }; if (prev) n[animal.id] = prev; else delete n[animal.id]; return n; });
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
        setMyRatings(Object.assign({}, ...rows.map(row => row.myRatings ?? {})));
        setEligible(new Set(rows.flatMap(row => row.eligible ?? [])));
      }).catch(() => {});
    return () => abort.abort();
  }, [visibleIds, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !visibleIds) return;
    const abort = new AbortController();
    const ids = visibleIds.split(",");
    const batches = Array.from({ length: Math.ceil(ids.length / 24) }, (_, index) => ids.slice(index * 24, index * 24 + 24).join(","));
    Promise.all(batches.map(ids => fetch(`/api/favorites?ids=${ids}`, { signal: abort.signal }).then(r => r.ok ? r.json() : Promise.reject())))
      .then(rows => { if (!abort.signal.aborted) setFavorites(new Set(rows.flatMap(row => row.favorited ?? []))); }).catch(() => {});
    return () => abort.abort();
  }, [visibleIds, isSignedIn]);

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
      resultCount={filtered.length} resultSummary={uiText("BrowseFilters.results", { count: filtered.length })} filterCount={chips.length} chips={chips} onReset={reset} resetLabel={uiText("projects.resetFilters")} showResultsLabel={uiText("Ui.text_52ca04e867ebdc", { value1: String(filtered.length) })}>
      <PlaceFilters rows={serverListings} value={place} onChange={setPlace} />
      <MobileFilterField label={animals("training")}><MobileFilterSelect value={training === "Alle" ? "" : training} onChange={value => setTraining(value || "Alle")} placeholder={uiText("common.all")} options={[...new Set(serverListings.flatMap(row => row.trainingLevel ? [row.trainingLevel] : []))].map(value => ({ value, label: trainingLabel(value) }))} /></MobileFilterField>
      {(deliveryOnly || serverListings.some(row => row.delivery)) && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={deliveryOnly} onChange={event => setDeliveryOnly(event.target.checked)} />{animals("delivery")}</label>}
    </MobileBrowseControls>
    <div className="site-container py-6">
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 bg-bg-secondary border border-border rounded-2xl flex items-center justify-center mb-5">
            <PawPrint size={28} className="text-text-muted" />
          </div>
          <h3 className="font-display text-xl font-bold text-text-primary mb-2">{animals("empty")}</h3>
          <p className="text-text-muted text-sm max-w-xs leading-relaxed mb-6">{animals("portfolioHelp")}</p>
          <Link href="/inserat?animal=1" className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
            {animals("addPortfolio")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visible.map((animal) => (
            <Link key={animal.id} href={`/tiere/${animal.id}`}
              className="group bg-bg-secondary border border-border rounded-2xl overflow-hidden hover:border-gold/40 transition-all hover:shadow-lg hover:shadow-gold/5">
              <div className="relative h-48 overflow-hidden bg-bg-elevated">
                {animal.image ? (
                  <ListingImage
                    fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px" mediaSize="thumbnail"
                    src={animal.image}
                    alt={animal.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    style={{ objectPosition: animal.focalPoint ? `${animal.focalPoint.x}% ${animal.focalPoint.y}%` : "50% 40%" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PawPrint size={40} className="text-text-muted/20" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {animal.delivery && (
                    <span className="px-2 py-0.5 bg-success/90 text-white text-[10px] font-semibold rounded-full flex items-center gap-1">{uiText.rich("Ui.text_b1074837744a9d", { part1: () => (<Truck size={9} />) })}</span>
                  )}
                  {isSignedIn && (
                    <button type="button" onClick={(e) => handleFavorite(e, animal.id)}
                      className={`w-6 h-6 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all ${favorites.has(animal.id) ? "bg-crimson/20 border-crimson/50 text-crimson-light" : "bg-bg-primary/60 border-border/50 text-text-muted hover:text-crimson-light"}`}>
                      <Heart size={11} className={favorites.has(animal.id) ? "fill-current" : ""} />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="px-2 py-0.5 bg-bg-elevated border border-border text-text-muted text-[10px] rounded">{animalSpecies(animal.category) ? animals(`species.${animalSpecies(animal.category)!.id}`) : animal.category}</span>
                  {animal.trainingLevel && (
                    <span className={`px-2 py-0.5 border text-[10px] rounded font-medium ${TRAINING_COLORS[animal.trainingLevel] ?? TRAINING_COLORS["Grundgehorsam"]}`}>
                      {trainingLabel(animal.trainingLevel)}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-text-primary text-sm mb-1 line-clamp-2 group-hover:text-gold transition-colors">
                  {animal.title}
                </h3>

                <div className="flex items-center gap-1 text-xs text-text-muted mb-3">
                  <MapPin size={11} /> {animal.location || uiText("FilmAnimals.locationRequest")}
                </div>

                {animal.handlerIncluded && (
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mb-2">
                    <Users size={10} className="text-gold" /> {animals("handler")}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-display font-bold text-gold">
                    {animals("inquire")}
                  </span>

                </div>
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 pointer-events-none">
                    {(liveRatings[animal.id]?.count ?? 0) > 0 ? (
                      <>
                        <span className="text-gold text-[10px] font-bold">{liveRatings[animal.id].avg.toFixed(1)}</span>
                        {[1,2,3,4,5].map((s) => (
                          <span key={s} className={`text-[9px] ${s <= Math.round(liveRatings[animal.id].avg) ? "text-gold" : "text-text-muted/30"}`}>★</span>
                        ))}
                        <span className="text-[9px] text-text-muted">({liveRatings[animal.id].count})</span>
                      </>
                    ) : (
                      <span className="text-[9px] text-text-muted/60">{uiText("locations.landingNoReviews")}</span>
                    )}
                  </div>
                  {eligible.has(animal.id) && (
                    <div className="flex">
                      {[1,2,3,4,5].map((star) => (
                        <button key={star} type="button"
                          onClick={(e) => void handleRate(e, animal, star)}
                          className="w-5 h-5 flex items-center justify-center text-xs touch-manipulation transition-transform active:scale-125 hover:scale-110"
                          style={{ color: star <= (myRatings[animal.id] ?? 0) ? "#d4af37" : "rgba(255,255,255,0.2)" }}>
                          ★
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {visibleCount < filtered.length && <div className="mt-7 flex justify-center"><button type="button" className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm text-text-secondary hover:border-gold" onClick={() => setPageState({ key: filterKey, count: visibleCount + 24 })}>{uiText("creators.loadMore", { count: filtered.length - visibleCount })}</button></div>}
    </div></div>
  ;
}
