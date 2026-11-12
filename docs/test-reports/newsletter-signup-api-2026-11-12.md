# Newsletter signup API verification — 2026-11-12

The public-route middleware correction is coordinated separately with this API change. These checks cover the actual newsletter handlers and confirmation-email renderer with isolated database, delivery and locale fixtures. No production database was changed and no email was sent.

## Behavior covered

- Signup uses only the address explicitly submitted with boolean `consent: true`. Invalid JSON, invalid addresses, omitted consent and string/number consent cannot persist a subscription or send mail.
- Anonymous handlers have a closed dependency allowlist. Account/Clerk lookup imports and real network access fail the fixtures.
- Successful signup normalizes the typed address, stores the SHA-256 token hash, sends the original token only in the confirmation link, and preserves the 48-hour expiration and consent version.
- Existing confirmed subscriptions receive the same public response without another confirmation message.
- Signup accepts only the expected `pending`/`confirmed` RPC results. Database failures, unexpected responses, rejected delivery and transport exceptions return a localized retryable 503 response.
- Confirmation updates only a pending, unexpired token hash. Invalid or expired tokens remain 400; database/transport failures return `actionError` with 503. Rate limiting returns 429 with a separate ten-minute retry message.
- Unsubscribe validates its HMAC proof before writing, scopes the update to its confirmed subscription, and keeps repeated successful requests idempotent. Database, transport and unavailable signing configuration return a localized retryable 503 response.
- Every supported locale is exercised for signup, confirmation backend errors and confirmation email. Confirmation HTML escapes copy and links, preserves Unicode and normalizes subject line controls.
- Missing email configuration now emits a generic diagnostic. Captured diagnostics contain neither addresses, confirmation tokens nor signing secrets.

## Executed checks

```sh
node --test lib/newsletter-api.test.mjs lib/newsletter-confirmation-email.test.mjs
```

44 tests passed. The fixtures use dummy environment values and provider responses; they do not establish real inbox delivery or device compatibility.

Targeted ESLint and `git diff --check` also passed.

## Existing retry limitations retained

This change preserves the current subscription schema and token lifecycle. A second pending signup replaces the stored token before its replacement email is accepted. If that replacement send fails, an earlier delivered link no longer confirms the subscription. Changing this safely requires separate token persistence/delivery coordination; it is outside the middleware/API correction.

Confirmation still consumes its token on success. If the database confirms the subscription but the HTTP acknowledgement is lost, repeating the same token returns the existing invalid-link response. The subscription remains confirmed. Token-level idempotent acknowledgement is a separate follow-up.
