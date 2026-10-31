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
