# Newsletter access repair, 12 November 2026

## Proven cause

Two production POST requests to `/api/newsletter/subscribe` from the reported
Italian browser returned HTTP 401 in middleware, before the newsletter handler.
The screenshot shows consent checked and the generic processing error. A
controlled signed-out request with a valid same-site Origin and consent false
also returned `{code: "account"}` with 401. No address was subscribed and no
email was sent during this check. Production runtime logs had no newsletter
handler entry, consistent with this early rejection.

`proxy.ts` treated the three newsletter POST endpoints as member-only APIs, and
the confirmation/unsubscribe pages were absent from the public-page matcher.
The configured production project has a Resend API key; its value was neither
read nor printed.

## Change

Allow guest access only to the exact confirmation/unsubscribe pages and the
exact subscribe/confirm/unsubscribe POST endpoints. Preserve existing Origin
checks, consent validation, token/HMAC verification, database rate limits,
private API/admin protection and service-only database access. Adjacent paths
and unsupported methods do not inherit the exception.

Newsletter controls now use the existing gold theme instead of undefined lime
utilities, with 44px targets and localized field errors. Requests preserve the
typed address and consent, prevent duplicate submissions, and cannot claim
success for unreadable or unexpected JSON. Temporary action failures and rate
limits no longer masquerade as an expired confirmation link. All nine catalogs
were updated together. Backend details and retained token-retry limitations are
in `newsletter-signup-api-2026-11-12.md`.

## Verification

- Full regression suite: 3,065/3,065 passed.
- Focused newsletter, email and middleware boundary tests: 87/87 passed, including
  actual Clerk route matching, guest requests, foreign Origin rejection,
  adjacent private/admin routes, consent and token validation, provider/database
  failures and all supported languages.
- TypeScript, scoped ESLint, design check and translation check passed
  (9 catalogs, 7,440 keys, no unreviewed source literals).
- Native Safari review of the actual components in a local 320 CSS px iframe:
  Italian consent validation, readable gold submit/retry button, preserved email
  and consent after a simulated 503, and successful retry all passed. Belgian
  Dutch confirmation text wrapped inside the same width; temporary failure and
  successful retry were verified. All requests were simulated with external
  connections blocked. This was a browser-width simulation, not a physical
  phone, software-keyboard or native-app test.

No campaign send, recipient import, subscription backfill, schema change or
real confirmation email is part of this repair. Browser review and live public
validation are separate from isolated tests. Actual inbox delivery requires a
user-authorized test address; no address from the screenshot was used to send
an unsolicited test message.
