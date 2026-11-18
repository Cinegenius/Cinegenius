> Current activation and save contract: [profile-art-activation.md](profile-art-activation.md).
> The inactive descriptions below document the earlier foundation.

# Dormant platform-art producer, queue, storage and reader

This is a source implementation, **not an active service or available inventory**.
`PROFILE_ART_REFILL_ENABLED` and `PROFILE_ART_READER_ENABLED` are false, and the
database migration independently initializes both pipeline switches to false.
There is no worker schedule, public generation route or Server Action. Existing
profile forms, artwork, user uploads and private-media permissions are unchanged.
The prepared `ExclusiveProfileArtPicker` remains unmounted.

## Public image contract for Web and native

Only these canonical relative references are valid:

```
/profile-art/v2/avatar-<lowercase UUID v4>.webp
/profile-art/v2/cover-<lowercase UUID v4>.webp
```

No query, hash, encoding alias, nested path, owner/account identifier or arbitrary
remote URL is part of the contract. Native clients resolve these paths only on
their existing approved CineGenius HTTPS origins. No new origin is authorized.
The opaque media UUID is distinct from a person's identity. It grants no profile
edit or claim rights.

`GET` and `HEAD` return a current approved image, otherwise a uniform empty 404.
Avatar: 384×384 WebP, at most 64,000 bytes. Cover: 1500×600 WebP, at most 180,000
bytes. No redirects, signed URLs, owner metadata, ETag/304 or optimizer variants.
Responses use `no-store` for the browser and both CDN headers, plus `nosniff`.
The reader validates byte count/hash/container and rechecks the current descriptor
after storage I/O. It returns no bytes if approval was withdrawn meanwhile.

Ready art is readable. Retired art is readable only if it has previously been
claimed, preserving saved choices after assortment rotation. Quarantine blocks
all new reads, including previously claimed art. This cannot recall bytes already
downloaded. v1 references remain unchanged; v1 shared art is never relabeled as
exclusive. MediaImage and the Proxy optimizer guard bypass/block v2 optimization;
the platform local-pattern allowlist explicitly excludes v2 even if a file were
accidentally included under public. This does not classify v2 as owned user media.

## Actual server adapters

- `profile-art-producer.ts` sends one bounded request to the fixed OpenAI image
  generation endpoint with the existing server `OPENAI_API_KEY`. Model
  `gpt-image-2.6-flare`, low quality, one opaque WebP, fixed avatar/cover sizes and curated
  prompts. It accepts no user prompt, private photo or arbitrary URL. Only a
  single canonical base64 image is accepted; no URL fallback or automatic retry.
- `profile-art-refill.ts` claims one durable job, obtains the complete comparison
  snapshot **before** any paid request, runs actual raster preparation, persists
  normalized bytes, verifies them by reading them back, then stages review against
  the exact snapshot revision. Its successful result is `review`, never Ready.
- `profile-art-storage.ts` uses the existing server database wrapper's Storage
  client and a separate private bucket, `platform-profile-art`. Object keys are
  `v2/<kind>-<media UUID>.webp`. Bucket metadata must show private access, a positive
  maximum of 180,000 bytes and only `image/webp`. Upload uses `upsert: false` and
  cache-control 0. It neither creates a bucket nor reads/writes `protected-media`.
- `profile-art-refill-server.ts` binds real RPC/Storage adapters behind the false
  switches. `enqueueServerProfileArtRefill` and `runServerProfileArtRefill` are
  internal functions, not remotely exposed operations.

Response cap: 12 MiB; raw raster cap: 8 MiB. Stream readers also cap chunk count.
Provider deadline: 45 seconds; worker deadline: 75 seconds; database calls: 5
seconds; storage operations: 8 seconds; database claim: 90 seconds. Raster
preparation retains its separate bounded decode policy and cooperative budget.

The installed Storage SDK cannot cancel an in-flight upload. A timeout can leave
a private object at the job's journaled media key. The worker does not repeat,
overwrite, delete or publish it. Operator reconciliation must inspect it later.
Ambiguous staging/failure acknowledgements return `unconfirmed`, never success.
Neither a timeout nor an empty buffer automatically repeats a paid request.

## Durable jobs and global review boundary

Apply order, only after separately authorized deployment preparation:

1. `20261118012642_profile_art_reservations_foundation.sql`
2. `20261118022112_profile_art_refill_pipeline.sql`

The new private tables are `pipeline_settings`, `refill_jobs` and
`catalog_fingerprints`. They use RLS and explicit grants/revokes, including removal
of inherited default grants. Public/anon/authenticated roles have no access.
Service role has read access and only bounded RPC execution, no direct writes to
jobs, settings, fingerprints or artworks. Private definer routines implement the
bounded worker mutations with fixed search paths; the review routine is invoker
and is **not executable by service role**.

Queue bounds: 8 ready-or-pending images per kind, 16 pending jobs total, 12 newly
accepted jobs per UTC day, 512 retained journal rows. Exhaustion stops work until
reviewed maintenance; nothing is silently pruned. Request UUIDs are idempotent,
not reusable for another kind. Only one job runs at a time. Expired claims become
failed/interrupted rather than being automatically retried.

`profile_art_catalog_snapshot()` requires references for every legacy v1 asset,
every artwork (including retired/quarantined), and every staged review candidate.
Rejected fingerprints remain present. The snapshot covers both kinds together and
is capped at 20,000 references. A global advisory lock and revision protect
snapshot/staging/review against catalogue mutations. Conflicts use PT409, not
transaction-retry SQLSTATEs. The migration adds **no fabricated legacy baseline**:
until actual existing images have a complete reviewed fingerprint baseline,
snapshot reads fail closed and no provider request should run.

Staging binds the actual stored-byte hash to the job. Final release uses the
maintenance-only `profile_art_private.approve_candidate(job, revision, family,
review, verified_sha)`, requiring an independently reviewed canonical illustration
family, substantive content review, fresh read-back hash and current complete
revision. It repeats exact-pixel and near-structure comparisons across the whole
catalogue, then atomically creates the Ready artwork and retains its fingerprint.
The provider and service worker cannot approve their own image. Perceptual hashes
are duplicate heuristics, not proof of semantic originality; independent visual
review remains mandatory. New UUIDs, filenames, recolorings or changed image type
do not establish a new illustration identity.

## Verification and limits

Tests run actual migrations in offline PGlite with production-like broad default
grants, then check revocation, caps, idempotency, expiry, global revision conflicts,
review prerequisites, duplicate rejection and reader withdrawal. The complete
offline chain uses actual producer parsing, raster preparation, bounded storage
adapter, SQL staging/approval and byte reader with synthetic provider/storage
responses. No fixture is added to production inventory.

PGlite tests use one database connection; they do not establish multi-session
PostgreSQL lock behavior under real contention. No actual OpenAI generation,
hosted SQL, bucket operation, authenticated profile save, native-device test,
scheduled worker or production release was performed. Before activation, verify
real PostgreSQL contention, Storage configuration and readback, controlled provider
output, actual legacy fingerprint coverage, an independent review process, and the
separate atomic parent/profile-save integration. The existing full Next production
build security block remains a separate release limitation; it was not bypassed.

API references checked during source preparation:
[OpenAI Images](https://developers.openai.com/api/reference/resources/images),
[Supabase upload](https://supabase.com/docs/reference/javascript/storage-from-upload),
[bucket configuration](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

## Provider model review, 18 November 2026

The disabled adapter is pinned to `gpt-image-2.6-flare`. OpenAI's current
[deprecation notice](https://developers.openai.com/api/docs/deprecations) lists
1 December 2026 as the shutdown date for `gpt-image-1.5` and recommends Flare or
Sunburst as replacements. The current
[image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
supports the existing low-quality, opaque WebP request and both fixed input sizes.
Only this inactive producer changes; no other Genie model or access changes.
Synthetic request tests cover both kinds and the fixed model/settings. No actual
image request, quality assessment or provider billing verification was performed.
