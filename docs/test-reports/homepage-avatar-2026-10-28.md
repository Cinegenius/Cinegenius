# Homepage profile avatars — 2026-10-28

## Confirmed cause

The homepage crew-card projection accepted `avatar_url` only when it contained the legacy `supabase.co/storage` path. The public profile and crew directory already accepted the current stored media reference. Consequently, a valid permission-checked `/api/media/...` avatar became `undefined` only on the homepage, selecting the initials fallback.

Read-only guest-browser verification of Simon Rainer's public profile confirmed an existing profile image with a `/api/media/` source. No member data or media was changed.

## Correction

`app/page.tsx` now preserves a nonempty stored avatar reference. Cards continue to use `MediaImage`, and existing profile-visibility filtering and media-endpoint authorization remain in place. Homepage selection, ranking and number of cards are unchanged.

## Verification

- `lib/homepage-avatar.test.mjs`: runs the actual homepage data projection and server-rendered card output with synthetic rows. Permission-checked media, legacy public Storage and Clerk avatar references survive; a missing avatar retains the fallback; a private profile is excluded.
- Both new tests plus six existing protected-media security tests passed (8/8). These include authorization before original/thumbnail responses and optimizer-cache protection.
- Live guest profile checked in browser; synthetic homepage tests verify reference handoff and markup, not a production deployment or a real-device image-load test.

This correction has not yet been released to production.
