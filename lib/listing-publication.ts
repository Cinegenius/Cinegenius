import { protectedMediaKey } from "@/lib/protected-media";
import { isListingDetailRouteSupported } from "@/lib/listing-routes";

export type ListingPublicationInput = {
  type: string;
  title: string | null;
  city: string | null;
  category?: string | null;
  imageUrl?: string | null;
  imageWillBeUploaded?: boolean;
  companySlug?: string | null;
  providerAssigned: boolean;
  providerContactable: boolean;
};

/** Shared checks for both admin release and an owner's explicit publish action. */
export function validateListingPublication(input: ListingPublicationInput): string | null {
  if (!input.title?.trim() || !input.city?.trim()) {
    return "Vor der Veröffentlichung müssen Titel und Ort eingetragen sein.";
  }
  const visualListing = ["location", "prop", "vehicle", "animal"].includes(input.type);
  if (visualListing && !input.category?.trim()) {
    return "Vor der Veröffentlichung muss eine passende Kategorie ausgewählt sein.";
  }
  if (input.imageUrl && !protectedMediaKey(input.imageUrl)) {
    try {
      if (new URL(input.imageUrl).protocol !== "https:") throw new Error("invalid image protocol");
    } catch {
      return "Das Hauptbild hat keine gültige öffentliche HTTPS-Adresse.";
    }
  }
  if (!isListingDetailRouteSupported(input.type, input.companySlug)) {
    return "Für diesen Angebotstyp gibt es keine gültige öffentliche Detailseite.";
  }
  if (!input.providerAssigned || !input.providerContactable) {
    return "Vor der Veröffentlichung muss ein erreichbarer Anbieter mit Kontaktprofil zugeordnet sein.";
  }
  return null;
}
