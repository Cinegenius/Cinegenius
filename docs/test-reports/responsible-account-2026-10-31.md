# Shared responsible person · 31 October 2026

## Confirmed cause and scope

The studio `9f17db40-f9b5-4f0e-b759-aae87c8aef18` has a correctly bound responsible account and structured name, but its stored responsibility snapshot has `public:false`. The public page therefore displayed the generic contact label. This real offer was only inspected; no name or visibility flag was changed.

The Volvo example supplied by the operator has an identified provider profile but an empty separate contact snapshot. The admin view previously showed an empty contact heading followed by a private-name warning. The view now falls back to the verified same-account provider name and distinguishes that provider association from separately private contact data. No Volvo data was changed.

## Changes

- Shared responsible-person component: compact existing-name summary, explicit public-name preview, optional function/privacy disclosure, and explicit action for previously private snapshots. No second checkbox is needed on new forms.
- Private authenticated name API: stores only validated first/last names in private Clerk metadata, bound to the session. No public profile, company membership or publishing status is created. Requests are rate limited and use no-store responses.
- Initial setup collects structured names for new starts, retains older full-name drafts without guessing, and confirms the private account-name save before continuing. Existing setup/draft recovery remains in place.
- Name lookup reuses the private account value, structured Clerk fields, or one unambiguous account-bound legacy name. Conflicting names, truncated recovery sets and query errors do not trigger guesses.
- Shared server validation can resolve an existing real provider profile name for all relevant offer types, rather than trusting a browser-supplied name. Existing private snapshot flags are preserved.
- Creating/editing company, guided listing, general listing and dashboard forms use the shared component. Company owners cannot disclose a delegate's explicitly private contact name. Delegated role/edit rules remain server-checked.
- Provider list projection can pass the same responsibility snapshot used by detail pages; homepage offer cards receive only the sanitized public provider projection.
- Six existing catalogs updated: de/en/es/it/cs/hu. No schema migration or bulk data change is needed.

## Verification performed

Targeted Node tests execute the actual server name API, company/listing routes, provider projection and existing onboarding/admin-review modules with controlled service doubles. They cover current-account binding, invalid names, guest/foreign identity denial, rate limiting, failed metadata persistence, unchanged private snapshots, ambiguous legacy identities, profile-name forgery, owner/delegate privacy and optional functions without role escalation. Existing PGlite migration checks remain included. These are controlled automated tests, not live registrations.

Interactive browser checks use the actual shared React component, real React hooks and current site styles with a local fake account/name API and fictional names. Verified: edit/save name, reuse in another offer after navigation, old private entry remains private, opening an old entry does not overwrite the shared name, explicit name disclosure, optional company functions, and all six localized versions. Smartphone and tablet views are iframe width simulations; no physical iPhone/Android device was tested. No test messages or invitations were sent.

TypeScript, localization, shared-design checks and production build are run before release. The focused component/API linter passes; the large existing setup component retains unrelated pre-existing hook lint debt.

## Limits

No real account name was modified to test persistence. Live Clerk-write/relogin completion is therefore not claimed from the local simulation. Existing private names do not become public as part of deployment. Their responsible person must explicitly confirm the change and save. Names already intentionally exposed through a public provider profile remain usable through that existing association.
