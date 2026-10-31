# Account content reconciliation — 31 October 2026

## Cause and scope

Admin → Accounts previously joined Clerk accounts only to personal profiles and privacy settings. A completed company/location/marketplace-only setup intentionally requires no Crew profile. The missing-profile label therefore concealed existing companies, listings and unfinished offer forms; setup completion was not evidence of publication.

A read-only production reconciliation covered all four Clerk account pages (151 unique accounts), 109 profiles, 22 owned companies and 25 listings. No profile, company owner or listing creator referenced an account outside that Clerk snapshot. Of 42 accounts without a personal profile, eight had completed non-personal setup (seven saved companies, one saved Location). Six of those companies and the Location were public; one company remained private. The other 34 accounts had an open setup status, which is not itself proof that none of their other content is public. The existing started-offer list was exhausted through both continuation pages: 11 private offer forms, belonging to eight accounts without personal profiles and three with them. No account, message, publication status or membership was changed during that audit. No private account addresses or recovery contents are reproduced here.

## Change

- The existing admin-guarded, private/no-store account endpoint now attaches owned-company summaries, listings created by that account, and the existing sanitized started-offer summaries. Reads remain scoped to at most the current 50 Clerk users; no per-account Clerk fan-out is added.
- Company and listing reads follow stable database pages instead of silently stopping at the default row limit. Excessive result size and read failures fail explicitly rather than return a misleading complete list.
- Cards show public/private and the actual listing moderation status. Saved private records link to the existing protected review page, where the administrator must still review and explicitly decide. Public content links to management. No new mutation or approval endpoint.
- Technical listing creation is labelled separately from actual provider responsibility. Review and support continue to resolve the real provider using the existing rules. Owned companies are not presented as an exhaustive list of team memberships.
- Unsaved private offer forms get a targeted, editable reminder action, not an invented publish link. Existing incomplete/private personal profiles can be opened in admin review without exposing a public profile link.
- All new text is present in de/en/es/it/cs/hu. Names and user content are untouched.

Main files: `app/api/admin/accounts/route.ts`, `lib/admin-account-content.ts`, `components/admin/AdminAccounts.tsx`, `lib/admin-accounts.test.mjs`, six existing translation catalogs.

## Verification

- 25 targeted tests passed across account reconciliation and started-offer/support coverage, including guest/member denial before reads, read-only operations, completed company-only/private records, cross-account separation, moderation preservation, sanitized drafts, content failures, empty pages, >1,000 company rows and six-language labels.
- TypeScript, focused ESLint, translation validation and production build passed. The first restricted build could not fetch the existing Google Fonts; the network-enabled retry succeeded.
- Browser inspection of the actual Accounts component with explicitly fictional fixtures and built CSS: laptop, 390px phone and tablet layouts. This fixture is a layout simulation; support buttons are inert, so it sends nothing.
- Production verification after release is recorded in the conversation. No real member is contacted and no real private content is published for testing.

No database migration is required. This change improves admin visibility; it does not make every registered account a public person, publish unfinished forms, or alter review permissions.

## Follow-up found during the production check

The existing company review page was read-only: unlike listings, it had no administrative publication action. The initial new link therefore led to a valid protected preview without a publish button. Added an explicit company-only approval branch in that shared view and endpoint; no company rejection/hide workflow or automatic publication is introduced.

`admin_review_company_publication` compares and locks the complete reviewed company row and owner-profile snapshot, publishes only that company, and records the admin actor/reason atomically. It is executable only by the existing service role. The authenticated server checks the real Clerk owner, current responsible-person membership and canonical image sources before invoking it. Missing images remain advisory. The UI discloses that approving a private company also exposes that company's images, and requires a review acknowledgement. No real company is approved during testing.

Additional files: `lib/admin-company-publication.ts`, `lib/admin-company-publication.test.mjs`, `lib/admin-review-server.ts`, `app/api/admin/reviews/[kind]/[id]/route.ts`, `components/admin/AdminReviewDetail.tsx`, `lib/offer-moderation.test.mjs`, and `supabase/migrations/20261031150000_admin_company_review_publication.sql`.

The additive function was applied to production before its dependent UI. A transactional company-row fingerprint assertion passed: all 23 current company records remained unchanged, 22 public. Execution permissions were verified as false for anon/authenticated and true for service_role, and the PostgREST schema reload was requested. The account count increased naturally from 151 to 152 during this task; no registration or company was created by the agent.

31 targeted company/review/moderation tests passed. These include the actual new SQL function in isolated PostgreSQL (PGlite): denied anon/authenticated execution, full-row and owner-snapshot conflicts, exactly one publication, unchanged unrelated private company, duplicate audit prevention and rollback when audit persistence fails. Server tests cover normal-member denial before any account/media/write work, foreign contacts, missing owners, canonical-image denial, unavailable RPC fail-closed behavior, and committed success despite cache-refresh failure. Publication success in production with a real member's company is deliberately not tested.

Final combined regression run: **56 passed, 0 failed** across account summaries, started offers/support, company publication, admin review/media and offer moderation. Focused ESLint, TypeScript, translation and design checks passed. React checklist reviewed the two changed client components: no extra polling, aborted obsolete reads, minimal server summaries, stable keys, accessible acknowledgement, mutation lock and retained error state. Final company publication remains a separate explicit decision; no test invitation, support message or real company approval was sent.
