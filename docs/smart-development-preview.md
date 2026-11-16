# Smart development access and member preview

Operator decision, 16 November 2026. Smart is temporarily available only to
configured CineGenius admins. Signing in or paying does not unlock it.

## Web and native contract

- Resolve admins from the current authenticated account and the existing
  server-only `ADMIN_USER_IDS` policy. Client role flags, account names and
  unlimited Genie quota never grant this capability.
- `POST /api/search/unified` returns `401 unauthorized` for guests and
  `403 in_development` for signed-in non-admins, before body parsing, quota,
  place validation or data access. This covers results, combined/map requests
  and pagination. Responses remain private and non-cacheable.
- Genie retains ordinary platform help, transcription and writing assistance
  for members. Non-admin Smart follow-ups with `searchContext` return
  `403 in_development` before quota/provider use. Recognized Smart requests in
  ordinary chat receive the localized development notice and no search links.
  Model-produced searches, including legacy formats, never get resolved for
  non-admins. General help may still use existing public directory links.
- Web uses the existing server-verified admin identity to select the interface;
  APIs remain authoritative. Account changes unmount active Smart results.
  A rejected result, interpretation, map or follow-up request returns to the
  notice/preview and discards the unavailable results.

## Presentation

Locations remains the default homepage search tab. Clicking Smart as a guest
opens only the development notice. Members get a small static map followed by
three illustrated steps: search wish, matching results, grouping by area. Direct
Smart URLs show the same access-dependent state. No forced sign-in detour.

The map is explicitly a schematic example: no actual members, coordinates,
offers, availability or matches. It uses a local inline SVG, existing icons and
the existing Smart colors: Crew green, Locations orange, Marketplace violet,
Companies blue. There are no map tiles, profile images, result API requests or
paid AI requests caused by this preview. The explanation is accessible text
with decorative icons, not flattened text in an image. The dismissible homepage
popover scrolls when necessary and supports Escape and outside dismissal.

All new copy is in the nine existing language catalogs. Ordinary searches,
shared header/navigation and the existing visual design are unchanged. No
database migration, publication-state changes or environment changes needed.

## Validation and limits

Focused automated checks cover guest/member/admin access, forged claims,
all result modes, model and keyword paths, ordinary Genie help/writing,
homepage destinations, account changes and all nine preview languages.

Chromium fixture verification uses real HeroSearch, SmartSearchPreview and
UnifiedSearchResults access components with shared CSS at 320, 390, 768 and
1440 CSS px in all nine locales (36 cases). Account/router/provider behavior
is simulated. It checks no overflow, popover dismissal, no unexpected search
or tile requests, member preview, guest notice and admin controls. This does
not verify real Clerk accounts, live AI, Safari, native apps or physical devices.

TypeScript, targeted ESLint, localization and shared-design checks pass. The
targeted real-HeroSearch regression also passes. An attempted wider homepage
streaming suite has unrelated pre-existing fixture gaps (its unchanged homepage
imports profile-privacy-server without a corresponding test mock); it is not
reported as passing.

Publication is pending an explicit operator request and the guarded release.
Native presentation/adoption belongs to APP Entwicklung; do not describe this
source change as already live or as a verified native implementation.
