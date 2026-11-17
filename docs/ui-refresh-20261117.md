# Directory and personal-area refresh, 17 November 2026

## Scope

- Community board: shared directory backdrop/header, neutral directory cards, shared selection controls and accessible dismissible composer. The homepage board retains its existing accent treatments. Loading failures offer a retry; failed submissions keep the typed content and private draft protection.
- Film animals: shared compact grid/list layout, separate favorite action, existing filters and detail contact/rating paths. Details retain the gallery and gain consistent spacing and touch areas.
- Bookings: compact responsive overview, explicit outgoing-load errors and retries. Accept/reject changes the visible status only after a successful matching server acknowledgement. Duplicate decisions are blocked; failures reload the incoming status without inventing a successful decision.
- Saved items: compact rows and account-scoped text search alongside the existing type selector, preserving confirmed favorite state and account-switch protection.
- Homies: an optional private subset of accepted contacts, selected by a star and shown through the Homies filter. Reuses the already-live `cinegenius.friendships.v1` read/write contract, with exact account/acknowledgement checks, server capability checks, serialized desired-state writes and read-back after an unclear result. No new migration or public badge; general saved profiles/offers remain separate.
- Organizations: common directory cards and public detail header; existing homepage logo cards are unchanged. Industry partners already use the current company directory.
- Help: shared header, topic selection, searchable questions, accessible accordions and direct links to existing account destinations. Location approval and occupation-selection explanations reuse current localized copy.

No API shape, database schema, publication rule, identity permission or stored media origin changes. Native integration must preserve its own dashboard settings and Smart changes.

## Map information

Shared map pins expose already-public titles, subtitles and places on hover or keyboard focus. Clusters show the existing public member titles. Text is rendered literally, never as HTML. Only one information window remains open when changing pins. Escape closes it; tapping still opens the existing persistent preview and detail link. No identity request is added on hover.

## Homepage follow-up

Remove only the opaque background on the photo-discovery section so the existing full-page image continues behind it. Preserve photo captions' contrast, dimensions, sequence and interaction. Rename the gallery to “Neue Bilder” with “Entdecke Bilder von Mitgliedern.” in all 17 catalogs. Main-image photo references are proposals only; no replacement image is installed.

The photo band continues on pointer hover and resumes after dragging. Keyboard focus, explicit pause, reduced-motion preference and offscreen/hidden-tab suspension remain supported. Homepage jobs reuse the notice board request card surface and thin amber accent via `lib/notice-card-styles.ts`; dimensions, grid and copy stay unchanged. The board retains exactly its existing four color treatments.

## Verification and limits

Evidence is kept outside the repository at `/srv/cinegenius/research/20261117-map-pin-previews`.

- Focused regression suite: map lifecycle, safe pin text, Smart projections, favorite failures/account changes, booking acknowledgement failures, organization visibility and discovery selection.
- Public browser checks at 320, 390, 834 and 1440 CSS px: help search/accordion, organizations, animal grid/list, overflow; signed-out community protection.
- Isolated browser fixtures at those widths: board load retry, dialog Escape/reopening, failed write retaining text, successful retry, saved-item search and removal. They use synthetic accounts and intercepted test data, not production mutations or actual authentication/private-recovery services.
- All 17 locale catalogs (11,051 keys), shared design checks and focused lint; dashboard retains pre-existing effect lint debt. Standalone TypeScript passes including Homies. The framework build compiled and completed type checking/static generation, then failed at the existing framework security gate; this is not a clean production-build result. Subsequent homepage naming and Homies changes were checked with TypeScript, localization, unit tests and isolated rendered-component fixtures.
- Homies browser fixtures pass at 320, 390, 834 and 1440 px: filtering, confirmed stars, failed-write preservation and retry. The real shared server migration was verified live on 16 November; this new Web UI remains unpublished. Map hover/focus/Escape/persistent click previews pass in all four directory types. Tests do not grant Smart access to non-admin users.
- Recorded build failure: installed Next.js `16.4.3` (declared `^16.4.3`); `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.`, reported `exitCode: 1`, after compilation, type checking and static generation. Evidence: `build-final.log`, lines 269–287, plus `dev-final.log`. This log does not identify a specific advisory/CVE or fixed target version; those remain unverified. The latest jobs/photo-band follow-ups were not included in that earlier build attempt.
- Native iPhone/iPad/Xcode and real signed-in device flows are not verified by these browser simulations. Production publication requires a separate operator request and guarded release checks. The previously reported framework security warning is not remediated by this UI change.

## Separate pending work

The later discovery follow-up is recorded in `docs/shared-discovery-follow-up-20261118.md`; the list below describes the boundary of commit `b02040d`.

This patch does not restructure Location/Marketplace/other-offer forms, required search metadata or category taxonomies. Also separate: stable random Crew discovery, new-then-mixed photo discovery, company logo enlargement, removing online/activity indicators, the approved alternative public-profile presentation, data-backed organization occupation filters, and physical-device checks. Existing unrelated app proposals must not be reported as implemented or live by this refresh.

Follow-up checks: actual photo-band component with synthetic images passes continuous-hover, pause/resume, keyboard, pointer-drag recovery and reduced-motion checks at 390/834/1440 px. Job styling is checked as an isolated rendering of the source classes with the existing compiled stylesheet at 320/390/834/1440 px, not a fresh production build.

## Additional App handoff — pending, not implemented

The Mac App task handed over three further shared-surface requests on 17 November 2026. They are recorded separately from this refresh; no publication, account mutation or paid image-generation approval is inferred from the handoff.

- Company/studio standard motifs: selectable dark/lime line illustrations, intentionally identical for the same company category. Keep an existing uploaded logo unless its owner explicitly changes it. Separate these reusable company motifs from personal avatars/covers; never add standard artwork to real-photo discovery.
- Company categories: preserve central IDs and multiple assignments. Initial read-only finding: `kostumfundus` already exists as “Kostümfundus”; `requisite` exists as “Requisite & Ausstattung”. A separate “Requisitenfundus” ID is not present. The public directory filters categories by actual published inventory, so a missing browse choice alone does not establish a missing creation choice. Review creation/editing and search before proposing additional IDs.
- Homepage project tiles: request is for slightly larger, readable horizontal mini-cards using real public project data, preserving company card dimensions. This website checkout currently renders only the “Aktuelle Filmprojekte” section heading/link, not project cards. The Mac task clarified that mini-cards are a new design request, not a separate existing implementation. Build any future rail from actual eligible public project data, preserving current visibility rules, homepage order and App-specific selection logic; do not replace the whole homepage.
