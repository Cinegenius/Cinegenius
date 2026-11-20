# Directory map counts — 20 November 2026

The public Crew, Companies, Marketplace and Locations directories distinguish the
full set matching the active search/filters from points in the map viewport.

- The toolbar count is the full filtered result count; moving/zooming the map
  must not replace it with a smaller viewport count.
- Crew, Location-provider and Marketplace-provider shortcuts use the same
  filtered result total as all other filters. The later 20 November correction
  supersedes the former unfiltered-person-count exception.
- The map badge counts only valid public points inside the current bounds.
- The shared `MapResultSummary` visibly explains mapped-in-view, mapped-outside
  and unmapped results. These partitions add up to the supplied result total.
- `Alle N anzeigen` switches to the list and clears the map bounds, retaining
  the actual search/category/place filters. Unknown points remain discoverable.
- The list beside/below the map still follows its viewport. Pagination counts
  refer to that list, never the larger toolbar total.
- Loading/failed incomplete Crew or Marketplace data must not be presented as a
  definitive map total. Existing error/retry flows remain in place.

Use only the existing permission-filtered public projections. The fix does not
infer ambiguous cities, expose private locations or modify stored data. A public
map point remains an approximate city position, not an address. Locations radius
filters continue to require actual usable coordinates; unknown-distance entries
must not be invented as nearby.

Smart and native organisation counts have their existing separate meaning
(loaded/deduplicated results versus server totals) and are coordinated with APP
Entwicklung. Do not apply this public-directory total contract to those surfaces
without their pagination/visibility logic.

## Evidence and limits

Read-only public company page inspection on 20 November: 63 records, 34 with a
public point (33 Europe, one Mexico), 29 without a unique point. The screenshot's
33 matched the European viewport, not the directory total. Counts can change as
members update their records.

Regression tests cover viewport changes/reset, missing and invalid coordinates,
dateline wrapping, privacy-projected inputs, incomplete results and existing
marker selection. Browser fixtures exercise actual directory components with
synthetic data and simulated map viewport events; they are not a live-data,
native-device or map-provider rendering test. Check the handoff receipt for the
final verification results and publication status.

Checks on this isolated change: TypeScript, i18n and shared design checks passed;
57 targeted regression cases passed. New/shared map components have no lint
errors. The full touched-page lint run retains three pre-existing Crew errors
(effect state reset, declaration order and render-time Date.now) and five existing
hook warnings; the Crew errors were reproduced from the untouched base commit.
No authentication, database, stored coordinates or publication changes are part
of this patch. No production build or native-device validation is claimed here.


## App follow-up for the reported Crew mismatch

The later WEB correction `5ba93dd7` is ported as a single source-line delta
as `a40a2bc6` onto the native map-count base `38d87bb4`. With the synthetic reproduction,
221 eligible people include 202 Crew, ten Location-only providers and nine
Marketplace-only providers. Selecting Crew must show 202 overall, not 221;
177 have a public point and 25 have none. Both the visible number and its
screen-reader description now use `matching.length`. Viewport changes still
only change the map number. The existing native `gesamt` caption is retained.

The prior mismatch was reproduced with the actual native toolbar at 320px.
The correction is checked using actual Crew/filter/dialog/map-summary
components with synthetic data and simulated bounds. Evidence, exact commit
and final results: `/srv/cinegenius/handoffs/20261120-app-crew-filter-count/receipt.json`.
All 29 targeted provider/map/native-count tests and 10 Chromium/WebKit cases
pass. The browser cases use the real native filter dialog and cover German,
Spanish and Hungarian at 320/390/834/1366px, checking the visible and accessible
count, search, empty states, reset and bounds changes. Map tiles, real accounts
and physical devices are not part of this check.
TypeScript, all 17 catalogs (11211 keys) and shared design checks pass. One
earlier type-check process was terminated with status 143; its separate log
is retained and the final independently recorded run exited 0. The full
production build was not repeated for this count-only line; the separate
homepage integration has its own successful build receipt.
No new endpoint, locale string, map coordinate, media, native theme or release
is introduced. The complete homepage rotation remains separately saved on
`codex/app-home-crew-rotation-20261120`; it is not bundled into this count delta.
