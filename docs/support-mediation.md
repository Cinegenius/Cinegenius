# Community pledge and free new Support mediation

Operator decisions, 16 November 2026, supersede the previous prospective Support
commission policy. This policy is prepared for publication; source changes alone
are not a production release.

- Current base functions (registration, profiles, listings, ordinary search,
  direct contact and existing community features) stay free for at least one year
  from publication of the pledge. Profiles remain permanently free.
- NEW Support mediation engagements are free during the same period. The former
  prospective commission and extra-support-fee language must not be reused.
- Provider rental, sales and service prices are separate. Existing individual
  agreements are not retrospectively amended, refunded or deleted by this pledge.
- Additional optional functions may become paid in future only with transparent
  advance scope, price and conditions and a separate explicit paid booking.
  No automatic subscription or paid conversion at the end of the free period.
- Community building and authentic profiles are goals, not a claim that all
  identities are verified, a profit-sharing guarantee or legal nonprofit status.
- Free does not mean unlimited access: existing privacy, safety, rate limits,
  moderation and the admin-only Smart development preview remain in effect.

`lib/community-policy.ts` holds fixed dates. Before the FIRST production release,
set the publication date to that release's actual calendar date and retain at
least one full year through the inclusive end date. The current dates are draft
release dates. Never recalculate this promise from the current date on each page
visit, shorten a published period, or charge automatically when it expires.
Record the first publication dates in the release receipt. A later app release
must use the same website pledge dates rather than restart the period.

`SupportMediation` is the shared nine-language informational copy for the pricing,
about and request/help surfaces. The pricing, help and metadata catalogs use the
same meaning. The German original is rendered in the AGB costs section; updated
AGB change-of-services text stays in `LegalAuditOriginal` in every locale. The
existing legal-language notice remains in place. Translations and this research
are not represented as lawyer-approved legal documents.

Genie's short cost answer uses `SupportMediation.genieSummary` through its existing
server-enforced topic handling. It contains no monetary amounts, percentages,
calculations, pricing links or invented future plans. Generated fees and previous
chat answers cannot override it. Provider-price questions and member-written
texts remain distinct. The tests use a mocked provider; this does not establish
how every freely phrased real-model query is classified.

## Implementation boundaries

No payment collection, Stripe activation, support-mandate writer, provider payout,
booking calculation, database migration or historical transaction is changed.
`app/api/bookings/route.ts` still stores a zero platform fee. The unused historical
commission helper is not imported into live charging flows. Do not erase old
agreements or reuse its defaults for new Support engagements.

## Primary legal sources consulted, 16 November 2026

- [BGB § 307: clarity and fair standard terms](https://www.gesetze-im-internet.de/bgb/__307.html)
- [BGB § 312j: express payment obligation for consumer online orders](https://www.gesetze-im-internet.de/bgb/__312j.html)
- [UWG Annex, no. 20: misleading free claims](https://www.gesetze-im-internet.de/uwg_2004/anhang.html)
- [AO § 52: separate requirements for charitable purposes](https://www.gesetze-im-internet.de/ao_1977/__52.html)

The described free offer followed by separately optional paid extensions is
possible in principle; precise scope, an honest free period and no silent paid
conversion are essential. This is a scoped wording review, not a comprehensive
legal clearance of the entire AGB, tax treatment or future paid checkout.
