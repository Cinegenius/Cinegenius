/** Marketplace cards represent objects and vehicles, never Locations or animals. */
export function isMarketplaceOffer(type: unknown) { return type === "prop" || type === "vehicle"; }
