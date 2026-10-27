# Back navigation and admin entry — 27 October 2026

## Confirmed causes

- Marketplace, Locations and Jobs scheduled unconditional `router.replace` calls 300 ms after a filter change. Search also wrote its address from multiple effects. A delayed replacement could cancel a link navigation whose server response was still loading. The same scheduled work could overwrite a history traversal. Unchanged addresses also triggered unnecessary replacements.
- Reproduced with the actual `PropsContent` component, controlled fixture listings and a destination delayed by 1.2 seconds: changing search and immediately clicking the destination left the browser on `/props?q=Test` instead of opening the destination.
- The current signed-in Safari session could read `/admin` as Markus Müller. The account and mobile menus contained no admin entry. No admin permission or database change was needed.

## Changes

- Shared `scheduleViewUrlReplace` / `useViewUrl` cancel pending filter-address updates on same-tab link navigation, back/forward, page exit and cleanup. They reject cross-area/cross-origin updates, skip identical URLs and check that the original URL is still current before replacement.
- Marketplace, Locations, Jobs and Search use that shared guard. Search requests remain separate from address updates. No custom browser back stack, multiple-step history traversal or fallback redirect was introduced.
- Root layout derives the one current admin account from the existing server-only allowlist. Navbar shows the translated admin link only while that same account is active. Both desktop and mobile menus link directly to `/admin`. All existing server access guards remain in place.
- Signed-out admin entry preserves its requested destination through sign-in.

## Verification

- Local Next.js browser fixture uses real Links, router, view-state hooks, `PropsContent`, CompaniesContent and Navbar, with own test data only.
- After correction: test home → marketplace → delayed detail → companies. Exactly three Back actions returned detail → marketplace → test home. Exactly three Forward actions restored marketplace → detail → companies. History length stayed five including the initial blank entry; search `Testkamera` remained in the marketplace entry.
- Desktop admin menu showed `/admin` for the server-confirmed fixture account. Switching to another account removed the link.
- Mobile admin menu at 390 CSS px opened the fixture admin page. This was a browser iframe simulation, not a physical-phone test.
- Regression cases cover delayed replacements for four areas and twenty destinations, back/forward and cleanup cancellation, changed URLs, modified clicks, new tabs and downloads. Rendered Navbar tests cover server-confirmed admin, different active account, signed-out state and absent server authorization.
- Full automated suite, TypeScript, lint, design and all six translation catalogs checked. Production build completed successfully. See execution logs in `/private/tmp/cg-back-navigation-*` for run totals.

## Scope and limits

- Existing public homepage → profile → browser Back also returned to the homepage during the read-only production check. The confirmed cancellation race was reproduced locally with delayed server loading; no claim that every reported instance had that exact timing.
- No production account permissions, member records, messages or offers were modified. No physical iOS/Android device test or full third-party sign-in cycle was performed.
- This report covers local changes and verification; deployment is a separate release action.
