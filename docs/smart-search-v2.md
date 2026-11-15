# Smart search v2 — Web and native contract

Implemented 15 November 2026 on top of `516465a`. This document is not a
production release receipt. The last confirmed production source at the start
of this work was `ad3cb39`; release remains a separate guarded operation.

## Plans and old links

`/search?plan=<JSON>` and `POST /api/search/unified` accept versions 1 and 2.
Existing v1 links retain their old semantics and offset pagination. Newly
interpreted requests produce v2. Both retain the six-wish/four-places-per-wish
and 6,000-character bounds. More requests need an explicit split, not silent
truncation. Empty `places` means unrestricted; an empty place inside a v2 array
is invalid because it would accidentally broaden an OR condition.

Every wish retains `area`, `query`, `department`, `places`. V2 adds optional:

- `quantity`: integer 1–999; requested need, never available inventory.
- `recommended`: boolean, distinguishing inferred production suggestions.
- `requirements`: at most five AND groups, each containing 1–4 equivalent
  literal public declarations (OR within a group), maximum 60 characters each.
- `exclude`: at most six explicitly forbidden declarations, maximum 60 each.

The provider schema requires all four fields, with nullable `quantity`.
The boundary removes null quantity before validating a navigation plan.
Unknown fields and invalid values fail closed. V1 does not accept v2 fields.
Quantities/requirements are preserved rather than distributed across ambiguous
merged terms. Specific catering queries keep dietary/service requirements
together and use the existing structured catering matcher.

## Interpretation and refinements

Fully recognized catalogue clauses support optional conjunctions, quantities,
shared trailing places, independent role/place pairs and place-only alternatives.
Longest complete phrases win. Unrecognized names, modifiers, exclusions,
ambiguous attachment and speech/typing errors use the existing model rather
than dropping words. The model receives the general rules, not just examples.
No model upgrade, new provider, key, payment, tool mutation or database write
has been introduced.

`POST /api/genie` accepts optional:

```json
{
  "searchContext": {
    "plan": {"version": 2, "searches": []},
    "wishIndex": 0
  }
}
```

The empty searches above illustrate the envelope only; an actual plan needs
1–6 valid wishes. Omit `wishIndex` for a whole-search refinement. Context is
bounded, validated, checked for recognizable credentials and passed as
untrusted user content. It cannot grant permissions and is prohibited in
description-writing requests. Targeted edits must return the complete plan
without altering/removing other wishes; inconsistent output fails with
`search_unresolved`. A fresh self-contained request may replace a whole search.

Genie takes the most recent validated plan from its existing short-lived
conversation. Text and voice use the same path. Result-page refinements stay
in component memory and expire after ten idle minutes; unsent text survives
failure/expiry. Explicit continuation can reuse the visible filters. No new
server history or permanent browser store is added. Existing session-scoped
Genie retention and account-reset boundaries remain in effect.

## Matching, geography and pagination

V2 `Heads of Department` expands into independent catalogue department
segments. Exact declared lead roles qualify; assistant status, a biography or
a film genre does not establish leadership. Each segment independently finds
local results or nearest eligible alternatives. Thematic film starters search
relevant marketplace, locations and companies; no unrelated jobs/news query.
Small productions can receive a smaller model-selected starting crew. No
budget/date questionnaire blocks initial results.

Local results rank by declared role/title evidence (exact title/role, declared
additional role, title phrase, other matching text), then public approximate
distance and stable ID. This is not a quality score. Nearby results remain
distance ordered after all hard requirements. Explicit country/continent and
nonzero radius boundaries are never relaxed. Ambiguous city origins cannot
claim a nearest result. Requirements use only public text/selected public
facts; negated or contradictory declarations do not qualify. Missing facts
are not inferred from photos or private metadata. No availability or
qualification certificate is manufactured.

Groups add optional `segment`, `rankCursor`. Use
`area + ':' + wishIndex + ':' + (segment || '')` as the group key. For subsequent
pages forward the returned values, without editing:

```ts
cursor = {
  area, wishIndex, offset: nextOffset,
  segment,                 // only for v2 department-head groups
  rank: rankCursor,        // local v2: {score, distanceKm, id}
  nearby: nearbyCursor    // alternative pages: {distanceKm, id}
};
```

Omit absent fields. Rank and nearby are mutually exclusive. Local v2 cursors
use score 0–3 and a bounded distance/ID; only known head segments can be
requested. No cursor bypasses current visibility. A change from local to
nearby (or vice versa) replaces the old group rather than mixing it.

The initial v2 request can use `view: "combined"` without a cursor. It returns
`groups` (12 cards per group) and `mapGroups` (up to 180 per group), from one
permission-checked scan. Both have their own continuation cursors. Existing
default list and `view: "map"` requests stay available. Combined mode rejects
v1 plans and cursors. Candidate scans have four-worker concurrency, bounded
page windows and the existing deadline; a timeout is an error, not zero
results or an arbitrary nearest claim. Detailed evidence columns are loaded
only for requests needing them.

## Interface, privacy and native integration

Existing compact cards, image handling, colors and overall design remain.
Collapsed wish controls allow query, area, quantity and places to be edited
independently, or refined conversationally. Editors are initialized on first
opening; closing preserves unsent edits. Full search input starts a new search.
Recommendations and requested-quantity limitations are explicit in all nine
catalogs. No edit invents browser-history entries. Touch targets remain 44px.

All result requests still require membership, trusted mutation origin and
rate limiting. Current privacy projection precedes requirements, location,
ranking and map placement. Ghost, friend-only fields, public company bounds,
private offers and map opt-outs retain their existing rules. A visible profile
without a permitted map location may appear in the list without a pin.
Only canonical result projections leave the server; requirements evidence and
full candidate records do not. Responses remain private/no-store.

Native clients must accept v2 before consuming new links, preserve all fields
through voice/text follow-ups and forward segment/rank cursors. Use combined
responses to avoid a second initial map request. Keep current native sources
and UI; no Xcode/simulator/physical-device compatibility is asserted here.
No migration or new environment variable is required. Reverting application
code leaves stored user content untouched, but a v1-only client will not
understand new v2 links.

## Verification scope

Automated tests cover old/new links, bounds, negative constraints, quantities,
multi-place grammar, model-response validation, current-account context,
spoken follow-ups, expiry, privacy, segment/rank pagination and combined map
parity. Browser checks use actual components/styles/map with simulated
authentication/API, all nine locales and 320/393/834/1440px viewports. Read-only
public-catalogue checks compare complete list/map results for film planning,
catering and independent city wishes. This is not an authenticated production
session, native device test or a real-model free-form quality evaluation.

Evidence directory: `/srv/cinegenius/audits/20261115-smart-search-expanded`.
Production status and exact checked commit belong in the handoff receipt,
not an inferred “already live” statement.
