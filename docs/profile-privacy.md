# Personal privacy controls — 14 November 2026

Operator decisions: add a strict Ghost mode and independently selectable profile, location, map/nearby search, presence and contact audiences. Markus explicitly confirmed that Ghost also hides personal published offers, including from accepted friends. Company visibility is independent. Preserve the existing visual system.

## Account API and native contract

Authenticated `GET /api/user-settings` returns `settings`. `PATCH` accepts only known fields, optionally `accountId` matching the authenticated account. Never authorize from that supplied ID. Responses are private/no-store; unknown schema or write errors are not successful acknowledgements.

| Field | Values | Default |
| --- | --- | --- |
| `ghost_mode` | boolean | false |
| `profile_visibility` | `public`, `private` (accepted friends) | public |
| `location_visibility` | public, members, friends, hidden | public |
| `map_visibility` | public, members, friends, hidden | public |
| `activity_visibility` | public, members, friends, hidden | public |
| `phone_visibility`, `contact_email_visibility` | public, members, friends, hidden | hidden |
| `message_permission` | everyone, friends_only | everyone |
| `email_new_message` | boolean | true |

Ghost overrides effective personal visibility, including accepted friends. It does not overwrite any of these other choices or stored publication states. The account owner retains their own management view; existing authorized administration and moderation remain separate from public visibility. Hidden location also denies map/nearby searches even if map visibility is otherwise public. Accepted friendship and blocks are checked afresh; pending requests do not qualify. Company permissions and shared chat history remain independent.

Native settings must use this API and wait for a successful server response before displaying a setting as saved. Discard responses from a previous account, expose retry without claiming success, and preserve selections while Ghost is enabled. All nine catalogues contain the `PrivacySettings` namespace. Do not infer feature availability from an old response missing `ghost_mode`.

## Enforcement

- Request-scoped field projection before serialization, location filters and approximate city geocoding: public profiles, Crew page/API, homepage, global search, message-recipient search and invitations.
- Shared linked-profile gate for company teams, credits, collaborations and friendships; Ghost overrides friendship.
- `privacy_visible_listings` applies Ghost to all personal offer types before public pagination/counts/facets. Direct offer pages and cached offer collections recheck fresh visibility. Owners retain editing; public states remain unchanged. New bookings/applications/ratings use the same public gate. Historical transactions remain accessible to their participants.
- Protected media evaluates the canonical current parent and Ghost on every original/thumbnail request. Public mirrors do not grant rights. Shared message attachments keep their existing participant/history boundaries.
- Photo discovery and direct photo eligibility exclude Ghost profiles; public community posts/replies exclude Ghost authors for other viewers.
- Presence writes stop retaining a new timestamp while Ghost or hidden activity is active. Fields are redacted on reads immediately, without waiting for the next presence write.
- Public cache tags expire immediately when settings change. No cross-request authorization cache. Sitemap reads fresh offer visibility. Direct Supabase browser roles cannot read the private settings/view.

## Real limits disclosed in the interface

This is visibility control, not deletion or anonymity. Existing messages, participant transaction records and independent company pages remain. Location settings cover structured personal-profile fields; published offers have independent location fields. Member-written descriptions and photos may disclose places and must be edited by their author.

Legacy public Storage originals and previously cached/downloaded copies are **not** revoked by hiding a card. The UI and data-protection page explicitly disclose that old image links/copies may remain accessible. New protected-media references are permission-checked. Retiring legacy public copies requires a separately reviewed, journaled cutover preserving original bytes, origin ownership and shared references, plus retiring old optimizer variants. This change does not delete legacy objects or falsely claim to recall public bytes.

## Release order

1. Finish code review, checks and the operator's explicit publication request. This privacy feature is not covered by the preceding Genie voice release approval.
2. Apply `20261114180242_profile_privacy_controls.sql` to the intended project and verify column defaults/constraints, service-only grants, view definition, presence trigger and media functions. It is additive and does not change member content/publication states.
3. Publish tested source through the guarded production workflow from clean main exactly matching origin/main.
4. Verify owner/guest/accepted-friend behavior using controlled accounts and the current production build; communicate the actual deployed commit to APP Entwicklung.

Application rollback should retain the additive migration and privacy choices. Do not drop protection while members rely on it. The previous application does not understand all new field controls, so a code rollback requires preserving the privacy gates (or temporarily disabling affected public responses), not simply reverting to unprotected projections.

## Verification

- 141 targeted tests across the final regression and related suites: audience intersection, Ghost/friend/block precedence, revoked friendship, geo redaction and map fallback, account-scoped writes, failure handling, fresh cached-offer gate, public offer types, canonical media ownership/mirrors, private form location recovery, photo discovery, settings constraints/grants, presence writes, provider ratings, profile variants, marketplace selection and shared message attachments.
- New migration executed in isolated PostgreSQL via PGlite against representative existing schema/migrations. No production data changed by these tests.
- Actual `PrivacySettings.tsx` plus project CSS rendered in Chromium with mocked auth/navigation/API boundaries: de/en/es/it/cs/hu/nl/nl-BE/sv at 320, 393, 834, 1440 CSS px. No horizontal overflow or page errors; Ghost restore, saved choices, failure/retry and stale account response tested. This is browser simulation, not an iPhone/iPad/Xcode device test.
- Production build, TypeScript, catalog validation (nine languages, no newly admitted hard-coded copy) and shared design checks passed. Browser testing used mocked boundaries; production migration/live verification remains a release prerequisite.
- Evidence: `/srv/cinegenius/audits/20261114-profile-privacy/`.
