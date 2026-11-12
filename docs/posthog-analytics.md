# EU usage analytics

CineGenius loads the PostHog SDK only after a new, explicit analytics choice and only on public directory routes. The former notice-dismissal value is not consent. Refusal and acceptance have equivalent controls, and the footer/privacy page can reopen the choice. Storage failures fail closed. The legacy dismissal flag remains only for Genie's notice-clearance behavior.

The first release intentionally records only public directory page views, with a category URL and an anonymous identifier held in tab memory. It does not measure successful registrations, bookings, purchases, messages or publication, and does not imply those conversions from a route visit. Queries, hashes, member IDs, titles and content are not part of the payload. Account, authentication, onboarding, editing and administrative routes are excluded. In-flight SDK loading must recheck consent and the current route before initialization.

The SDK is pinned, lazily loaded and configured for the EU ingestion endpoint. Remote flags/configuration, externally loaded extensions, session replay, autocapture, heatmaps, error capture, surveys and person profiles are disabled. The send filter rebuilds the payload from allowlisted fields and preserves the public project token required for ingestion. IP storage as an analytics property is disabled; the connection still necessarily processes an IP address.

`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is the public, write-only token of the EU project, configured in Vercel production. It is not a personal or server administration credential and is not stored in the repository. No US project token is used. No PostHog events are sent from server routes. The existing Vercel Analytics/Speed Insights integrations are unchanged.

## Verification

Run `lib/product-analytics.test.mjs` with the repository's TypeScript test loader. It checks pending/denied/legacy consent, unavailable storage, asynchronous revocation and private-route races, minimal payloads, EU configuration, duplicate prevention, navigation and all nine localized consent controls. Include the existing Genie client tests because notice dismissal controls its launcher clearance.

Before calling a release verified, check actual event arrival in the EU project after an explicit browser opt-in, and check the visible refusal/settings controls. A successful build or catalog parity alone does not establish event delivery or full visual coverage.
