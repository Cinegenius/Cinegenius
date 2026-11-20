# Compact map preview · 20 November 2026

Prepared, not published. Markus confirmed the tapped map preview was too large
and contained unnecessary empty areas. The Smart mobile CSS previously pinned
both top and bottom edges, stretching even a one-result preview. Its content
also reserved a separate empty row above the area heading.

The preview now sizes to its content, with a bounded scrollable maximum height.
The area heading shares the close-button row. The existing 44px close target,
result link, image sizes, typography, colors, map size and credits are retained.
No new interface strings, permissions, map services or data requests are added.
Ordinary DirectoryMap and Locations preview layouts remain unchanged.

## Verification

- 26 distinct Chromium/WebKit cases passed: actual SmartSearchMap, LocationMap,
  ResultCard, Leaflet markers, selection/cluster handling and preview links.
- Tested 320/393/834/1366px; German, Spanish, Hungarian and French; all four Smart
  areas plus ordinary Crew, Marketplace, Companies and Locations previews.
- Normal Smart entries measure 120px high at the checked widths, instead of
  stretching to the map height. Long native-style text remains bounded and
  scrollable. Close and result controls do not overlap and retain 44px targets.
- Open, close, reopen, cluster selection and navigation to the expected detail
  path passed. No horizontal overflow or runtime errors in the recorded checks.
- 41 existing map tests, 17-catalog localization, shared design checks and the
  touched component's lint passed. No full build is claimed for this style edit.

Browser plugin unavailable; existing Playwright was used. Data and basemap are
test fixtures; marker/preview interaction is the actual component. A native
appearance marker in a browser does not prove an iPhone installation. The
standalone Locations fixture needed a stable input array, then passed its
targeted rerun in both browsers; product LocationMap needed no change.

Evidence: `/srv/cinegenius/handoffs/20261120-compact-map-preview/receipt.json`.
APP takes the reviewed two-file product delta into its own current state. The
existing app release hold remains in effect.
