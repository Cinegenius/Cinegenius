# Registered accounts and support access — 2026-10-28

## Scope and cause

The existing admin Profiles list reads `profiles` only. Clerk registration creates an account before a personal profile exists. The preceding read-only production audit found 100 Clerk accounts versus 78 profile records; all 78 profile rows were present across both admin pages. These counts are not a claim that all remaining accounts require a personal profile: search-only and offer-only setups can be complete without one.

## Changes

- Added Admin → Accounts, alongside the unchanged profile management list. `/api/admin/accounts` requires the existing server-side admin guard, pages Clerk accounts in batches of 50, and joins corresponding profiles and privacy settings without excluding missing profiles. Search and result counts come from the same Clerk query. Failures return an explicit error rather than a misleading empty successful list.
- Only the necessary account fields and derived setup/profile statuses are returned, with private/no-store headers. Clerk private metadata is never returned to the browser. The existing shared setup-status rules distinguish unfinished setup from completed search/company/location/marketplace-only accounts. Private profiles do not gain public links.
- Existing support resolution accepts an actual registered account without a complete profile. It resumes the existing setup destination, prevents self-send, and does not create a placeholder or public profile.
- Added a localized optional setup reminder to the existing template system. A saved admin override takes precedence; the existing audited template editor can save it. Sending rechecks current completion status and requires the original edit link. Manual preview and single-recipient submission remain in place, with the existing idempotency and notification preferences. No automatic/bulk reminders.
- The protected support inbox resolves names for account-only participants without inventing public profile links. Existing conversation and message tables/RPCs are reused; no migration is required.

Main files: `app/api/admin/accounts/route.ts`, `components/admin/AdminAccounts.tsx`, `app/admin/page.tsx`, `lib/admin-account-status.ts`, `lib/admin-support.ts`, `lib/admin-support-participants.ts`, `lib/support-setup-template.ts`, existing support template/thread endpoints and composer, six `messages/*.json` catalogs.

## Verification actually performed

- `npm test`: **684 passed, 0 failed**. New coverage includes paginated account listing, missing-profile retention, exact-ID/search parameters, primary email selection, metadata exclusion, privacy status, completed non-personal setup, explicit upstream failures and admin denial before any external read.
- Support integration tests: actual application SQL migrations run in isolated PGlite. An own account with no profile receives support, replies, receives a further support reply, and retains three messages in the same conversation. Replayed requests do not duplicate messages; a stranger cannot reply. No production messages are sent.
- API tests check recipient resolution, blocked self-send/deleted accounts, correct resumable links, rejection of a reminder after setup has completed, wrong-link rejection, reply authorization, and existing support persistence/read-state behavior.
- All six localized reminder defaults are formatted through next-intl and the existing placeholder resolver; final links are valid and no unresolved placeholders remain.
- Production build, `tsc --noEmit`, focused ESLint, `check:i18n`, `check:design`, and `git diff --check` passed. The final small client loading-state change was additionally type/lint checked and covered by the final test run; the production build preceded that client-only change.
- Browser visual inspection of the actual Accounts component rendered with explicitly fictional fixtures and built site CSS at desktop width and inside 390px/820px viewport frames. Long names and account emails wrap; support actions remain visible. These are layout simulations, not authenticated production/browser interaction tests.

## Limits / release state

Not deployed in this task. No accounts, profiles, company memberships or listing visibility were changed. No real member was contacted. A production account-list check and a real own-account support/email delivery round trip after release remain outstanding. Existing provider data and public listings are untouched.

Layout screenshots are local artifacts: `admin-accounts-desktop-2026-10-28.png` and `admin-accounts-mobile-2026-10-28.png` in this chat's visualization directory.
