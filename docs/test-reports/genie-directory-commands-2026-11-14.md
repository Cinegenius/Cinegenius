# Genie directory commands and calmer speech — 14 November 2026

## Scope and cause

Recognized speech previously opened only validated Crew searches. Marketplace and Location requests had no structured filtered destination. The advisory prompt also incorrectly described navigation as text-only. The two reported requests are now represented as bounded, server-built directory links:

- `zeig mir ein Boot in Berlin` → `/props?genie=1&q=Boot&cityText=Berlin`
- `zeig mir ein Studio in der Schweiz` → `/locations?genie=1&q=Studio&country=CH`

`directorySearches` accepts only marketplace/locations, a bounded query/city and a known ISO country. Server and client reject other paths, extra parameters, duplicate query parameters, invalid country codes and write endpoints. Generic Studio uses the existing search, including film and photo studios, rather than narrowing to one exact type. No new taxonomy IDs, private data access, content writes or model-generated URLs are introduced. Existing directory privacy views remain authoritative.

Spoken requests open the first validated search. Typed requests keep clickable proposals. Dictation appends to an unfinished draft without sending it. New complete requests replace old filters, including country/city/category/offer and map bounds. Normal URL normalization and actual Back history remain intact. The prompt distinguishes a new request from an explicit follow-up and forbids claiming actual matches/availability. Radius navigation remains Crew-only; other radius requests require clarification.

Browser speech now uses rate 0.94 and volume 0.85, keeping pitch and device volume unchanged. It prefers an available natural/enhanced or system-default voice of the requested language. No new speech provider or voice download. Native bridge v1 remains unchanged; native synthesis uses its own corresponding settings supplied by APP Entwicklung.

## Verification

Evidence directory: `/srv/cinegenius/audits/20261114-genie-command-review/`.

- 262 distinct targeted cases covered in `tests.txt`: Genie API/client/conversation/recording/writing/smoothness, marketplace controls/navigation, and location filters/rendering. One test harness shadowed the imported search module with its URL string; corrected and all 30 client cases passed in `client-tests.txt`. All 29 marketplace cases passed again after the final map reset change in `marketplace-tests.txt`. The 32 API cases passed again in `api-final-tests.txt`. The older Location test fixture was updated to expect the already-live `privacy_visible_listings` view rather than `listings`; production privacy code was not weakened.
- Both reported requests exercised through API validation/provider-result parsing in all nine locales. Invalid output, country/path injection, combined search limit, and writing-mode isolation covered. Provider output is synthetic; this is not a live model-interpretation evaluation.
- Actual Genie React components in Chromium: 18 commands across nine locales, a synthetic microphone, mocked transcription/model/synthesis boundaries, automatic filtered navigation and conversation continuity, retained unsent text, speech rate/volume/language, 44px controls and reflow from 320px. Zero browser exceptions. `browser-results.json` and `voice-*.png`.
- Actual production-mode Next build with read-only current public data: new same-route Marketplace search clears prior category, sale, country and city; a second search clears the previous city; Back restores the original search. Studio Switzerland → Studio Berlin → Back restores Switzerland. Observed counts were 0 for Boot/Berlin, 2 for Studio/Switzerland and 1 for Studio/Berlin. No invented result or silent widening. Zero console errors/browser exceptions. `directory-results.json` and `directory-*.png`.
- Directory layout inspected at 393px and checked at 320/834/1440px with no horizontal overflow. No design/CSS changes. Browser plugin not available; regular Playwright used. No claim of physical-device testing.
- Final `npm run build` passed, including TypeScript and `check:i18n`: nine catalogs, 7886 keys, no new unlocalized source literals. Existing localized destination names and Intl country names are reused; no catalog edits required. `npm run check:design` and `git diff --check` passed.

## App coordination and limits

APP Entwicklung prepared calmer iOS/Android speech at commit `8c1654195da0e66c32aed2f10518e2bfce5ab524` on its own branch. Its receipt is `/srv/cinegenius/handoffs/20261114-native-voice-calm/receipt.json`: 37 mobile tests, eight Java tests, Android debug build and lint with no errors; four synthetic adapter/React transcript cases. It preserves voice bridge v1. No native release or real iPhone listening test was performed; Xcode was unavailable on the Linux host. Native changes are not copied into website sources.

A live OpenAI interpretation check and real iPhone/iPad/Android microphone/hearing tests remain outstanding. No production credential was extracted, no paid API request issued by this test, no member content changed. The installed browser/system voice determines actual timbre. No new database migration is required. Website publication is separate from this prepared and checked source change; this report does not claim a live release.
