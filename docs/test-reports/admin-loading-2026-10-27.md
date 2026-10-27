# Admin loading — 27 October 2026

## Evidence

- The signed-in Safari session could access `/admin` as Markus Müller. In 35 recent production request records, admin pages and overview/profile reads returned 200; the one signed-out admin visit redirected. No repeated 403 was found. Request records did not provide trustworthy end-to-end durations, so no production speed multiplier is claimed.
- The client previously rendered no admin content until Clerk initialized, despite the server layout already confirming admin access. The global session boundary also used a temporary signed-out key during initialization, remounting the page once the same session resolved.
- Every admin entry and administrative edit fetched the entire overview: nineteen count queries and a separate recent-listings query. The latter waited for all counts, adding a serial database round. This also happened when opening the saved Profiles tab.

## Changes

- Reuse the existing server-confirmed admin identity for initial rendering and account-scoped view restoration. Resolved sign-out still removes the admin UI; API and layout permission checks remain unchanged.
- Preserve the server's session identity while Clerk initializes. The same session no longer remounts the application; an actual session switch/logout still resets client state.
- Fetch full overview data only for the overview. Other sections request three attention counters through the same protected endpoint, preserving navigation badges without loading all inventory counts and recent listings. Administrative changes still refresh the appropriate counters.
- Start recent listings alongside count queries. Keep no-store responses; add numeric Server-Timing diagnostics for authentication/database phases, without identifiers or credentials.
- Load the Support center code when its tab is opened.

## Verification

- Actual client components tested in the local Next.js browser fixture with own accounts and records. Restoring Profiles after reload requested only `/api/admin/users` and `/api/admin/overview?summary=attention`, with no full overview read.
- With simulated delayed Clerk initialization, the server-confirmed admin section stayed visible and its history controls remained owned by `test-a`. Resolving to signed-out hid the section.
- Regression tests verify initial rendering, same-session stability, session/account reset, all twenty full-overview reads starting concurrently, exactly three attention-only queries, unchanged response shapes, no-store/timing headers, and zero database reads for unauthorized requests.
- 640 automated tests passed, together with TypeScript, targeted lint, translation and design checks. Browser tests used desktop/simulated auth conditions; no physical-device timing result is claimed.

No member content, verification state or permissions were changed for tests. No database migration is required.
