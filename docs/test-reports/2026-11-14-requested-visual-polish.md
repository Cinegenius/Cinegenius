# Requested visual polish and shared messages entry — 14 November 2026

## Scope

Only the operator's requested surfaces are changed:

- Home: distribute the four topic labels, remove the Dashboard CTA in that row, let pointer/touch gestures across carousel dots move the real cards directly, add a restrained job border, show available organization logos in News attribution, equalize organization and discovery card heights, and shorten discovery copy in all nine locales.
- News: use the shared brand emphasis for the complete “Workshops & Veranstaltungen” part of the existing heading.
- Locations: remove the secondary “Alle Locations ansehen” CTA; retain the create action and existing list/map/split behavior. Reuse the company directory's restrained view-selector treatment through shared CSS.
- Account menu: reserve the fixed mobile bottom bar and safe area, keep the sign-out footer visible inside the scrollable menu, and retain all member/admin destinations.
- Header: one Messages entry instead of separate chat and bell icons, and the flag alone as the language trigger. The full wordmark, portrait and 44px controls remain.
- Messages: shared Chats / Notifications navigation on the existing routes, using real link history. The header combines stored unread chat counts with non-chat notices, without counting legacy message notifications twice. Notice reads refresh the existing account-bound snapshot only after successful acknowledgement; failures retain unread state. Notifications no longer fetch or repeat conversation previews. Retry and account/locale response guards remain effective.
- Crew: marketplace and location provider shortcuts beside the profile count, using the existing declared-provider filters. The count continues to show the total directory population while a provider shortcut is selected (180 in the observed public data). Shortcuts appear only for available provider types; mixed profiles stay single records. At 320px the icons wrap below the count rather than shrinking touch targets.

There are no schema migrations, member-content rewrites or publication-rule changes. Organization logos use the existing approved public organization projection and MediaImage. Legacy /notifications links remain valid. The App development task has been notified to avoid parallel edits and will receive the release commit.

## Verification

Browser plugin not available; installed Playwright/Chromium was used. Public pages were exercised at localhost:3011. Clerk's production keys reject localhost; signed-in navigation and message pages were therefore additionally exercised as actual React components with controlled authentication/API fixtures, not as a real authenticated production session.

- Homepage reflow: all nine locales at 320px; German at 390px and 1366px. Four distributed topic labels, equal discovery/org card heights, actual news logos, subtle job borders and no horizontal overflow.
- Carousel: mouse and touch movement before pointer release, tap, keyboard, cancelled gestures, ordinary vertical page scrolling, reduced motion, and 44px dot targets. Crew/location rails tested at 320, 390 and 1366px. The real homepage touch test moved the rail from 0 to 429px during the gesture.
- Locations/company controls: identical computed background, color, radius, inset border and 44px height at 320, 390 and 1366px. Both location view actions work; removed CTA absent and create link present.
- Shared inbox: 27 combinations (nine locales × 320/390/1366px), one visible header entry, separate route navigation, native Back to both previous destinations, no acknowledgement on open, combined counter, load error/retry, failed read preservation and successful counter refresh. Final flag-only header and notice touch targets rechecked at 320/1366px.
- Account menu: member/admin fixtures at 320×360, 320×568, 390×844, 844×390, 768×512, 1024×768 and 1366×768; scroll to the end, verify the sign-out hit target is uncovered and invoke only the fixture sign-out. An additional 34px safe-area reserve is simulated.
- Crew: actual public directory at 320/390/1366px; both shortcuts toggle, retain “180 Profile”, stay 44px and avoid horizontal overflow. Desktop flag-only selector changes locale to English through the existing cookie/refresh flow, retaining the route.
- Targeted tests cover homepage streaming, organization editorial data, location controls, header/account transitions, message loading/navigation, notification localization/late responses, inbox account scope/polling, provider filters and provider deduplication. Final modified header/notification suites: 33 passed. Provider suites: 5 passed. Earlier unchanged suites passed in the scoped runs.
- Targeted ESLint, check:design, check:i18n (nine catalogs, 7,792 keys, no new untranslated literals) and production build are release gates. The earlier successful complete build is recorded with exit 0; the complete build after the provider shortcuts and flag change also exits 0. The subsequent account-menu change only adjusts height/footer classes and is browser-checked; the guarded production build validates the final source again. Production uses only the guarded clean-main release script.

Evidence, test scripts and final publication receipt are kept outside the repository at `/srv/cinegenius/handoffs/20261114-requested-visual-polish/`. No real member messages or notice states were changed in testing. Physical iPhone/Android devices and authenticated production interactions were not exercised; browser simulations do not establish native-app compatibility.
