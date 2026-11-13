# Jobs renewal and profile-based geographic discovery

Status: prepared on `codex/jobs-renewal`; production publication requires Markus's explicit request.

## Behavior

- Crew, marketplace, locations, companies, jobs and projects expose a country filter. News supports a country filter and keeps a selected country/location when a news entry is saved and edited.
- The current account's saved place prioritizes its city, region and country in the default directory order. Other countries and entries without a place remain available. Explicit place filters and manual sort choices take precedence. No browser location, language or IP inference is used.
- Marketplace and News apply geographic order before database pagination. Locations reads complete bounded pages instead of its former 300-row cap. Existing published-only and organization approval checks remain in effect.
- Jobs uses the shared header, mobile filters and compact result cards. Compensation, dates and employment type come from saved facts; no invented posting date, contract type or union status. Exact catalogue roles replace substring-based role assignment.
- Posting opens the Jobs category directly. Existing jobs have editable job-specific fields, private form recovery, and the existing review/publication permissions. Application drafts are account-bound, recover after interruption, preserve input on errors and clear after a confirmed submission. Current job availability is checked before recovery access.
- Shared mobile filters use a native modal dialog, restored focus and visual-viewport sizing without synthetic history entries. Country labels use the existing nine next-intl catalogs to avoid browser/server display-name differences.

No database migration, bulk data rewrite, real application or notification was performed for this change.

## Verification

Evidence: `/srv/cinegenius/handoffs/20261113-jobs-geographic-browse/`.

- `npm run check:i18n`: nine catalogs, 7,768 keys, no new source literals requiring review.
- `npm run check:design`: passed, including native modal semantics and existing navigation/design guards.
- Geography, job localization, account scope and application messaging regression group: 67 passing tests.
- Locations, filters/search, projects and organization API group: 107 passing tests. Includes a 521-location fixture beyond the previous cap and News country persistence through editing/publication/filtering.
- Final shared controls, Locations, Jobs/project localization and marketplace group: 132 passing tests.
- Existing editor/place-field, marketplace publication and project draft tests were also checked. The organization API mock needed the new geographic helper; its corrected suite passed.
- New/rewritten components and helpers pass targeted ESLint. Comparison with the base commit found no additional diagnostics in changed legacy components after correcting the job editor dependencies. Existing repository-wide lint debt remains; this is not a clean full-repository lint claim.
- Real database **read-only** verification: all 29 public marketplace entries and 13 public News/event entries retain their complete geographic order across page boundaries. Synthetic PostgreSQL fixtures additionally cover city/region/country/null cases and failed count queries.
- Initial rendered-browser checks: eight public routes at 320, 390 and 1440 CSS px, without horizontal overflow or non-Clerk application errors. Country filtering and labels checked in all nine supported locales at 320 CSS px.
- Isolated browser tests import the real application form, recovery provider and geographic hook. They cover saved-input recovery, language changes, separate accounts, failed-send retry, success clearing, delayed stale preference responses and logout clearing. All network writes in this fixture are mocked.

- Final production build, including TypeScript and localized country names on project details, passed.
- Production-mode browser matrix: all six directories at 320×740, 375×812, 390×844, 430×932, 768×1024, 1024×768 and 1366×900; 42 checks passed without horizontal overflow or non-Clerk application errors.
- Browser interactions: explicit country selection, empty results and restoration, native modal focus/background inertness, Escape and focus return, 390×420 viewport footer visibility, real list/detail/Back navigation with restored filters, and no added history sentinel. Passed. Native Chromium can move focus to browser chrome at the dialog boundary; background application controls remain inert.

Final commit, build result and publication status are recorded in the accompanying receipt.

## Limits

The server has no real signed-in browser session for this review. Clerk production keys reject localhost; that expected hostname error is excluded from local public-browser error checks. Account flows use an isolated synthetic browser fixture, not a live login. Viewport/keyboard tests are browser simulations, not physical iPhone/Android or native-app certification. Existing unknown countries are not guessed or backfilled. A missing profile place leaves the ordinary directory order usable.
