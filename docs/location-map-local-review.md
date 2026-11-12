# Location map — local review, 12 November 2026

Base: 05b28fdf6a9b2587d79065e7ad3818f93bc5c67e. No commit, push, database rollout or deployment is part of this work.

The existing shared mobile list/map controls and filter computation remain authoritative. Applying a visible map area filters that same result set; merely moving or zooming offers the action. Reset is available on the map and via an active filter chip. Automatic fitting does not apply a search area. Touch previews use MediaImage, the shared pricing formatter and canonical localized places/categories. Coincident city points can be selected from a cluster at maximum zoom. Missing or invalid geocoding is unknown, with no invented Munich fallback in location search or detail.

## Private exact position and public 500 m area

After creating a private location draft, or while editing a location in the dashboard, the provider can save exact coordinates and an optional private address. This is a separate explicit save. Address-to-coordinate lookup is deliberately absent: exact addresses are not sent to an external geocoder. Existing city-level geocoding continues for locations without a private position.

Exact data lives in `listing_private_locations`, never in public listing metadata. The service-only `listing_private_location` function rechecks personal/company editor rights on reads and writes, locks the listing, uses a private revision and atomically writes the public area. Company membership removal immediately prevents reads, writes and recovery-draft access. Anonymous and authenticated database roles have no table/function grants. Responses prohibit browser/CDN caching. The provider's recovery copy uses existing account-scoped private form recovery.

The public area uses a stable approximately 445 m grid cell center with a 500 m radius. Its center is derived rather than the exact position; stable cells prevent repeated requests producing independent offsets that could be averaged. Tests cover 10,000 positions including poles and the dateline and verify that the exact point remains within the circle. Public search/detail get only the approximate center and radius. Filtering uses that approximate center, not secret coordinates. A circle represents an approximate area, not a guarantee of any exact address. Member-entered public descriptions must still avoid exact addresses.

Saving/changing/removing the private position updates public area metadata in the same transaction. Existing offer moderation then invalidates the prior approval; the location must be reviewed again. Failures roll back both writes. Concurrent or stale editors get a conflict; deleting and re-adding a position retains revision protection. Repeating an unchanged save preserves approval state.

## Database preparation required before any future release

`supabase/migrations/20261112180000_private_location_areas.sql` must be reviewed and applied in the intended database before releasing the feature. It is additive and rerunnable, does not rewrite existing locations, and is tested in an isolated PGlite database with the actual offer-moderation migration. A missing migration fails closed with an unavailable message; the editor never falls back to storing exact data publicly.

For rollback, revert the application feature first and retain the private table/data and restricted grants. Do not drop the private table or copy its contents into public listings. Existing public `location_area` metadata may remain as approximate information; remove it only through a reviewed data change if required. No production migration was applied here.

## Verification scope

Local automated checks cover the actual React map handlers/effect cleanup with a Leaflet test double, list/map result parity and filters in all nine locales, server search projection, missing/invalid coordinates, authenticated private endpoints, access withdrawal, revision conflicts, SQL grants and transactional rollback, existing moderation, form recovery and protected-media guards. These are automated interaction and database tests, not a visual browser acceptance test.

TypeScript and localization checks pass. Targeted lint passes for the new/changed feature components. The pre-existing dashboard retains its same 14 lint errors and 6 warnings; the detail server page retains its same single unused-variable warning. Baseline comparison found no new findings in those files.

Browser automation is disabled in the Work settings. No live Supabase/Clerk runtime credentials are available in this checkout. Real authenticated HTTP flows, responsive visual layout and actual Leaflet rendering therefore remain unverified. No security protections or production data were changed to enable testing.
