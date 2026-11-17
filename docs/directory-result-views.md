# Compact directory views

Operator-approved views, 17 November 2026. Applies to Companies (`/companies`), Locations (`/locations`) and Marketplace (`/marketplace`, including the existing `/props` aliases). Crew keeps its current presentation.

## Shared behavior

The existing shared view control selects **grid**, **list**, or **map with list**. `DirectoryResults` positions the same result content and only mounts its map when selected; it does not load a second hidden map. Search, sorting, categories, place filters, favorites and pagination retain their existing permission-checked data sources.

- Grid: two columns on phones, three from 768 CSS px, four from 1024 CSS px.
- List: small thumbnail/logo, title, place, offer price and existing favorite action. Company logos remain uncropped. Real marketplace ratings and eligible rating actions remain available in grid view.
- Map with list: below 1024 CSS px, a compact map above the list; from 1024 CSS px, list left and sticky map right.
- Offer photos fill their frame while preserving their stored focal point. Missing photos remain valid; uploaded images keep the existing protected `ListingImage`/`MediaImage` path.
- Compact company/marketplace maps group approximate-position notes, unmapped-result guidance and geographic-data credits behind an accessible information disclosure; map-tile credits remain visible. Crew retains its existing notes.
- All view buttons and existing actions keep localized accessible labels and at least 44 CSS px touch targets. No new translation system or data schema.

Locations now starts in grid view at every width, matching the other two directories. A saved legacy `split` view restores as map with list. A map viewport constrains results only while the map view is selected, matching Companies and Marketplace; switching to grid/list restores ordinary filtered results, including those with no coordinates. The stored viewport is available when returning to the map. Existing explicit nearby-radius filtering still applies to all views and precise device coordinates are not persisted.

## App handoff

Use the same three presentation modes and existing API/privacy rules. Do not transfer these card styles to Crew. Keep actual native layout, gestures, safe-area behavior and stored view state in the native implementation. Website browser checks do not establish native-device compatibility.

## Validation and release

Regression coverage includes Locations filtering/viewport/pagination/nearby privacy, Marketplace account-scoped favorites/ratings and interrupted requests, shared map lifecycle and resilient media. Rendered browser checks cover the three views at phone/tablet/laptop widths. No production database migration or backfill is needed. The source handoff records the verified commit and actual release status; implementation alone does not publish it.
