# City-first discovery filters

Status, 27 November 2026: implemented and checked on `codex/app-city-search-20261127`, based on `fcc8bf9071aac5a92e7b82f5b32b5ebda37008e3`. Not published or physically accepted on an iPhone. The later FCC8 seasonal documentation is retained. Shared Team files and permanent Work deletion remain a separate unpublished package.

## Interaction and scope

App Smart and the five native directory filters start with **city or place**, without requiring a country. Suggestions search the existing 31,793-city catalogue, its localized names and aliases. Exact and prefix matches rank before substring matches, followed by suggestion-only one-edit tolerance for normalized inputs of 5–64 characters. Typing never assigns a canonical identity; choosing a suggestion does. A catalogue city does not imply an offer exists there.

Country is an optional refinement containing only eligible entries' countries in the selected Crew, marketplace, locations, companies and jobs union. It is computed independently from the inventory, never from the currently loaded result page. City search remains global when a country query fails or a selected city has no exact-city offers. An existing city remains labeled and clearable without adding its country as an available inventory option. Radius becomes available after explicit city selection when its public catalogue centre exists.

Editing a city removes the previous city ID, region, derived country and radius. Smart also clears the old map bounds. An explicitly chosen country constraint remains until cleared. Other filters survive. Labels for saved global city IDs also resolve in all five directory chips and the Crew radius label. Profile/listing place writers and the ordinary desktop `PlaceFilters` retain their existing behavior. No native Swift source, GPS, AI, external geocoder, catalogue upgrade, migration or activation flag is added.

## Read contract

`GET /api/places/discovery?mode=cities&locale=de&q=Marakesch`

Optional `country=<ISO code>` restricts suggestions. Optional `city=geonames:<id>` restores an explicit saved selection. The response is `{version:1,mode:'cities',cities:[{id,name,canonicalName,countryCode,countryName,regionId,region,district,label,center}]}` with at most 30 catalogue options. `center` is a public canonical city centre or null, never personal/offer coordinates. This mode does not await Clerk or import the inventory/DB service.

`GET /api/places/discovery?mode=countries&surface=smart&locale=de&areas=crew,marketplace,locations,companies,jobs`

Required surface is `smart` or `directory`. Response is `{version:1,mode:'countries',surface,accountId,areas,countries:[{id,name}]}`. It exposes no source IDs, member names, contact data, country counts or coordinates. The client binds account, session, locale, surface and selected areas and discards aborted or stale responses. Empty `areas=` returns no countries or data reads. Invalid/duplicate selectors return 400; incomplete or failed inventory returns 503, never a misleading partial or empty success. All responses are private/no-store. The proxy adds only the exact existing public-read-path literal; mutation/origin and adjacent-path protections remain.

## Inventory rules

Smart Crew uses its existing named-profile source without a people predicate or creator-listing fallback. Directory Crew uses people-qualified profile geography and the actual settled fallback suppression: the initial 96 raw named profile IDs ordered by display name/user ID, union the later people-qualified IDs. Its legacy fallback preserves the raw newest-300 published creator candidate set, the current `publicListingIds` privacy view, owner location permission and first-per-owner precedence. It does not bypass Ghost, backfill the 301st record or move other offer types to a raw table.

Other offers retain `privacy_visible_listings`; companies retain independent published company geography. Jobs retain the existing published/type rule, without inventing an expiry rule. Profile/field privacy, Ghost, blocks, accepted friends and current viewer checks occur before country geography is included.

Complete keyset reads continue through an empty page even after a short nonempty backend page. Pages are bounded to 200 rows, at most 500 pages per source and an outer eight-second abort signal. Failure is explicit. Existing directory SSR caching and equal-created-at tie behavior remain: these are request-local eligible reads, not an atomic snapshot or a guarantee about later availability.

## Verification and remaining evidence

- 63 integrated controlled cases passed, covering actual modules, all 17 locale renders, privacy/source eligibility, global city choice, independent failures, stale scope/response handling, IME selection, radius and parent handlers.
- Full TypeScript, 22 design checks, 17-catalogue i18n and targeted ESLint passed. The normal Next 16.4.6 webpack release build passed. Static baseline pages used documented fallback behavior without service configuration; this is not a customer-data or live-inventory test.
- Independent source review checked the exact 37-path product/test delta, all 1,819 source inputs, the isolated type annotation, native-only presentation boundaries and retention of FCC8 documentation. No new actionable issue was found in that reviewed scope.
- Actual local Safari interaction with synthetic data at 393×700 and 320×400 covered Marakesch→Marrakesch, keyboard selection, Berlin→Wien, optional radius, Crew-only countries, country-503 independence and a global city absent from the available country list. It is not physical iPhone keyboard, authenticated account or hosted inventory acceptance.

One initial bulk typing action yielded `erlin`; subsequent first-letter, continued typing and rapid replacement checks passed. No product or tool cause is established. GeoNames/CC-BY attribution remains accessible. The existing Clerk matcher deprecation and baseline parent-component lint debt are unchanged.

Detailed source hashes, predecessor/failure evidence, independent review and local-preview observations are retained in `work/place-search-20261127/` in the Mac app task workspace. No publication, Cloud activation, real user deletion or native installation is implied by these checks.
