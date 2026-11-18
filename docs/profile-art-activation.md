> Replenishment, independent automatic style review and permanent deletion are updated in [profile-art-stock.md](profile-art-stock.md). The manual-only review workflow below describes the first activation.

# Personal artwork activation — 18 November 2026

This document supersedes the inactive-status descriptions in the earlier foundation,
image preparation, picker and refill documents. Source activation is authorized by
Markus's “aktivere es”. Exact deployment status is recorded in the release receipt;
a source commit or database migration alone is not a website release.

## Profile flow

Existing profile photos, v1 shared artwork and covers remain unchanged. A new setup
can suggest a current available avatar without leasing merely on opening the page.
An explicit selection reserves one artwork for five minutes. Explicit profile Save
can reserve the unchanged suggestion or renew it if still available. It never swaps
in a different image after expiry. Availability/connection failures retain all form
input; own photo uploads remain possible and photos remain optional.

`POST /api/profile-art` accepts the existing read/lease/cancel command schema, with
`X-Profile-Account` matching the current authenticated account. The server rechecks
identity, limits request bytes/deadline and uses an account-scoped request quota.
Read does not reserve. Responses are private/no-store. Tokens stay in memory;
private draft recovery may retain the image reference, never a lease token.

`POST/PATCH /api/profile` retains its ordinary validation and optionally accepts:

```
profileArt: {
  requestKey: UUIDv4,
  expectedUpdatedAt: ISO timestamp | null,
  choices: [{kind: "avatar" | "cover", token: UUIDv4,
             revision: integer, requestKey: UUIDv4}]
}
```

Use one parent request key for the same form/expected timestamp/choices after an
uncertain acknowledgement. Both image claims and the profile write commit in one
transaction; failure rolls everything back. Canonical image URLs come from server
leases, not client input. The profile response includes updated_at. Existing users
must supply their last confirmed timestamp; null is for creating a new profile.
The database also rejects assigning another account's v2 URL through older writers.
Owned artwork is not returned to the free pool when the owner uploads a photo.

## Delivery and generation

The public URL contract remains `/profile-art/v2/{avatar|cover}-<UUIDv4>.webp`.
No new image origin or native URL allowlist is needed. Private bucket, bounded files,
current approval checks, no-store and optimizer exclusion remain enforced.

Hourly `/api/cron/profile-art` checks the small free buffer and runs at most one
queued generation. Existing CRON_SECRET authenticates GET. A separate operator-only
PROFILE_ART_WORKER_SECRET authenticates POST for a controlled generation check.
Only production configuration can execute. Staged releases disable automatic GET;
manual checks still require the separate secret. No query/body supplies a prompt.
The existing OpenAI access is reused; generation is paid API use, never triggered
per page view. Daily jobs, time, bytes and queue lengths remain bounded.

Generated images enter **review**, not immediate public inventory. Perceptual tests
exclude byte/pixel/structural duplicates; an independent composition/content review
and fresh Storage read-back precede the maintenance-only approval. The worker cannot
approve itself. This review gate remains necessary; do not describe queued or
unreviewed images as selectable. Initial additional motifs use the user's approved
unused archived studies, normalized and separately reviewed against all 24 shared
v1 references. All source studies and original user media are retained.

## Database / operations

Apply only the targeted migrations in order: reservations foundation,
refill pipeline, `20261118131126_profile_art_atomic_profile_save.sql`, then
`20261118133702_profile_art_canonical_image_refs.sql`.
Settings default off. Enable the pipeline after the actual 24-reference fingerprint
baseline; enable reader/reservations after ready inventory and save checks exist.
Disabling the worker stops new generation. Preserve the reader and owned-art ledger
for existing profiles if refills are paused. Never repurpose the daily website agent.

Private operation receipts are bounded (2 days, account caps); persistent claims
are separate. No account names, private photographs, drafts or profile contents are
sent to the image provider. No public claims of semantic uniqueness from hashes alone.

## Verification boundary

Executed: transaction/permission tests on actual migrations; a rollback-only hosted
Supabase avatar+cover save/retry probe; real two-connection nonblocking contention;
private Storage upload/read-back; Chrome/WebKit picker, retry, input preservation
and responsive checks at 320/834/1440 pixels, including all 17 locales.
These browser fixtures are not a real native app or a logged-in physical device.
Native implementation must adopt the parent-save contract before claiming support.
Actual provider and production smoke results are in the release receipt.
