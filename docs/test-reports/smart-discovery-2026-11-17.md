# Smart discovery verification — 17 November 2026

Base: `057c4c9869ed1578fd026cdf9883c5377c33abc3` (`origin/main` at task start).
Implementation branch: `codex/smart-guided-discovery`.
Contract: `docs/smart-discovery.md`.

## Automated behavior

Production build including TypeScript passed. Localization passed for 17 catalogs
and 11,045 keys, with zero new source literals; targeted ESLint and the shared
design checks passed. The first build found stale generated development types for
the removed fixture; those generated types were cleaned and the complete build
passed. The production route manifest contains no fixture route.

- Existing Smart/Genie/home-search focused regression run: 263 passed, no failures.
- New discovery helper, expanded interpretation and server response regression run:
  38 passed, no failures. Covers composed map/list filters, current privacy projection,
  canonical facets/type boundaries, deduplicated pagination, local/nearby transitions,
  relevance order, multilingual full-production starters and qualified-input fallback.
- Shared map/layer regression run: 21 passed, no failures. Includes the new opt-in
  viewport preservation and explicit reset, existing default auto-fit, protected media
  previews, approximate location areas, clusters and stale-layer cleanup.
- Final expanded interpretation and base map run: 23 passed, no failures.

## Browser checks

The browser plugin was unavailable; the existing Playwright Chromium installation
was used. A temporary local-only fixture rendered the actual SmartSearchExplorer,
SmartSearchExamples, SmartSearchWishes, SmartSearchMap, LocationMap and result cards
with normal site CSS. Identity, result data and response failures were simulated.
The fixture has been removed from application sources and must never be deployed.

20 cases passed: all 17 locales at 393 CSS px, plus German at 320, 834 and 1440 px.
Checked example-to-editable-input behavior, area/wish/category selection, restoring
filters, compact results and local expansion, map show/hide, no horizontal overflow,
44px minimum controls, preserved input and cards after failures, retry and access
revocation. No unexpected runtime errors. Expected browser console errors were the
simulated 503/403 responses and the production Clerk SDK rejecting localhost (400).
Actual Clerk sign-in was not tested or bypassed.

An additional browser scenario passed real map zoom and drag, unchanged results
until explicit map-area application, matching filtering of list and map, retained
unmapped entries with a notice, stable viewport through area filters, reset, successful
pagination with deduplication, account reset and ignoring a late response from the
previous account. Filter/example/zoom/drag actions generated no search or AI calls.
Only deliberate pagination/retry generated result requests in that scenario.

Short English “All” controls initially measured below 44px; shared chip minimum width
was corrected and the locale pass repeated. Test selectors were scoped to actual
group headers instead of matching card titles. The final locale run waited for
fixture hydration and avoided code edits during interaction.

## Review and limits

- Shared existing design/colors, localized labels and safe-area bottom spacing remain.
- Combined server data feeds both surfaces; no duplicate v2 map read. Map code remains
  dynamically loaded. No model/quota change or durable search storage was introduced.
- Result facts are generated only from permission-projected public fields; the
  existing server-admin guard, Ghost/media policies and privacy regression checks
  remain. There is no new database schema or environment requirement.
- The existing Next.js 16.4.3 build advisory remains separately open, as already
  recorded in the profile identity/artwork handoffs; it is not introduced or fixed
  by this change.
- No live model interpretation, real authenticated production end-to-end search,
  Safari/WebKit, native Xcode app or physical-device test was performed. The local
  fixture cannot establish live data completeness or arbitrary natural-language
  accuracy. Existing server behavior is tested with controlled inputs/fixtures.
- APP Entwicklung receives the additive API contract, checked source and these limits.
  Native adoption/testing is separate. No production publication is claimed here.

Evidence stays on the server in
`/srv/cinegenius/research/20261117-smart-discovery/`: test logs, browser scripts,
synthetic fixture, screenshots and JSON results. No credentials or member data were
added to the repository. Final compilation/localization status is recorded in the
release handoff receipt; production release remains subject to operator approval.
