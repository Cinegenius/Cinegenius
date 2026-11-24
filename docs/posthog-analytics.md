# EU usage analytics

CineGenius loads the PostHog SDK only after explicit analytics consent and on an allowlisted surface. The former notice-dismissal value is not consent. Refusal and acceptance have equivalent controls, and the footer/privacy page can reopen the choice. Storage failures fail closed. The legacy dismissal flag remains only for Genie's notice-clearance behavior.

The initial release recorded only public directory page views, followed by explicitly consented public news impressions/opens. The 24 November setup extension is **published on `13445c23`**, with production event arrival verified; see [scope and validation](posthog-setup-20261124.md). Public pageviews still exclude all authentication, setup, account, editing and administrative routes. Only the explicit events below may run on `/sign-up` and `/profile-setup`; no private URLs enter their payloads. All other private surfaces, sign-in and password reset remain excluded. In-flight SDK loading rechecks consent and the current route.

The new `cg_analytics_consent_v3` choice covers registration/setup observations. An older v1/v2 acceptance does not authorize them; old refusals remain refusals. The same existing banner explains the expanded purpose in all seventeen languages, without changing essential registration requirements. No form input, account ID, email, password, verification code, raw error, draft, query or hash is sent. Random identifiers remain in tab memory, so reloads and separate tabs cannot be treated as one person or one continuous onboarding journey.

| Event | Meaning |
| --- | --- |
| `setup_step_viewed` | A registration or setup step is ready; deduplicated by flow, step and area within the consented document lifetime. Includes setup loading and welcome. |
| `setup_submitted` | Registration/verification submitted or Next/Finish clicked in the shared setup assistant; not a success. Autosaving keystrokes emits no event. |
| `setup_error` | A visible error episode, with only a closed error category. This is not an exception log or exact failed-request count. |
| `setup_completed` | Registration reaches Clerk's committed-session navigation callback without pending tasks, or the setup completion endpoint returns a confirmed completion. Not inferred from opening review or saving part of the content. |

Fields are `flow` (registration/profile_setup), closed `step`, `area` (unselected/crew/talent/company/location/equipment/search/multiple), `measurement_version: 1` and `$ip: null`. Errors additionally contain a closed `error_code`: validation_or_request, load_failed, rate_limited or required_fields. Existing legacy search members remain observable without reopening that choice for new accounts. The send filter reconstructs this payload, dropping SDK-enriched values. No identifying calls or server SDK were added: client observations reflect server-confirmed results but delivery remains best effort and does not constitute a billing or authoritative account ledger.

Interpretation: filter by flow and compare unique anonymous identifiers reaching steps/completion in a defined window. Do not add unique step counts together, equate a missing completion to a proven error, or infer completion from a submit. Browser closure, revoked consent, blocked analytics and full reloads can break the observation chain. No unload-based abandonment event is fabricated. Profile setup completion is not synonymous with public visibility or moderation approval of its offers. Countries, cities, session replay, automatic exception/performance collection, and standalone legacy company/listing editors remain outside this change.

The SDK is pinned, lazily loaded and configured for the EU ingestion endpoint. Remote flags/configuration, externally loaded extensions, session replay, autocapture, heatmaps, error capture, surveys and person profiles are disabled. The send filter rebuilds the payload from allowlisted fields and preserves the public project token required for ingestion. IP storage as an analytics property is disabled; the connection still necessarily processes an IP address.

`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is the public, write-only token of the EU project, configured in Vercel production. It is not a personal or server administration credential and is not stored in the repository. No US project token is used. No PostHog events are sent from server routes. The existing Vercel Analytics/Speed Insights integrations are unchanged.

## Verification

Run `lib/product-analytics.test.mjs`, `lib/setup-analytics.test.mjs`, `lib/auth-form-behavior.test.mjs` and `lib/profile-setup-navigation.test.mjs` with the repository's TypeScript test loader. They cover pending/denied/legacy consent, unavailable storage, asynchronous withdrawal/reacceptance and route races, minimal payloads, EU configuration, duplicate prevention, confirmed completion, navigation and all seventeen localized consent controls. Browser verification separately exercises the actual consent, registration and analytics components with synthetic SDK/account transports.

Before calling a release verified, check actual event arrival in the EU project after an explicit browser opt-in, and check the visible refusal/settings controls. A successful build or catalog parity alone does not establish event delivery or full visual coverage.
