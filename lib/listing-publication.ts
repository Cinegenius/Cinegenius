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

/** Completeness checks for provider submission/publication. Admin quality decisions are separate. */
export function validateListingPublication(input: ListingPublicationInput, translate?: (key: string) => string): string | null {
  if (!input.title?.trim() || !input.city?.trim()) {
    return translate ? translate("ServerCopy.s_29ff957be269") : "Vor der Veröffentlichung müssen Titel und Ort eingetragen sein.";
  }
  const visualListing = ["location", "prop", "vehicle", "animal"].includes(input.type);
  if (visualListing && !input.category?.trim()) {
    return translate ? translate("ServerCopy.s_b2986f18f24f") : "Vor der Veröffentlichung muss eine passende Kategorie ausgewählt sein.";
  }
  if (input.imageUrl && !protectedMediaKey(input.imageUrl)) {
    try {
      if (new URL(input.imageUrl).protocol !== "https:") throw new Error("invalid image protocol");
    } catch {
      return translate ? translate("ServerCopy.s_a91db39ecd6c") : "Das Hauptbild hat keine gültige öffentliche HTTPS-Adresse.";
    }
  }
  if (!isListingDetailRouteSupported(input.type, input.companySlug)) {
    return translate ? translate("ServerCopy.s_6312926c554a") : "Für diesen Angebotstyp gibt es keine gültige öffentliche Detailseite.";
  }
  if (!input.providerAssigned || !input.providerContactable) {
    return translate ? translate("ServerCopy.s_4754b7cb2095") : "Vor der Veröffentlichung muss ein erreichbarer Anbieter mit Kontaktprofil zugeordnet sein.";
  }
  return null;
}
