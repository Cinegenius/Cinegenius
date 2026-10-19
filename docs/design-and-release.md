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

## Design regression checks

Run `npm run check:design` before each release. It verifies that all six public areas still use `PageHeader`, the desktop and mobile navigation have the same destinations in the same order, the shared page-width and solid-toolbar styles remain present, and the removed `CategoryHero` layout has not returned. The production release script runs this check automatically.

For visual review, capture `/projects`, `/locations`, `/props`, `/creators`, `/companies`, and `/jobs` at identical 320×740, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1366×900 viewports. Compare each area beside `/projects` at that same size, checking the header, page width, search/filter stack, first result row, and fixed mobile navigation. Exercise search, category and sort selects, filter combinations, reset/apply, long labels, empty results, orientation, and the keyboard-open filter panel. Check for horizontal overflow. Open each route directly, reload it, then navigate across areas. Review signed-out and signed-in navigation when an authenticated test session is available; production data must not be altered for these checks.

## Production source and release

- Canonical Git source: `origin/main` in the CineGenius repository.
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
- Group membership is recorded in `conversation_members`. New members see messages from `joined_at` onward. Rejoining resets that boundary. Only active members can read or send; only admins can rename/add/remove. When the last admin leaves, the oldest active member is promoted. A sole remaining admin must add another member before leaving.
- Do not clear unread counts at login or mark an entire thread read. A client marks only IDs from its fetched snapshot, and the server validates membership, sender, conversation, and join boundary before storing receipts.
- Before production release, apply `supabase/migrations/message_read_receipts.sql` to the linked production Supabase project, verify the new schema/RPCs, then release the matching clean `main` commit through `npm run deploy:production`. Do not deploy the app code before the migration succeeds.

## Advertising surfaces

Public advertising surfaces are disabled across all routes and screen sizes. Do not add ad banners, reserved slots, placeholders, advertising inquiry links, or booking buttons unless the site owner explicitly asks to add or re-enable them. Keep the `/werben` route redirected to the homepage while this rule is active. `npm run check:design` guards against the removed placeholder, reserved layout, public ad copy, and footer-style links returning; the production release script runs this check before deployment.

## Cause confirmed during the deployment review

Production had been replaced by manual CLI uploads from dirty or stale local snapshots instead of a single canonical Git commit. Automatic Git production deployment was disabled, so different uploads could replace the live build without being tied to the current `main` commit. The source review found no service worker registration or service-worker asset; it was not the cause of the differing layouts.
