# Smart search: keyword recognition and compact results — 14 November 2026

## Requested correction

Markus identified `/search?plan=…` (heading “Smart-Suche”), reached through Genie,
as the surface with oversized cards and clipped previews. He also reported no
results for “Kostüm” and for “Beleuchter Kostüm” without punctuation. This change
is limited to that result presentation, the shared Smart matching/interpretation
path, and his subsequent shorter Genie pricing summary.

## Behavior

- Smart results use compact horizontal rows with a 48 × 48 image frame, full-image
  `object-contain`, intrinsic dimensions and unchanged protected-media handling.
  Ordinary search keeps its existing layout. Titles and subtitles remain complete
  in the accessible link, with restrained visual truncation. Availability uses a
  labelled dot; existing prices and detail destinations remain accessible.
- Exact department names resolve the complete existing occupation catalogue,
  including secondary saved positions and translated department labels. Kostüm,
  kostum, kostuem and Costume are recognized. Legacy clothing categories map to
  the current clothing group; specific vehicles do not expand to sibling cars.
- Complete known keyword lists work without commas or conjunctions. For example,
  “Beleuchter Kostüm” produces two crew wishes. A single trailing explicit town or
  country is preserved for both wishes. This narrow, fully recognized path runs
  before the provider request, after the existing member/origin/quota checks.
  It therefore adds no paid interpretation request. Unknown modifiers, negation,
  ambiguous geography, complex place attachment and oversized lists stay with
  Genie. Multi-word occupations are kept whole; no unmatched text is discarded.
- If the provider combines known keywords in one wish, normalization separates
  them while retaining that wish’s places. Validated Smart responses contain a
  single precise results link, without broad directory shortcuts losing filters.
- Current quotas, models, member-only access, privacy projection, no-store
  responses, private media permissions and non-persistent search handling remain
  unchanged. No database migration or member-content rewrite is needed.
- The nine-locale Genie summary now states that registration/basic functions stay
  free for the community, commission requires an agreed successful support
  arrangement and advance disclosure, and optional extras may become paid.
  Existing detailed 5% support-rental conditions remain in the server policy.
  This is a Genie summary update, not a revision of legal documents or billing.

## Verification

- 82 focused search, interpretation, privacy/API and image regression tests passed;
  after adding two more route/category regressions and updating the pricing copy,
  all 60 affected API/server tests passed. The 24 unchanged pure/image tests from
  the preceding run also passed: 84 distinct tests in total.
- `check:i18n`: all nine catalogs, 7,914 keys, no new source literals.
- `check:design` and targeted ESLint passed. Production build passed.
- Chromium with actual result components, Next Image and global styles: 320, 393,
  834 and 1440 CSS px, nine locales; 44px+ touch targets, no horizontal overflow,
  complete portrait/landscape previews, detail/Back navigation, pagination retry,
  initial-load retry, empty states and bounded image-error recovery. Result rows
  measured 66–68px in the representative fixtures, compared with 86px+ before.
- An additional render used three public production profile photos and three
  public offer photos. Every live permission-checked image loaded, remained
  uncropped and stayed inside its 48px frame at all four widths.
- Smart form → Genie response → validated URL → both result groups → real browser
  Back checked in nine languages using simulated membership and API responses.
- Read-only queries against actual published data, using the real matching and
  privacy functions, paginated to completion. At the time of the check, “Kostüm”
  and “kostuem” each returned 15 visible crew profiles and 3 companies;
  “Beleuchter Kostüm” returned separate groups of 26 and 15 crew profiles.
  Geography remains restrictive: absent local results are not replaced with
  unrelated places or fabricated records.

## Boundaries and release status

The browser plugin was unavailable, so the existing Playwright/runtime setup was
used. Browser viewport simulations are not native iPhone/iPad/Android tests.
Authenticated UI boundaries were simulated; public photos and database matching
were real read-only checks. The local environment has no usable OpenAI key, so
new arbitrary free-form provider interpretation was not exercised live. The
reported bare-keyword cases execute the verified deterministic server path.

Evidence: `/srv/cinegenius/audits/20261114-smart-search-matching-and-rows/`.
Prepared for APP Entwicklung coordination. This report does not constitute a
production deployment or a native-app release.
