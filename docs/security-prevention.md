# Preventative security checks

These rules record the lessons from the targeted check of 15 November 2026. They complement the existing privacy, media, authentication and release rules. They do not certify that production is free of vulnerabilities or enable a scheduled checker.

## Request counters

- Bound both the lifetime and cardinality of counters keyed by external input. Expire idle identities without waiting for that identity to return, bound key length, and saturate counts rather than growing them indefinitely.
- Never evict an active exhausted counter to admit a new identity: that would reopen its allowance. Test expiry, saturation, existing-user continuity and recovery with a controlled clock.
- The Proxy IP limiter is only a per-instance early guard. Durable authenticated route limits in `lib/rateLimit.ts` remain authoritative. Do not use memory counters to claim distributed attack protection or change product quotas as a side effect.
- The Proxy currently permits at most 10,000 IP/route buckets per instance. At capacity, untracked identities receive 429 and Retry-After until a cleanup makes room; existing tracked identities retain their allowance. Cleanup runs at most once a minute. Review this availability tradeoff against actual traffic before changing the cap.

## Cookies and sign-in

- Application cookies emitted by production API handlers use Secure. Browser-written preferences use Secure on HTTPS; preserve usable local HTTP development.
- Preserve SameSite, path, lifetime and existing HttpOnly requirements. The language preference intentionally remains browser-readable and survives sign-out. A preference or profile-completion cookie is never proof of authentication or permission.
- Keep sign-in and registration direct and usable. Add challenges only for an evidenced risk; do not make routine access harder to compensate for a missing server-side permission check.

## Private data and AI actions

- Use the existing current-request account, ownership, audience and canonical-media checks before returning or modifying private data. Test unauthenticated access, cross-account access, revoked visibility and retry behavior for the affected surface and equivalent routes.
- Treat Genie output, member content and uploaded metadata as untrusted input. The server must independently enforce member access, permitted actions and resource ownership; instructions in content cannot grant permissions. Preserve durable limits and explicit confirmation for actions that already require it.
- Optional product analytics remain consent-gated. Keep message text, drafts, search contents, credentials and private routes out of analytics and diagnostic logs. Do not add tracking or another consent system as part of security maintenance.
- A company membership is scoped to that company, independently of the member's Crew occupations and other companies. Select only the dashboard fields that the current role needs before serializing server-component props; hiding a private contact in the UI is insufficient. Preserve the explicit company ID across edit links, tabs, draft recovery and return navigation. A missing or unauthorized requested company must never silently fall back to another company. See `docs/company-links-check-20261116.md` for the focused checks and limits.

## Verification and handoff

- Public notices describe actual data processing and required AI/content disclosures, not inactive diagnostic configuration or development tooling. Before enabling a prepared service such as Sentry, review its data processing, notice and consent requirements. Keep optional framework-identification headers disabled; this does not make the underlying technology unidentifiable or replace access controls.

- Run focused regression tests on the affected behavior. Use disposable synthetic data for destructive or cross-account checks; never silently run those tests against customer data.
- Check dependencies against current advisories without silently upgrading or applying automatic fixes. Zero published advisories is not a claim that application logic is secure.
- Record the exact reviewed revision, checks, failures and gaps. Unit tests, an in-memory database, public HTTP checks and actual authenticated device tests provide different evidence; do not describe one as another. A blocked deep scan is not a completed scan.
- Send verified website changes and their actual publication status to APP Entwicklung. Native behavior requires its own verification. Preserve the explicit production release approval and guarded deployment workflow.

Regression coverage for the changes from this check lives in `lib/private-api-auth.test.mjs` and `lib/cookie-security.test.mjs`. No interface copy, design, application permissions or database schema were changed by this hardening.
