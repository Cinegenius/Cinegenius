# Directory map counts — 20 November 2026

The public Crew, Companies, Marketplace and Locations directories distinguish the
full set matching the active search/filters from points in the map viewport.

- The toolbar count is the full filtered result count; moving/zooming the map
  must not replace it with a smaller viewport count.
- The Crew, Locations-provider and Marketplace-provider shortcuts count the
  current filtered selection, exactly like the map source. Markus superseded
  the older constant-person-count exception on 20 November after reporting
  221 in the toolbar versus 177 mapped + 25 unmapped (202 total).
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


## Follow-up: provider shortcut totals

20 November: the reported Crew screenshot had 221 in the toolbar and 202 in
the filtered map set (177 points + 25 unlocated). The old provider shortcut
exception caused this: it intentionally used allCreators.length while the map
used matching. The new operator decision removes that exception for all three
shortcuts; both visible and accessible toolbar counts now use matching.length.
No profiles, coordinates, filters or layout are changed.

The actual Crew page, filter controls and map summary were exercised against a
synthetic 221-person fixture: 202 Crew, 10 Location-only providers and 9
Marketplace-only providers. All selection/search/empty/reset and map-boundary
transitions passed in 10 Chromium/WebKit cases at 320, 390, 834 and 1366 pixels,
in German, Spanish and Hungarian. Map viewport events were simulated; there
was no actual native-device or production-account test. Browser plugin was
unavailable, so existing Playwright was used. Other directory source paths
were compared: Companies and Locations already use their filtered map source;
Marketplace keeps its checked remote total and pending/incomplete-map notice.

10 targeted unit cases, TypeScript, 17-catalog localization and shared design
checks passed. Evidence: `/srv/cinegenius/handoffs/20261120-crew-filter-count/`.
This follow-up remains unpublished, independent of the earlier live map fix.
