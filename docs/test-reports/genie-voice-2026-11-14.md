# Genie voice and Crew search — 14 November 2026

Status: website feature branch `codex/genie-voice`, based on published
`a36bc59b3dd18c0a2dd8537431b9346d9f61fb33`. This report does not authorize or
record a production release. No OpenAI secret was extracted and no paid provider
call was made by these checks.

## Verified locally

- 152 targeted Genie/API/client/recording/auth/proxy tests passed. After adding
  the specific unresolved-search error, its API/client subset passed again
  (58 tests; not counted as additional distinct cases).
- 13 navigation regressions and 10 existing marketplace navigation checks passed, including Back/Forward using the original
  `popstate` snapshot if an earlier router listener rewrites `history.state`,
  account boundaries and cancellation of delayed URL changes.
- Nine Chromium scenarios render the actual Genie components, capture from a
  synthetic microphone and use mocked transcription/chat/speech services.
  They exercise explicit capture, stop, cancellation, draft preservation,
  late-result/account disposal, 44px controls and 320px reflow in every locale.
  German screenshots cover 320/834/1440px and a 393×420 short viewport.
- All nine catalogues have 7,860 keys, with zero new hard-coded interface text.
  The new legal disclosure remains the German original, explicitly marked
  with its date and `lang="de"`; it is not an approved legal translation.
- Shared design checks passed. The complete production build, including
  TypeScript and translation checks, passed again after the final navigation
  fix. No source changes were needed after that successful build.

## Actual directory regression

The private production-mode Next.js preview reads the public directory data.
The checked examples resolve to Camera within 50 km of Munich and a separate
Gaffer search. The browser uses the real Next router for the second request.
An initial check exposed stale selected filters on Back; the shared view-state
hook now restores from the event's original destination snapshot. The final
browser check passes: 13 Camera results, then 2 Gaffer results, then Back restores
Camera and 13 results. These are observations of the public test data at that
time, not guaranteed counts or suitability. Reflow at 320/834/1440px passes with
no page exceptions. Actual Forward was covered in the hook tests, not this
browser sequence. See `directory-results.json` in the completed handoff.

Development-preview initialization was unreliable through the browser's routed
live hostname/HMR connection. Final directory validation uses the locally built
production server instead. Vercel-only analytics scripts are stubbed in that
local browser check; they are not available on the private Node preview.
Expected superseded directory fetches are aborted on navigation. No member data
is edited and no message is sent by the directory test.

## App coordination and limits

APP Entwicklung's native bridge v1 is recorded at native commit
`a98af310324305304af8576c64f25d34e86f3861`, in
`/srv/cinegenius/handoffs/20261114-native-voice/CONTRACT.md`.
Native code and Xcode integration remain with APP Entwicklung. Preserve its
additional catalogue keys and newer Mac workplace/Recce sources during merging.
This web change includes no native file replacements.

Actual OpenAI recognition/model quality, Production key permissions for the new
transcription endpoint, real iPhone/iPad/Android microphones, voices, interruption
and device keyboard/safe-area behavior remain unverified. Chromium and simulated
native transports cannot establish those results. Spoken-output availability
depends on installed/available device voices.

Shared workplace scheduling is not implemented: the investigated source has no
shared day-plan membership/revision/update backend. The role decision remains
pending. Public credits are not editing rights. Genie must not claim it changed
lunch, notified members or saved a shared plan. The integration contract requires
an identified project/day/timezone/block, preview, confirmation, current rights,
atomic version check, idempotent save and an authorized member refresh.

Detailed API, quota, privacy and interaction contract: `docs/genie-beta.md`.
