# Compact Smart layout and Lime input — 17 November 2026

Base: `cedb788fe92b993126da88bd74d03ba5c8bddb79`, equal to `origin/main` before this change.
Branch: `codex/smart-guided-discovery`. Contract: `docs/smart-discovery.md`.

## Scope

The operator selected option 1 from the latest mobile collage: compact map above actual area-grouped results, shared list/map switch. Desktop retains a large right map and compact left results. The authorized active Smart search input now uses the existing Lime accent on the homepage and Smart results. Existing current-account/server-admin access, ordinary search and member/guest development previews remain intact.

Filters start collapsed; area selection contains only loaded, nonempty areas. Rows are deduplicated by type/id while preserving the first server-ranked facts. Each area initially shows three rows; More expands cached rows before using existing group cursors. Empty cursor groups remain reachable without empty area cards. Unknown coordinates stay in the list and are not invented. No database, model, quota, API schema, durable search storage or locale-key change.

## Checks

- Targeted automated behavior: 56 passed, zero failed (discovery helpers, map projection, Smart access/client flows, existing marketplace UI). The final area-order helper run passed all eight checks.
- Targeted ESLint passed; shared design checks passed. Localization passed: 17 catalogs, 11,045 keys, no new source literals.
- Production build passed, including TypeScript and all 159 static pages. The production route manifest contains no preview fixture. The build logged a homepage recommendation fallback notice during prerendering; this is not a live recommendation-data completeness check.
- 21 Chromium browser cases passed: all 17 locales at 390 CSS px, plus German at 320, 834, 1024 and 1440 px. Checked collapsed filters, nonempty area options, category selection, reset/Escape/focus recovery, list/map switch, 44px actions, no horizontal overflow, retained text and rows on failure, pagination retry and access revocation.
- Additional real-map browser scenario passed zoom and pan without searches, explicit geographic filtering, retained unmapped rows, stable viewport through local filters, reset, successful pagination/deduplication, account reset and ignoring a late previous-account response. The short desktop list keeps its 12px gap below controls. Unsent wish-editor text survives closing/reopening.
- Filters and map/view movement made no search or AI requests. Only deliberate pagination/retry used the existing result endpoint. No unexpected runtime exceptions; expected localhost Clerk 400 and simulated 503/403 responses are separately recorded.
- Actual captures were compared with the selected reference. Map heights: 220px phone, 280px tablet; desktop large right pane. Normal compact images remain permission-aware and contained. Existing basemap attribution and coordinate-approximation information remain available.

The temporary fixture rendered the real components/styles with synthetic identities/results. It is archived outside the repository and removed from application sources. Authentication was not bypassed. Evidence: `/srv/cinegenius/research/20261117-smart-layout/` (logs, scripts, screenshots, JSON results, visual review).

## Limits and release

No real signed-in production search, model interpretation, Safari/WebKit, physical-device or native/Xcode test was performed. Browser simulation is not a native-app verification. The fixture header is signed out while the concept depicts a member; the existing header was not altered to imitate authentication. Existing Genie voice behavior is unchanged; no nonfunctional microphone from the static concept was added.

The existing framework advisory remains separately tracked and is not introduced or fixed here. APP Entwicklung receives the checked commit, shared flows, unchanged interface contract, test evidence and device limits. This document does not authorize or claim production publication; this new layout still needs an explicit release request.
