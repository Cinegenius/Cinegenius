# Responsible provider identity — 2026-10-28

## Scope and implementation

Company creation/editing, registration setup, guided Location/marketplace drafts, the full offer form and dashboard offer editing share `ResponsiblePersonFields`. Separate first/family names are required for publication; private listing and setup drafts may remain incomplete. Optional functions depend on company versus offer context and use stable keys with six-language labels. Custom functions are limited to 80 characters.

`lib/responsible-person.ts` contains normalization, validation and canonical account binding; `lib/responsible-person-server.ts` prefills reliable structured Clerk names, validates server-side and projects public contact data. `/api/responsible-person` returns only the authenticated account's prefill and is private/no-store. No public person/crew profile is created by these operations.

Company/listing writes persist a nullable `responsible_person` JSONB snapshot on the parent row. A posted foreign account ID is refused. Public functions do not participate in access checks. An authorized editor retains another person's snapshot; unchanged editor submissions do not rewrite it. Existing company owner/member permission checks remain in place. Former company members are excluded as delegated public contacts.

`ResponsiblePersonCard` is used on company and Location/prop/vehicle detail pages. Only explicit public consent projects name/function; internal IDs, phone and email are omitted. A real visible profile is linked when it exists; otherwise the contact name is plain text. Admin lists display the internal responsible account separately from existing provider/technical-creator fields. Admin provider reassignment invalidates the previous contact snapshot instead of naming the admin.

## Existing data

No live data was changed. Existing published records remain visible. Owner editor responses can prefill missing responsibility using the actual account's structured names, without database writes. No display-name splitting, email fallback, guessed function, mass backfill or bulk hiding. Missing names are requested on the next applicable edit/publication. Private draft saving does not require completed names.

## Database prerequisite

`supabase/migrations/20261028120000_responsible_person.sql` adds two nullable columns. Existing public columns retain their direct grants while the internal snapshot is service-only. Table-wide grants are converted to equivalent existing-column grants because a column REVOKE cannot override a table grant. Row policies remain unchanged. Unexpected inherited access aborts the transaction. The migration was tested with PostgreSQL/PGlite, including retry, preserved records, allowed existing-column reads/updates, and refused direct snapshot reads/writes. **It has not been applied to production.**

## Actual tests

- Automated model and actual route-handler tests with synthetic accounts: required names, international names, incorrect email/username input, account-ID spoofing, incomplete private drafts versus public creation, company creation, authorized editor preservation, forbidden title/contact changes, and unauthorized requests.
- Public projection tests: private choice produces no contact; no internal account/contact data in public DTO; existing visible profile link; missing/private profile gives plain name without a link.
- PostgreSQL migration executed against an isolated PGlite schema; existing records survive; role-level column protection is enforced; retry succeeds.
- Full existing regression suite passed (696 tests, including six new responsible-person tests). Type checking, new-component lint, design checks and i18n checks passed. The production build succeeded. Existing unrelated legacy lint errors in large edited pages remain unchanged; new components have no lint findings.
- Interactive browser fixture uses the actual new React fields/card with invented data and mocked account prefill. Checked prefill, missing-family-name message and focus, company/Location function choices, custom function, explicit public contact preview, back, and reload retaining test fields. UI checked at desktop width and in 390px phone/820px tablet iframes. New field labels checked in de/en/es/it/cs/hu. Screenshot: `responsible-person-preview-2026-10-28.png` in the chat visualization folder.

The fixture is a UI simulation; its session storage is not evidence of a production Clerk session or a live Supabase write. Real registration/relogin and an authenticated browser-to-production-database create/edit/publish journey remain to be checked after the migration and release. No real member or company was edited; no invitations/messages were sent. No physical phone/Safari device test was performed. The feature is **not live**.

## Changed files

- Shared fields/card/admin summary: `components/ResponsiblePersonFields.tsx`, `ResponsiblePersonCard.tsx`, `ResponsiblePersonAdmin.tsx`.
- Shared domain/server logic and tests: `lib/responsible-person.ts`, `responsible-person-server.ts`, `responsible-person.test.mjs`; existing `listing-provider.ts` and `quick-start-flow.ts`.
- Creation/edit forms: `app/company-setup/page.tsx`, `app/inserat/page.tsx`, `app/dashboard/page.tsx`, `components/GuidedListingWizard.tsx`, `ProfileSetupWizard.tsx`.
- Owner/public/admin APIs: responsible-person endpoint; companies create/edit/detail/publication; listings create/edit/publication; admin company/listing lists and provider assignment.
- Public views: company detail server/client, Location/prop/vehicle detail loaders, `ListingProviderCard.tsx`; admin page.
- Six message catalogs; compatible migration; release prerequisite documentation; three existing test fixtures updated for the newly imported components/helpers.

## Production database follow-up

On 2026-10-28 the migration was applied through the authenticated Supabase SQL editor before application deployment. Existing counts stayed at 9 companies and 16 listings. Full original-row digests (excluding the newly added nullable field) matched exactly before/after; no content, ownership or publication state changed. Both columns exist and service-role access remains available. This supersedes the earlier preparation-only database status above. Application release and browser checks are recorded separately.
