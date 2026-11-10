import { placeInputValue } from './places/core';

type ListingPlace = { city: string; place_city_id?: string | null };
type PlaceEditFields = { city?: string; selected_place_city_id?: string };

/** Formatting a saved place for the editor is not a location edit. */
export function listingPlaceEditFields(listing: ListingPlace | undefined, city: string, selectedCityId = ''): PlaceEditFields {
  if (listing
    && city.trim() === placeInputValue(listing, listing.city).trim()
    && selectedCityId === (listing.place_city_id ?? '')) return {};
  return { city: city.trim(), selected_place_city_id: selectedCityId || undefined };
}
