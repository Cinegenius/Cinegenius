import * as jobs from '../job-metadata.ts';
import * as geography from '../browse-geography.ts';
import * as mapPoints from '../places/public-map-point.ts';

// Pure production helpers stay real. These owner/taxonomy fixtures represent a
// visitor without a geographic preference; the dedicated geography tests cover
// authenticated profile lookup, its failures and account boundaries.
export const listingBrowseDependencies = {
  '@/lib/job-metadata': jobs,
  '@/lib/browse-geography': geography,
  '@/lib/places/public-map-point': mapPoints,
  '@/lib/browse-geography-server': { ownBrowsePlace: async () => ({ userId: null, place: null }) },
};
