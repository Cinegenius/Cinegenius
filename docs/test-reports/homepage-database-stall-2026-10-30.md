# Homepage and database stalls — 30 October 2026

## Scope and status

The reported symptom was an intermittently slow or completely white mobile page. The investigation followed the production homepage response, application logs, current database activity and the private form-recovery writer. No user content, credentials or private message text is included here.

The earlier manual-only logo release was already production `READY`. Automatic logo demonstrations had been removed. This investigation found a separate database failure; it does not establish that logo rotation caused the white page.

The corrective database migration is now applied and verified in production. The first complete homepage response after that correction took **1.240 seconds**, compared with the earlier unfinished 45-second request. The additional application safeguards passed local checks but are **not yet deployed at this report's pre-release checkpoint**. Keep post-deployment proof distinct from this database-only recovery evidence.

## Evidence collected before correction

- A public homepage request returned HTTP 200 and its initial bytes in **0.149 seconds**, but was still incomplete after **45 seconds**. It had delivered **205,376 bytes**, with no actual homepage `<h1>` yet present. A fast first byte did not mean a usable homepage had loaded.
- In an 80-record sample of recent production runtime logs, **74 records contained `PGRST003`**. The errors affected the homepage, profiles, listings, companies, projects, unread counts and notifications. `PGRST003` means a request timed out waiting for an available Data API database connection.
- Supabase's live connection view repeatedly showed **seven form-draft RPC sessions**, including advisory-lock waits. Their query ages repeatedly reset rather than exposing one old transaction. A representative process ID, **3707792**, matched the database error-log sample.
- The native database-log filter showed approximately **3,500 `draft_conflict` / `40001` errors in 60 minutes**. This is evidence of repeated stale-draft conflict execution, not a count of distinct user edits or failed accounts.
- The installed recovery function raised SQLSTATE `40001` for both an outdated expected revision and a nonzero revision against a missing snapshot. Those application inputs cannot become valid by automatically repeating the same transaction.
- Supabase documents this exact failure mode: custom business errors using `40001` or `40P01` can cause infinite internal PostgREST transaction retries and high CPU. [Official troubleshooting article](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

The matching error codes, repeated recovery RPC activity and documented retry behavior identify a concrete defect in the recovery writer. Other resource or network problems are not ruled out by these observations.

## Corrections

### Private recovery writer

`supabase/migrations/20261030150000_nonblocking_private_form_drafts.sql` replaces the existing writer without changing stored rows:

- Application version conflicts raise `PT409` instead of transaction-retry SQLSTATE `40001`.
- The existing account-and-form advisory lock becomes nonblocking. Contention returns `55P03` instead of occupying a connection while waiting indefinitely.
- A function-local two-second `lock_timeout` bounds later row-lock waits.
- Account scope, expected-revision comparison, idempotent retries after a lost acknowledgement, completion tombstones and service-only execution remain intact.
- No function-local `statement_timeout` is claimed as a reliable timeout for the outer already-running statement.

### Recovery API

`app/api/form-drafts/route.ts` combines the incoming request's abort signal with an eight-second deadline for the snapshot read and recovery RPC. Errors return a non-success response; the API never acknowledges a snapshot it has not confirmed. Both `PT409` and the legacy `40001` response map to HTTP 409 for deployment compatibility.

The last confirmed recovery copy and unsaved form input remain available after failure. The existing UI offers an explicit retry. This change does not add an automatic retry loop. Upstream authorization and rate-limit checks retain their existing behavior; the eight-second limit is not a claim that every earlier endpoint operation is bounded.

### Homepage isolation and community queries

The prepared application change in `app/page.tsx` renders the hero, search, discovery entry links and fixed explanatory sections outside the recommendation-data boundary. `HomeRecommendations` streams inside React Suspense. A recommendation query failure retains the usable homepage and shows a notice translated in all six supported languages instead of failing the entire route.

The homepage's optional photo request has a four-second abort signal and sets `includeTotal: false`. `lib/community-media-server.ts` skips the unused exact count only for explicit callers; the complete collection retains its default counted pagination. The same caller signal reaches the current block checks, media query and likes query through `lib/linked-profile-access.ts`. Failure never returns unchecked or partly authorized photos. An optional photo failure does not discard otherwise valid recommendations. No source allowlist, publication rule, privacy check or media permission is relaxed.

## Checks completed locally

The combined **50 targeted tests**, production build and six-language i18n check passed. Fourteen of those tests cover `lib/form-draft.test.mjs` and `lib/form-draft-db.test.mjs`; the latter applies the original schema and corrective migration to a fresh PGlite database.

Verified:

- A successful save, reload recovery, later edit and completion tombstone.
- Idempotent retry after a lost acknowledgement.
- Both stale-revision branches actually return `PT409`; the API reports HTTP 409.
- Stale requests do not overwrite newer saved input or resurrect a completed draft.
- The installed function body contains no executable `errcode = '40001'` conflict branch.
- A simulated busy-writer response does not change the confirmed snapshot or revision; a subsequent explicit retry succeeds.
- Abandoned read/write requests return failure and retain the confirmed recovery copy.
- Guest, cross-account and withdrawn-edit-access checks remain enforced; direct `anon` and `authenticated` table/function access remains denied.
- Scoped API ESLint and `git diff --check` passed.
- An actual React server stream emits the hero, search, discovery/offer entry points and explanatory content while database recommendation promises remain unresolved; the recommendations follow after resolution.
- A recommendation database failure leaves that static shell usable and renders its translated notice. An optional photo error leaves other recommendations available.
- Query-level tests verify count-free homepage requests still use the source allowlist, blocked-owner exclusion, ordering and bounded pagination; default collection counting remains intact.
- Cancellation tests verify the signal reaches block/media/like queries and an aborted or unauthorized lookup cannot leak partial discovery results or start later work.

PGlite has one backend. The busy response is injected at the API boundary; these tests do not reproduce PostgREST's internal retry machinery or prove real concurrent lock behavior. Production checks are required for that boundary.

## Production verification before the application release

- The migration transaction returned **`draft_conflict_fix_applied`** in Supabase. Function definition and service-only grants were verified; direct client execution remained denied.
- An own test save, idempotent retry and stale `PT409` conflict passed against the production database. Test rows were rolled back to a savepoint before the migration transaction committed.
- The existing recovery-row fingerprint remained identical. Existing drafts were neither rewritten nor removed.
- A tightly filtered attempt to retire the representative old process returned **zero rows**: no backend was terminated by that action. A subsequent activity check showed all seven old process IDs gone, **zero active draft saves** and **zero blocked sessions**.
- The first post-migration public homepage request completed with **HTTP 200**, **0.202-second first byte**, **1.240-second total time**, **407,458 bytes**, and the real homepage `<h1>` present.
- The in-app browser showed the complete homepage, its real heading and **five actual company logos**. This is browser evidence, not a physical iPhone test.

The streaming and API safeguards were not yet deployed when these measurements were taken. Their release identity, post-deployment request/error scan and responsive interaction proof belong in the separate release artifact. The pre-release recovery timing must not be attributed to application changes that were not live yet. Reload, Back, manual logo interaction and a physical iPhone/Safari check must be reported only if actually performed in that subsequent verification.

Do not turn a timeout into an empty successful response, loosen privacy rules, delete drafts or claim user data was repaired through a bulk rewrite.
