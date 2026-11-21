# Guided Smart discovery — 17 November 2026

## Scope and access

This is an expansion of the existing Smart result experience, not a new search
provider. Smart remains admin-only on the server and in the UI. Ordinary members
retain the static development preview; guests retain its notice. Locations remains
the homepage default. No database migration, model change, new paid integration,
persistent search history or booking action is introduced.

## Website flow

- On the Smart homepage tab and empty Smart search, three translated examples fill
  the existing input. They do not submit, navigate or invoke the AI. Users can edit
  them before explicitly searching.
- Existing plan interpretation, quantities, independent/shared places, requirements,
  exclusions, complete production crew selection and nearby alternatives remain.
  Full production starters also have deterministic patterns for the eight recently
  added languages. Unknown/qualified sentences continue through the existing model;
  these patterns do not guess away unfamiliar words.
- The plan editor is collapsed under “Deine Suche ansehen & anpassen”. Its existing
  per-wish editing and contextual follow-ups remain available, including unsent edits.
- A single account/plan/locale-scoped explorer owns results for both the map and list.
  Areas, individual wishes and available crew/marketplace categories can be toggled.
  Active choices are removable and there is one reset. Category choices come only
  from the permission-projected loaded results. Selecting multiple categories within
  an area is OR; filters across different dimensions are AND.
- Areas retain their shared colors: crew lime, locations orange, marketplace violet,
  companies blue. Other existing area colors remain. No homepage/brand redesign.
- Results are grouped by area and wish/production department. Explicit wishes precede
  recommendations within the area, nonempty groups precede empty groups, local
  matches precede nearby alternatives. Server relevance/distance order within each
  group is preserved. The first three nonempty groups per area start expanded, with
  three small uncropped previews each. All remaining groups can be opened; “more”
  first reveals loaded rows and then requests the group's next page.
- Pan/zoom does not call the AI, request results or silently change filters. Applying
  a map area explicitly filters the current selection by its public map positions.
  It does not change the search's original cities. Changing area/category choices
  preserves the map viewport; hiding the map keeps it mounted. Clearing the applied
  bounds fits the remaining selection again.
- Results without a public map position stay in the list, including when bounds are
  applied, with an explicit notice. Never infer precise coordinates, create pins for
  private locations or imply that unpositioned entries are inside the selected area.
- Counts deduplicate type/id across wishes. The map includes all loaded matching rows,
  not only the three cards currently expanded. A partial-results notice explains that
  filters apply to the loaded selection until more pages are requested.

## Additive API contract for native clients

The existing plan versions, request fields, combined result mode and per-group
cursors remain unchanged. `SearchResult` gains optional public facts:

```ts
facets?: { departments?: string[]; marketplace?: string };
evidence?: "role" | "title" | "requirements";
```

`departments` and `marketplace` use existing stable catalogue IDs; translate display
labels with the existing dictionaries. `role` means a matching declared public role,
not verified employment, expertise or the primary occupation. `title` means the
public result title contains the term. `requirements` describes a match to public
provider information, not an independent certification. Missing fields mean no
such evidence/category can be asserted. Never derive permissions from these fields.

All fields are populated only after the existing current privacy/visibility
projection. Ghost, protected media, map opt-out, linked identity restrictions and
approximate location areas retain their existing checks. List/map pagination still
rechecks admin and content permissions. No authorization decision is cached here.

For v2, reuse the combined response's map groups as the complete loaded pool for
both views. The existing server bounds each map page to 180 rows per group. Reveal
small slices locally, then use the group's existing rank/nearby/segment cursor with
`view: "map"`; merge by type/id only within that group. A changed local/nearby phase
replaces that group's previous phase. Old v1 links can fetch map groups separately.

Keep filter and view state ephemeral and tied to the authenticated account and
search. Account/plan changes abort in-flight reads and discard private results.
401/403 discards both views and restores the access notice. A timeout/ordinary error
keeps the confirmed rows, provides retry and does not trigger a paid interpretation.
The browser imposes a 35-second request timeout. An unsent new question is retained.

## Localization and verification

All new copy is in the existing 17 locale catalogs. No per-page translation calls,
additional locale loading system or automatic member-content translation was added.

See `docs/test-reports/smart-discovery-2026-11-17.md` for final checks and limits.
Native implementation and actual iPhone/iPad/Xcode checks are coordinated through
APP Entwicklung. Browser simulations are not native-device validation.

This document describes the prepared source change, not a production release.
Publication requires the operator's specific request and the guarded release path.

## Selected compact layout — 17 November 2026

This supersedes the earlier expanded filter panel and nested wish result cards.
Markus selected mobile option 1: a 220px map above compact results, with the shared
Crew list/map switch. Tablets use 280px; from 1024px the map occupies the larger
right column and results stay on the left. List mode hides, but retains, the map.

The count, available-area selector, filter action and shared view switch occupy one
row. Detailed area/wish/category filters are initially collapsed. Existing edits
remain available from the pencil by the Smart heading; that editor is independent
of the locale/result-scoped explorer so unfinished changes survive result refreshes.

Only areas backed by current visible result rows are shown. Within each area,
identical type/id pairs appear once, with the first server-ranked result retained.
Three compact rows are initially shown; More reveals six additional loaded rows,
then uses the original group's cursor. Empty result groups do not create cards or
filter options; their existing pagination remains reachable through More. Errors
retain confirmed rows. Counts and map points cover the full loaded selection, not
just expanded rows. No new availability, location or qualification is inferred.

The default area display order is Crew, Locations, Marketplace, Companies, followed
by other existing nonempty areas. Canonical IDs and server relevance are unchanged.
Map area colors, privacy projection, approximate-coordinate notices, unmapped rows,
provider attribution and explicit geographic filtering remain effective.

An authorized active Smart input has the existing Lime border and a restrained
Lime-tinted surface, both on the homepage and Smart results. Homepage styling uses
the same current-account server-admin predicate as Smart access. Other visitors
retain the existing notices/static preview and ordinary search styling. The change
does not enable Smart for additional accounts.

No API, migration, model, quota or locale-key change is required. All labels reuse
the existing 17 catalogs. Native implementation must retain actual safe areas,
input/keyboard state, current-account access and real Back navigation. Browser
layout checks do not establish native/Xcode device behavior.


## Native viewport synchronization — 21 November 2026

Only the installed native appearance now synchronizes the map/list selection after
Leaflet move/zoom completion. The map retains the full currently loaded,
permission-projected pool after area/wish/department/category filters. Bounds
filter the list separately, so panning or widening an empty viewport restores
previously offscreen results without rebuilding or repeatedly fitting the map.
Unpositioned or invalid-position entries stay available in a separate disclosure
using the existing translated notice; they never count as viewport matches.

The ordinary website keeps explicit Apply/reset. Source facts, public-coordinate
privacy, permission checks, stable pagination/deduplication, request aborts and
late-response rejection remain unchanged. An empty native viewport does not
automatically scan inventory pages. The map and API remain bounded to loaded
results; no database migration, paid search interpretation or new access is added.

Local verification: 87 targeted regressions and 57 actual component/Leaflet
Chromium/WebKit checks with synthetic rows, including zoom in/out after zero
matches, pan completion, missing positions, department change, map reentry and
ordinary website Apply. ESLint passed. Full-project TypeScript hit the local
default 2GB Node heap limit; the combined controlled release build must complete
its typecheck. Browser checks use an inert basemap boundary and prove neither
real map tiles nor a new physical iPhone installation or production release.
Evidence: local app workspace `work/native-smart-viewport-fix-20261121/`.

Native viewport review follow-up,21November2026: identical result identities use the same first canonical position as map markers before viewport partitioning. Hidden/zero-size native maps do not invalidate or publish bounds; a requested reset fit is deferred until visible size is available. Late native-marker hydration switches the managed resize mode and stale map-instance callbacks are rejected.90 targeted tests and80 real Chromium/WebKit checks passed; full TypeScript/build validation is pending the guarded release. Ordinary website callers leave the optional activity contract undefined and retain explicit Apply.
