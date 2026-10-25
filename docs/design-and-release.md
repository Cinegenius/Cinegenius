# CineGenius shared design and production release path

## Design reference

The current `/projects` page is the source of truth for public directory design. Its cinematic backdrop, compact header, lime emphasis, dark surfaces, restrained borders, centered content width, and primary navigation order should carry across Locations, Marktplatz, Crew, Firmen, and Jobs. Page-specific filters, listings, map controls, and empty states remain specific to their purpose.

Use `components/PageHeader.tsx` for page headers and its exported backdrop helper for any page that intentionally extends the image beyond the header. `app/globals.css` owns shared width and surface values: `--site-content-max`, responsive gutters, `site-container`, `browse-toolbar`, and `browse-card`. Keep filters and result lists on the solid background; don’t extend the cinematic image behind them unless the `/projects` reference does so. The former `CategoryHero` component was removed after its remaining routes were migrated.

All six directory areas (`/projects`, `/locations`, `/props`, `/creators`, `/companies`, `/jobs`) use `components/MobileBrowseControls.tsx` below 1280 CSS px. This shared control provides the full-width search, sort, labeled category select, count, removable filter chips, and scrollable filter panel with reset/apply actions. Page-specific controls belong inside the shared panel; do not add horizontal category strips or standalone mobile filter rows. Keep controls usable at 320 CSS px, ensure touch targets are at least 44×44 CSS px, and account for keyboard viewport resizing and safe-area insets. `app/globals.css` owns the mobile component styles.
Reserve enough safe-area-aware space for the fixed bottom navigation so the last result card and empty-state actions can scroll completely above it.

The homepage keeps `/hero-bg.jpg` as a full-page backdrop using the shared `PageBackdrop` component. Its slightly brighter dark overlay must retain readable copy and clear card surfaces while allowing the image to continue behind homepage sections.

Desktop and mobile navigation use the same order: Locations, Crew, Jobs, Marktplatz, Projekte, Firmen. Keep `components/Navbar.tsx` and `components/BottomNav.tsx` aligned when editing navigation.

## Authentication entry points

Keep `/sign-in` and `/sign-up` one click from the homepage. On desktop, show both actions in the header; on phones, show them outside the collapsed menu. Homepage and navigation links prefetch the corresponding direct routes. Each route renders the actual email/password inputs in its first server response, and the client form uses Clerk's supported flow; never add an intermediate welcome or account-type page. Ask only for fields the identity provider marks as required, then defer profile details to onboarding. Keep reciprocal sign-in/register links and send an existing session directly to its requested internal destination. Header account controls use a stable account icon rather than profile photos, preventing stale or late-loading portraits after sign-in. Profile photos remain visible on profile pages and other intentional profile surfaces.

Email-and-password is the default sign-in method. Email-code sign-in is an explicit alternative; never automatically start it when a password attempt returns `needs_first_factor`. Only `needs_second_factor` and `needs_client_trust` should enter the configured security verification flow. Do not weaken Clerk MFA or Device Trust settings to avoid a legitimate challenge.

New users continue from verified registration to the shared `/profile-setup` assistant. It asks for their name, lets them select multiple goals, then shows only the relevant steps for each selected goal before a review with an edit action for every section. Crew occupations come from the full shared department catalogue; talent occupations come from the casting group. Search-only users skip provider creation and go directly to search. Progress is stored privately, resumes after reload or sign-in, and old unfinished drafts are migrated without losing entries. Offers remain private drafts until their owner explicitly publishes them. Company profiles become public as soon as the owner saves them; onboarding and editing must explain this before the save action. Stable retry keys prevent duplicate setup records. Existing private company records remain private until the owner saves or explicitly publishes them; do not bulk-publish legacy records. The profile completion button clearly states when it creates a public profile or company. Completed existing profiles do not re-enter onboarding.

## Design regression checks

Run `npm run check:design` before each release. It verifies that all six public areas still use `PageHeader`, the desktop and mobile navigation have the same destinations in the same order, the shared page-width and solid-toolbar styles remain present, and the removed `CategoryHero` layout has not returned. The production release script runs this check automatically.

For visual review, capture `/projects`, `/locations`, `/props`, `/creators`, `/companies`, and `/jobs` at identical 320×740, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1366×900 viewports. Compare each area beside `/projects` at that same size, checking the header, page width, search/filter stack, first result row, and fixed mobile navigation. Exercise search, category and sort selects, filter combinations, reset/apply, long labels, empty results, orientation, and the keyboard-open filter panel. Check for horizontal overflow. Open each route directly, reload it, then navigate across areas. Review signed-out and signed-in navigation when an authenticated test session is available; production data must not be altered for these checks.

## Production source and release

- Canonical Git source: `origin/main` in the CineGenius repository.
- Use GitHub Desktop for Git operations that create or publish repository history: stage, commit, push, pull, and resolve synchronization. Do not create commits or push from the terminal. Make code edits in the project normally; after pushing through GitHub Desktop, confirm the working tree is clean and local `main` exactly matches `origin/main` before using the guarded release command.
- The production Vercel project is linked locally through the ignored `.vercel/project.json`. Check the linked project and production alias in the Vercel dashboard before a release; keep those account-specific identifiers out of the public repository.

## Authentication redirects

- Protected browser pages must send signed-out visitors to `/sign-in` on the same host as the requested page. Build the URL from `request.url` and pass it as `unauthenticatedUrl` to `auth.protect()` in `proxy.ts`; do not rely on Clerk's default cross-domain redirect unless that hostname is explicitly attached to the production Vercel project and verified.
- After any auth-routing change, test sign-out, then open `/dashboard` directly while signed out. The redirect must reach the app's sign-in page without a Vercel 404; preserve the requested path in `redirect_url` where applicable.
- Vercel automatic production deployment from `main` is disabled in `vercel.json`. This prevents an unreviewed Git integration deployment from replacing production.
- Publish a release only by running `npm run deploy:production` from a clean `main` checkout whose `HEAD` matches `origin/main`. The guarded script checks the branch, clean tree, remote commit, linked project, and shared design rules, then uploads the checked source for a Vercel-hosted production build. Do not use a local prebuilt release: Vercel intentionally redacts sensitive environment values when pulling them locally, so a local prebuilt can capture placeholder values instead of the real production configuration.
- Never use a dirty working tree, another branch, a stale project folder, or a direct ad hoc `vercel --prod` command for production. The guard is intended to make those recurring snapshot overwrites fail before deployment.
- `npm run build` uses Next.js Webpack explicitly. This avoids the reproduced Turbopack Google Font resolver failure in the Vercel CLI production build while keeping local and Vercel builds on the same successful path.

## Messaging and group conversations

- Message reads are stored in `message_reads` per `(message_id, user_id)`. Never use the legacy global `messages.read_at` as the unread source after the receipt migration; it is only backfilled for compatibility. Counts come from `unread_message_counts` and include active members' incoming messages after their current join time.
- All conversation and message reads, sends, group administration, read receipts, and notifications go through authenticated server routes. Do not subscribe clients directly to raw message rows. Client refreshes must be deduplicated by message ID and scoped to the active Clerk user/session.
- Personal message deletion hides only the sender's own message through `hidden_for_sender_at`; keep the original and recipients' views intact. Before releasing this feature, apply `supabase/migrations/20261025110000_hide_own_messages.sql` and verify the service-only `hide_own_conversation_message` RPC. Both the chat history and sidebar preview must filter the current sender's hidden messages before pagination.
- Group membership is recorded in `conversation_members`. New members see messages from `joined_at` onward. Rejoining resets that boundary. Only active members can read or send; only admins can rename/add/remove. When the last admin leaves, the oldest active member is promoted. A sole remaining admin must add another member before leaving.
- Do not clear unread counts at login or mark an entire thread read. A client marks only IDs from its fetched snapshot, and the server validates membership, sender, conversation, and join boundary before storing receipts.
- Before production release, apply `supabase/migrations/message_read_receipts.sql` to the linked production Supabase project, verify the new schema/RPCs, then release the matching clean `main` commit through `npm run deploy:production`. Do not deploy the app code before the migration succeeds.
- Before releasing the homepage photo-rating feature, apply `supabase/migrations/profile_image_ratings.sql` to the linked production Supabase project and verify its unique constraint, RLS, and grants. This migration has been applied and verified on the production `main` database.
- Before releasing idempotent photo likes, apply `supabase/migrations/profile_image_likes_unique.sql` to the linked production Supabase project. It removes duplicate rows for the same liker/profile/photo while preserving one existing like, then enforces a unique index used by the API's state-setting upsert. Verify the index before deploying the application code.

## Public community media and direct company invitations

- Before releasing the expanded public image collection and targeted member invitations, apply `supabase/migrations/20261024190000_public_community_media.sql` and `supabase/migrations/20261024191000_direct_company_invitations.sql` to the linked Supabase database. A successful rollback-only compatibility test does not mean the migrations are installed.
- Verify the server-only view, public-storage joins, helper grants, `recipient_user_id`, invitation status constraint, pair guards, and the three invitation/search RPCs. Ensure PostgREST has refreshed its schema before releasing dependent server routes.
- Keep `public_community_media` and the trusted RPCs inaccessible to direct anonymous/authenticated database clients. The app server checks Clerk identity and company permissions; a public job title must never become an authorization role.
- Do not ship temporary test routes or Clerk bypasses. Preserve existing memberships and photo-like records. See `docs/test-reports/community-media-team-2026-10-25.md` for tested flows and remaining real-account/device checks.

## Advertising surfaces

Public advertising surfaces are disabled across all routes and screen sizes. Do not add ad banners, reserved slots, placeholders, advertising inquiry links, or booking buttons unless the site owner explicitly asks to add or re-enable them. Keep the `/werben` route redirected to the homepage while this rule is active. `npm run check:design` guards against the removed placeholder, reserved layout, public ad copy, and footer-style links returning; the production release script runs this check before deployment.

## Cause confirmed during the deployment review

Production had been replaced by manual CLI uploads from dirty or stale local snapshots instead of a single canonical Git commit. Automatic Git production deployment was disabled, so different uploads could replace the live build without being tied to the current `main` commit. The source review found no service worker registration or service-worker asset; it was not the cause of the differing layouts.
