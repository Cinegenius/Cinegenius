# Navigation and company messages — 27 October 2026

Status: pre-release verification of the navigation and company-message changes. Deployment confirmation is recorded separately in the release conversation. These tests did not modify production data, accounts, permissions or storage objects.

## Confirmed causes and changes

- Crew mounted its entire inner view under a key derived from profile data. A refresh could remount the filters. In addition, an effect reset visible results to 24 whenever the filtered data changed, including background arrivals. Removed the data-dependent key; pagination now belongs to the filter criteria, not the response array.
- Directory and admin controls existed only in component state. `useViewState` now stores small controls on the current browser history entry, scoped to route and Clerk account. Search, filters, sorting, selected categories, display mode and pagination are restored without caching fetched records. Existing Next history metadata is preserved. Crew selected-role Sets survive structured cloning.
- `NavigationRestoration` records settled scroll positions and captures departure coordinates before navigation. Back/forward waits for sufficient document height, with a bounded fallback for shorter/removed content. User scrolling cancels restoration. Fresh route visits start at the top; background refreshes do not. History writes are debounced to avoid Safari write limits.
- `ContextBackLink` uses history only for a recorded internal list visit; direct visits retain a regular fallback link. Used in crew, location, marketplace, job and project detail headers.
- Admin data effects and overview responses reject superseded requests. Lists retain existing rows during refresh. Admin component data remounts on account changes; view controls remain account-scoped.
- Board searches reject outdated responses and retain existing posts on refresh errors. Initial full-page loading no longer starts a competing unfiltered request.
- Deferred message scrolling checks account and conversation again before executing. It scrolls the message viewport only. New arrivals while reading older messages produce a translated jump button instead of forced scrolling. Drafts are isolated by conversation; successful sends do not clear newer text or append into a different open conversation. Loaded older history is retained during latest-page polling.
- Listing, personal and company galleries identify selected images by URL rather than offset. Company thumbnails use image keys. Lightbox body scroll locking is independent of changing keyboard callbacks.
- Company profiles have a translated message action. `/companies/[slug]/message` requires sign-in and resolves the published company's actual responsible account server-side. It reuses the existing direct-message flow; no new company inbox or public person profile is created. A separate authenticated context lookup verifies the company/recipient pair before displaying company identity. URL-supplied company names are not trusted. Existing blocks and message permissions remain enforced by the message API.

## Verification performed

626 previous/new tests plus two additional regressions: **628 passing**. Production build, TypeScript and translation validation pass. Changed-file lint: no errors; one existing native-image warning in CompanyDetail.

Browser tests ran on Next 16 with real application components and routing, **mock accounts and controlled local HTTP fixtures**, outside the production application:

| Scenario | Observed result |
| --- | --- |
| Shared history controls; URL replacement; multiple list/detail visits | Search and 60 loaded rows retained. Return position 2880 CSS px retained. |
| Crew: Licht, search, 48 rows, profile visit and internal return | Search, department, 48 rows and recorded 1600 px position retained. |
| Companies: search + Tonstudio, 48 rows, detail and return | Both filters, page 2 and 1370 px position retained. |
| Company account switch | New account saw default controls and 24 rows, not the previous filters/page. |
| Company mobile simulation, 390 × 844 iframe viewport | Native select/search/load-more usable; 48 rows and 5413.5 px position retained after detail return. This is viewport simulation, not a physical iPhone test. |
| Admin: delayed search response (650 ms) followed by a newer search | Newer result remained; old result did not overwrite it. |
| Admin: filtered page 2, reload | Profile tab, query and page 2 restored. |
| Messages: incoming message while reading older content | Scroll stayed at 1906 px while height changed from 3866 to 3974; new-message hint appeared and unsent draft remained. |
| Messages: prepend older page | Older messages appeared; scroll increased by the added height (3735 px), preserving the reading window; draft remained. |
| Company gallery: reorder while photo open | Same photo C remained open while its displayed position changed from 1/3 to 3/3. |
| Company contact route | Unit-tested signed-out return path, actual owner resolution without a public person profile, private/missing company, missing responsible account, self-contact, and technical-error handling. Button visually checked in the real CompanyDetail component. |

## Limits and remaining work

- No real device/Safari gesture or throttled production-network test was performed. Only the admin out-of-order response used an explicit delay.
- Real-account company message delivery, replies and production read-state persistence were not exercised; no real members were messaged. The existing API protections remain in place and existing automated tests pass.
- Other directory controls share the tested history mechanism, but complete real-data flows for every category, booking, form and admin mutation were not performed.
- The pre-existing crew API/client design still prefetches remaining pages for client-side filtering. This change does not introduce an additional restoration fetch, but a scalable server-filtered pagination redesign is still needed before claiming bounded directory loading at large scale. It was not silently changed because that would risk missing category results.
- The masonry photo feed lacks authoritative original dimensions for every old image. Its existing intrinsic-ratio load shifts have not been fully eliminated. Fixed-aspect listing galleries and selected-photo stability are covered; a claim that all image layout shifts are solved would be incorrect.
- Scroll fallback is bounded at 2.5 seconds. Very late data or images can still need further device/network verification; removing items can clamp the restored coordinate to the new page height.

## Main files

Shared: `lib/navigation-context.ts`, `lib/use-view-state.ts`, `components/NavigationRestoration.tsx`, `components/ContextBackLink.tsx`, `components/AppChrome.tsx`, `lib/use-gallery-selection.ts`.

Consumers: the six public directory content components, `components/CommunityBoard.tsx`, `app/admin/page.tsx`, `app/messages/page.tsx`, detail back links, `components/ListingPhotoGallery.tsx`, `components/CreatorDetail.tsx`, `components/Lightbox.tsx`, company detail/contact route/context API, and all six message catalogs. Targeted regressions are in `lib/navigation-context.test.mjs`, `lib/company-message-entry.test.mjs` and the AppChrome fixture update.
