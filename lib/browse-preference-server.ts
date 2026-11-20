import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { ownBrowsePlace } from "@/lib/browse-geography-server";
import { countryCode } from "@/lib/places/core";

/** Request-local only. Country is a coarse display preference, never permission.
 * Do not infer a city, persist an IP, or use language as a location. */
export const preferredBrowsePlace = cache(async () => {
  const own = await ownBrowsePlace();
  const request = await headers();
  const country = process.env.VERCEL === "1" ? countryCode(request.get("x-vercel-ip-country") ?? "") : "";
  // A traveller opening the site in Mexico should see Mexico first, even if
  // their profile is based elsewhere. A saved city only refines the same country.
  if (own.place && (!country || own.place.country === country)) return { ...own, source: "profile" as const };
  return { userId: own.userId, place: country ? { country, region: "", city: "" } : null,
    source: country ? "request" as const : "none" as const };
});
