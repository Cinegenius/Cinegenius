# Exclusive personal artwork: inactive reservation foundation

This package prepares account-bound reservations for **both avatars and covers**.
It does not activate a picker, assign artwork to existing profiles, generate files,
change URLs, apply SQL or publish anything. Company motifs are a separate package.
The base is the shared profile-layout commit `7299bae`.

## Boundaries

- `PROFILE_ART_RESERVATIONS_ENABLED` is false. The database singleton also defaults
  to false. No route, Server Action, UI or existing profile writer calls this code.
- `runProfileArtReservation` is server-only and uses the existing Clerk-backed
  `getCurrentUser`. The body cannot supply an account, expiry, URL or media key.
  No client obtains database service credentials. There is no confirmation command.
- Seven private-schema tables have RLS and explicit revocations, including inherited
  default grants. `anon` and `authenticated` cannot read or mutate the ledger or
  execute its RPCs. Service access can read, lease and cancel, but cannot enable
  the feature, insert catalogue artwork or directly confirm ownership.
- No new text is exposed to customers. Machine codes are internal. Future UI/error
  integration must use all 17 existing language catalogs and current-account draft
  recovery, without a parallel translation system.

## Identity and inventory

`artworks.illustration_key` identifies the **reviewed canonical illustration family**
independently of URL, UUID, encoding, crop, size or palette. Its unique constraint
is global across avatars and covers. Source-byte hashes provide a second duplicate
check. Identity, source bytes and the opaque media key are immutable after insertion.
Quarantined entries cannot be selected. Ready entries require a recorded identity
review; no automatic readiness path or ingestion RPC is provided here.

A unique string alone does **not** prove two drawings differ. The separate producer/
normalization/review work must assign the same identity to all variants and reject
semantic duplicates before marking anything ready. This migration does not implement
perceptual image comparison. The catalogue starts empty, so it cannot silently
declare unreviewed images exclusive.

The 24 deployed v1 files are **legacy-shared**. Their original paths and bytes remain
untouched. All 24 exact source hashes are denylisted for exclusive inventory; a
re-encoding also needs the future family-level ingestion review, not just a new hash.
The eight unused avatar and eight unused cover SVG studies are only a finite possible
buffer, not loaded inventory and not an automatic replenishment system.

`media_key` is an opaque internal identifier, **not a URL**. The new canonical public
path/storage contract remains undecided. Do not disguise application-generated art
as a member upload in `/api/media`, broaden native URL allowances or rewrite v1 URLs.

## Lifecycle

1. `profile_art_choices` performs SELECT only. It lists at most 24 ready unclaimed,
   unleased motifs, plus the current account's confirmed selection and current lease
   separately. It never creates a slot, reserves, renews or performs expiry cleanup.
   Other owners, tokens, source fingerprints and review notes are not returned.
2. A deliberate selection calls `profile_art_lease` with an artwork ID, kind,
   expected revision and stable UUID request key. The authenticated account is bound
   on the server. A lease lasts **five minutes of server time** in this foundation;
   the final UI contract may review that duration. There is at most one lease per
   account and type and one lease per artwork.
3. Replacing a lease checks the target first, then releases/replaces the old lease
   within the same transaction. Any failure rolls back the replacement. Expired
   leases can be reused; a stale token cannot confirm them. A retry of the same key
   returns the original unexpired receipt without extending its expiry. A reused
   key with different input, or a retry superseded by a newer choice, returns 409.
4. `profile_art_cancel` removes only the current account's unconfirmed lease and
   advances the revision. Confirmed selection and durable ownership remain intact.
5. `confirm_in_profile_save` is an **ungranted private helper**, including no grant
   to service_role. A future validated transactional profile writer must call it
   and write the canonical profile image references **in the same transaction**.
   It is not a separately callable save step and does not itself update profiles.
   Both avatar and cover must be included in that one profile transaction. A local
   test-only writer demonstrates all-or-nothing behavior, including rollback after
   confirmation when another profile field or second image fails validation.
6. Confirmed ownership remains attached to that account even after it chooses a
   different image. Previously used artwork is not put back into the shared pool.
   Current selection remains readable even if inventory is empty or the image is
   later retired. Account deletion/retention rules require a separate reviewed policy.

## Concurrency and errors

Nonblocking transaction advisory locks serialize account actions and artwork claims.
Catalogue edits take the same artwork lock. Unique database keys enforce one live
lease per artwork/account-kind, one durable owner and one canonical family identity.
Row locks use NOWAIT; lock waits are bounded. Expected revisions reject stale tabs.
Normal conflicts use `PT409`, never the transaction-retry SQLSTATEs.

Successful request keys retain their payload and receipt. Replays are accepted only
while that receipt describes the current state. No resurrection of old leases or
silently different replacement occurs. Cleanup/retention and abuse limits for this
private operation journal must be defined before activation.

Internal codes include `ART_REVISION`, `ART_UNAVAILABLE`, `ART_EXPIRED`, `ART_BUSY`,
`ART_KEY_REUSED` and `ART_STALE_RETRY` (409). Invalid input is 400. Disabled/missing
capability is 503. A database cancellation rolls back the transaction. A **network**
timeout can instead lose a committed acknowledgement: the client must retain its
unsaved state and retry the identical key/read authoritative state, never assume
either success or guaranteed rollback from elapsed time alone.

## Verification and next integration gate

Tests execute the actual migration in isolated PGlite with production-like broad
default grants, and verify explicit permissions, variants/duplicates, all legacy
hashes, lease replacement/expiry, stale requests, ownership and rollback of an atomic
avatar+cover profile-save harness. Pure-command and server-adapter tests verify auth
binding, invalid input, disabled execution and safe error projection.

PGlite exercises one connection. Contending schedules and uniqueness are covered,
but a real concurrent multi-connection PostgreSQL/PostgREST test is still required
before activation. No production advisors, hosted SQL, physical device, real login,
image provider, URL rendering or full deployed profile-save path is claimed.

Next work must supply reviewed real inventory, deduplication/normalization, the
storage/URL/native allowlist contract, a bounded actual producer and refill queue,
and a validated atomic profile writer with parent-level idempotency/revision. It must
also protect all older raw-URL/profile-save paths from assigning someone else's new
exclusive art. Then integrate UI/recovery/account-switch guards and 17-language copy.
Existing shared v1 artwork and private uploads must continue to work throughout.

Reference: [Supabase database functions](https://supabase.com/docs/guides/database/functions),
[PostgREST custom error codes](https://docs.postgrest.org/en/stable/references/errors.html).
