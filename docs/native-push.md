# iOS push: source implementation and inactive rollout

This code does not activate Push Notifications, install an entitlement, schedule a provider job or supply Apple credentials. Ordinary Debug builds remain usable without paid push capabilities. `NATIVE_PUSH_ENABLED` must explicitly be `true`, all APNs configuration must validate, and the private database settings must be enabled for the same bundle/environment with a recent successful worker heartbeat. Otherwise registration/dispatch capabilities are false. Native UI readiness only means the settings window exists.

## Account and installation contract

Version: `cinegenius.push.v1`. JSON requests require `X-Push-Account` and `X-CineGenius-Push-Contract`. The server reuses current-request authentication, obtains the Clerk session ID itself and freshly checks that session with Clerk. A client-supplied user/session ID is not accepted. Mutations also require a trusted first-party Origin/Referer.

After an explicit user action and iOS authorization, native code creates an installation UUID and32 random bytes in ThisDeviceOnly Keychain storage. The canonical43-character Base64URL secret is sent only in `X-Push-Installation-Proof`; only its SHA256 hash is stored. It never goes into DOM, URLs, responses or application logs. APNs tokens are transient native callback data and private service-only database values, never GET output. Infrastructure instrumentation must redact these request headers/bodies as well.

- `GET /api/native/v1/push/capabilities`
- `GET|PUT|DELETE /api/native/v1/push/registrations/{installationUUID}`

Every JSON response has `{contract,accountId,serverNow,capabilities:{register,dispatch}}`. Capabilities additionally returns `server:{bundleId,environment}|null`. Registration GET returns `{installationId,revision,binding}`; binding is `own`, `different-account` or `absent`. Only `own` includes `{preferences:{messages,notices},locale}`. Own requires both current account and session; a new session for the same account is absent with an opaque revision and no inherited opt-ins, requiring a new conscious choice. A wrong proof gets a closed404 without revision/account details.

PUT accepts exactly `{expectedRevision,deviceToken,authorization:'authorized',environment,locale,preferences:{messages,notices}}`. Bundle is server-owned; environment must match. `expectedRevision` is null for an unseen installation and otherwise the opaque revision from a fresh authenticated/proven GET. Successful PUT confirms the own view and exact preferences. A deliberate account handoff uses the same installation proof and CAS; it never returns the former account identity. A late old-account PUT cannot overwrite the newer revision.

DELETE accepts exactly `{expectedRevision}` and confirms `{installationId,revision,revoked:true}`. It only revokes the current matching account/session binding; a foreign/new account binding is not deleted. A missing installation is closed with a proof-bound tombstone, so a delayed first PUT with null revision cannot resurrect it. Revocation clears token, token hash, account/session, locale and opt-ins. Keep the native installation proof/UUID for subsequent safe CAS handoffs.

Errors contain only `error:{code}`:401 unauthorized,409 account_changed/conflict,400 invalid,403 invalid(origin),404 not_found(proof),429 rate_limited,503 unavailable.409 exposes no revision; re-read with proof. No error includes tokens, proof, provider details or private message content.

## Durable event and delivery flow

The CLI-generated migration creates an unexposed `native_push_private` schema. Tables have RLS, no anon/authenticated grants, and only the closed service-role RPC is callable. It creates no historical queue entries and defaults disabled.

An AFTER INSERT trigger on real messages creates outbox entries for active genuine conversation members other than the sender, honoring the join boundary, current blocks and message read receipts. It creates no artificial Inbox notifications or counter entries. The separate notifications trigger handles new unread notices; legacy `new_message` notification rows are skipped to prevent duplicate message pushes. Both triggers participate in the original transaction, so rollback removes the event and queue together. Existing message RPCs, mail behavior, recipient rights and response semantics remain intact.

Once private settings have been deliberately enabled, eligible new events for matching active registrations remain durable even when the worker heartbeat is stale or missing, or the provider is in cooldown. These conditions still prevent claims and dispatch until recovery; they never discard a newly committed event. Recovery consumes those queued events subject to their original expiry and fresh permission/read checks, without backfilling pre-activation or historical sources.

If temporary readiness disappears after a lease has already been claimed, prepare releases that still-valid job to pending with a bounded delay and reports it as retry, without exposing dispatch data or contacting APNs. Expired work, read events, lost permissions and obsolete registration revisions remain cancelled. A stale lease cannot complete the deferred job.

Unique `(source_kind,source_id,installation_id,registration_revision)` keys prevent duplicate event entries. Registration changes cancel obsolete work. A successful newly-created message ACK schedules a best-effort Next16 `after()` wakeup. That function only consumes the already durable outbox; it never inserts a second event. It is disabled with the feature and catches scheduling/provider errors. It cannot retract a previously confirmed message. A separate, approved scheduler is still required for retry, notices and process-crash recovery.

The POST-only `/api/internal/push-worker` reuses the existing timing-safe cron-secret guard. GET/HEAD cannot dispatch. It reports aggregate technical counts only. The worker claims at most10 jobs under90-second leases; it freshly verifies each bound Clerk session, loads generic catalog copy, then rechecks current source/read state, membership, join boundary, blocks, registration revision and opt-ins directly before APNs. A revoked session disables only its unchanged registration. A temporarily unavailable identity provider causes retry, not an assumption that the user is active.

Payloads contain only the fixed CineGenius title, localized generic message/notice text and the closed destination `messages|notifications`. No name, message text, private URL, conversation ID or user ID is sent. A session/permission/read change after the final check can still race an in-flight generic APNs request; tapping must always use current app authentication and server rights.

An APNs200 is counted as accepted, never delivered/read. Stable per-job APNs IDs and collapse IDs reduce retry duplication but cannot provide cross-provider exactly-once delivery after a lost ACK.400 invalid-device/410 responses only invalidate the unchanged registration revision, and410 timestamps cannot invalidate a newer registration.429/5xx and transport failures use bounded backoff and expiry. Configuration errors block readiness temporarily and do not invalidate device tokens. Work expires within24 hours with at most8 claims; completed records are pruned after7 days and proof-only revoked tombstones after30 days.

## Configuration and remaining proof

Server variable names are `NATIVE_PUSH_ENABLED`, `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_ENVIRONMENT` and the existing `CRON_SECRET`. No values or credentials are committed. Private SQL settings, a matching worker heartbeat and an explicit native build opt-in are additional gates. Activation, schema installation, scheduler setup, Apple account/capabilities/provisioning and a real-device send/receive/tap/logout test remain separate and unperformed here.

Local evidence uses PGlite with synthetic accounts, memberships, reads, proofs and tokens, plus injected Clerk/APNs/Next-after transports. No `.env` files, real accounts, real database, provider connection or phone are used. Offline ACL tests are not a live Supabase advisor run. Actual delivery, native prompt behavior and the production scheduler are not certified by source tests.

References: [Apple APNs registration](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns), [Apple response handling](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns), [Clerk backend Session](https://clerk.com/docs/reference/backend/types/backend-session), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Installed Next16 `after` documentation was read before adding the wakeup.
