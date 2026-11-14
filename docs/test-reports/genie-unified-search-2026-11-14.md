# Unified Genie search and personal quality — 14 November 2026

## Scope and authorization

Markus requested an explicit homepage entry and one shared results page, grouped by domain. Each wish retains its own places; multiple places within one wish are alternatives. Examples cover OB/Fahrer München, Kostüm Schweiz, Kostüm plus Boot Berlin, Fahrer München/Berlin, Beleuchter Berlin/Hamburg, Model Berlin plus Beleuchter Hamburg, and Model Berlin plus Auto Afrika. Work remains a future destination and no paywall is activated.

He subsequently authorized production publication and asked that the daily quotas go live first. The quota-only release is commit `83a3dc1`: ordinary accounts 30 provider calls per UTC day, no whole-site or shared-IP daily ceiling, one privately configured verified Markus Müller account exempt from daily quotas. Minute protections remain. No quota records are reset and no blanket admin exemption exists.

The following search/quality release keeps those limits and adds personal GPT-6 Astra/Ultrafast processing for that same verified identity. Other accounts retain their model. It grants no private-record access or mutation tools. Recognition uses the existing gpt-transcribe; speech synthesis continues to select available device voices. Native voice quality is delegated to APP Entwicklung, not claimed as tested here.

## Implemented boundaries

- Strict versioned plan: at most six wishes, four places each; separate area/query/department/place fields; no arbitrary model URLs or tools.
- `/search?plan=…` uses `POST /api/search/unified`. Existing single-directory links remain valid. Typed interpretation and spoken interpretation converge on the same plan.
- A shared entitlement boundary exists without charging. Markus subsequently restricted Smart interpretation and results to signed-in members, including shared plan links; ordinary public directories remain public.
- Profile privacy is projected before geographic matching and counting. Personal offers come from `privacy_visible_listings`; only published companies, public projects and approved organization content are considered.
- Bounded scans and explicit continuation preserve existing results when loading more fails. Project geography uses primary place/production country, not guessed shooting locations.
- No saved search history. Existing Genie inactivity expiry remains. `store: false`, no conversation IDs, no automatic paid retries. Account/locale changes cancel late work and require explicit retry.
- Every new string is localized in all nine existing catalogs. Existing cards, imagery and colors are reused; no redesign of other pages.

## Verification evidence

Evidence directory on the server: `/srv/cinegenius/audits/20261114-unified-search`.

- `final-tests.log`: 177 related automated cases passed before the final quota/quality addition (search parsing/matching, public-read projection, Genie client/API/voice/history, proxy and homepage directory destinations).
- `quota-quality-tests.log`: all 40 final Genie API cases passed, including the exact 30th/31st-call boundary, per-account separation, personal exemption/revocation, origin/auth checks, premium model/tier selection, reasoning metadata removal and no paid retry after upstream failure.
- `limit-release-tests.log`: all 36 quota-only release cases passed independently of the later search/model changes.
- `final-lint.log`: no errors/warnings for changed production source. `final-design.log` passed.
- `final-build.log`: full optimized build and TypeScript passed; i18n passed for all nine catalogs, 7,910 keys and no newly admitted hard-coded text.
- `browser-results.json`: actual component/style fixtures in nine locales; widths 320/393/834/1440 for German and 320 for other locales. No horizontal overflow/page errors; results, grouping, retry and continuation exercised. Authentication, routing and API responses simulated.
- `critical-browser-results.json`: 44px homepage controls, Enter submission, actual browser Back/Forward without repeated interpretation, preservation of unsent text on locale switch, account/locale cancellation and explicit-only retry. External boundaries simulated.
- `final-full-app-results.json`: real optimized Next application, signed out, at 320/393/834/1440. Heading remains below the real fixed header, no horizontal overflow and no page errors. Screenshot `final-full-app-393.png` inspected.
- `public-query-results.json`: real read-only database queries succeeded across the nine domains. At test time, Fahrer München/Berlin returned 11, Studio Schweiz returned 2, and Boot Berlin/Auto Afrika had no public matches. These are test-time observations, not fixed product counts.

Two existing homepage destination fixture assumptions were corrected: the current public privacy view was absent from the fixture and the current radius resolver import was missing. The same failures reproduced on the pre-change homepage (`home-baseline.log`); production destination behavior was not altered to satisfy the fixture.

## Smart repair and membership follow-up

Markus confirmed the short name **Smart**, a single row above the homepage search input, and access only for signed-in members. The row keeps 44px controls and scrolls horizontally when the available width or translated labels require it. Other design surfaces and the existing daily AI quotas are unchanged.

The matching repair prefers exact catalogue roles before whole-word expansion, distinguishes models from model makers, resolves camera-person plurals and feminine occupation forms, and excludes Dolly Grip from generic driver expansion. Narrow marketplace terms no longer include every sibling vehicle category; public structured vehicle and equipment fields participate in matching. Company services and categories are searchable. Stored occupation IDs and member content are unchanged.

Evidence directory: `/srv/cinegenius/audits/20261114-genie-search-repair`.

- `member-tests.log`: 64 search, server, API and proxy cases passed. Anonymous Smart reads fail before quota checks, body parsing or database work, including forged account claims; authentication failure fails closed.
- `proxy-final.log`: 10 final proxy/localization cases passed. Guest Smart requests return private, non-cacheable JSON 401; member and origin boundaries remain enforced.
- `member-browser.json`: actual components with simulated authentication/API boundaries exercise guest interpretation and shared-plan entry without requests, preserved sign-in return plans, member results, and result removal on expired sessions/account changes.
- `homepage-tabs.json`: all nine locales at 320/393/834/1440 CSS px remain in one row, with 44px targets, usable tab selection and no page overflow. At narrow widths, the complete row can require horizontal scrolling. These are browser checks, not native-device checks.
- `full-app-browser.json`: the actual optimized Next application at 320/393/834/1440 CSS px passed homepage layout, Enter submission, membership notice, retained query and real browser Back checks without page errors. The 393px screenshot was visually inspected.
- `member-http.json`: the running optimized application rejected guest Smart requests and forged account claims with private, non-cacheable JSON 401. Signed-out `/dashboard` retained the correct same-host sign-in redirect.
- `public-query-results.json`: read-only queries against actual public data verified equivalent camera and lighting role forms, two structured motorcycle matches, Swiss studios and catering companies. Exact counts are observations at test time. These queries used supplied structured plans; they do not prove live model interpretation of spoken requests.
- `member-build.log`, `member-final-lint.log`, `member-design.log`: optimized build, TypeScript, localization, targeted lint and shared design checks passed; no new hard-coded string exemptions were added.

The repair and membership follow-up are prepared separately from the earlier `ce37ab6` production release. A passing test report does not mean these changes have been published.

## Remaining production/device verification

The local pull of Vercel's protected OpenAI secret contains a placeholder. A real model request with it returned 401 and proves nothing about the deployed key. No new key was requested or rotated. Spoken free-form interpretation, actual access to the personal model/tier and measured voice/latency must therefore be checked using Markus's live signed-in account after publication. There is no device/Xcode check in this report and no guarantee that every arbitrary utterance can be interpreted correctly. Ambiguous or over-limit requests should ask for clarification.

Source checks are complete. Actual production status is recorded separately by the guarded deployment logs; this report alone is not a live-release claim. No database migration or member-content backfill is needed. APP Entwicklung receives the tested commit, contracts, quota policy and real release status.
