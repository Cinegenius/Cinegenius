# Unified Genie search and personal quality — 14 November 2026

## Scope and authorization

Markus requested an explicit homepage entry and one shared results page, grouped by domain. Each wish retains its own places; multiple places within one wish are alternatives. Examples cover OB/Fahrer München, Kostüm Schweiz, Kostüm plus Boot Berlin, Fahrer München/Berlin, Beleuchter Berlin/Hamburg, Model Berlin plus Beleuchter Hamburg, and Model Berlin plus Auto Afrika. Work remains a future destination and no paywall is activated.

He subsequently authorized production publication and asked that the daily quotas go live first. The quota-only release is commit `83a3dc1`: ordinary accounts 30 provider calls per UTC day, no whole-site or shared-IP daily ceiling, one privately configured verified Markus Müller account exempt from daily quotas. Minute protections remain. No quota records are reset and no blanket admin exemption exists.

The following search/quality release keeps those limits and adds personal GPT-6 Astra/Ultrafast processing for that same verified identity. Other accounts retain their model. It grants no private-record access or mutation tools. Recognition uses the existing gpt-transcribe; speech synthesis continues to select available device voices. Native voice quality is delegated to APP Entwicklung, not claimed as tested here.

## Implemented boundaries

- Strict versioned plan: at most six wishes, four places each; separate area/query/department/place fields; no arbitrary model URLs or tools.
- `/search?plan=…` uses `POST /api/search/unified`. Existing single-directory links remain valid. Typed interpretation and spoken interpretation converge on the same plan.
- A read-only future entitlement boundary exists without charging or gating existing search results.
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

## Remaining production/device verification

The local pull of Vercel's protected OpenAI secret contains a placeholder. A real model request with it returned 401 and proves nothing about the deployed key. No new key was requested or rotated. Spoken free-form interpretation, actual access to the personal model/tier and measured voice/latency must therefore be checked using Markus's live signed-in account after publication. There is no device/Xcode check in this report and no guarantee that every arbitrary utterance can be interpreted correctly. Ambiguous or over-limit requests should ask for clarification.

Source checks are complete. Actual production status is recorded separately by the guarded deployment logs; this report alone is not a live-release claim. No database migration or member-content backfill is needed. APP Entwicklung receives the tested commit, contracts, quota policy and real release status.
