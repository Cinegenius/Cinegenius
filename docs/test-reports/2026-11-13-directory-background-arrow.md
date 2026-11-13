# Directory backgrounds and compact location preference

Markus requested the Companies design across public directories, removal of the black filter-section background, and an arrow instead of the visible country-preference sentence.

The shared toolbar now leaves the existing cinematic DirectoryPage image visible. Jobs and Filmtiere use the same wrapper; all eight directory loading screens use the shared compact DirectoryLoading. Cards, form fields and filter dialogs retain their readable surfaces. Result counts use the primary text color for contrast over the image. Homepage framing is unchanged.

The profile-place preference remains functional through a 44×44 px arrow beside sorting. Client toggles retain their pressed state, translated accessible name and retry action. News uses the same presentation with its existing server navigation URLs. No profile, permission, filtering or publication logic changes; no database migration or member-data mutation.

## Verification

- Shared design and localization checks passed: nine catalogs, no new text literals. Existing translated location labels are retained as accessible names and tooltips.
- 170 targeted cases validated across geography, marketplace, locations, job/project localization and project headings. The first run found nine adapter-fixture assumptions about the former Jobs root; the fixture now finds the actual serverJobs recipient within its new wrapper. All 60 job/project localization cases passed on recheck; the other 110 had passed in the initial run.
- Playwright on the real local app: eight routes at 320 and 1366 CSS px (16 cases). Exactly one background and toolbar, no opaque ancestor masking the image, no horizontal overflow. Filter panels remain opaque, Escape closes them and returns focus.
- Browser fixtures importing the actual shared controls: nine languages at 320, 768 and 1366 CSS px (27 cases). Arrow-only presentation, 44 px target, mouse/keyboard toggle, accessible pressed state, retained search input and dialog focus. Retry and the News destination were checked separately.
- Actual shared loading components: eight areas at 320 and 1366 CSS px (16 cases), one backdrop, bounded skeletons and no overflow. Only the Next image renderer was substituted in this isolated fixture.
- Screenshots reviewed at 320, 390 and 1366 CSS px. Final adjustment increases count/inactive-arrow contrast only; layout and actions are unchanged.
- Targeted lint has one existing News Date.now purity diagnostic, also reproduced from the base commit. No new diagnostic in the changed components or loading routes.

Browser plugin not available; installed Playwright was used. These are desktop Chromium simulations, not physical-device or native-app checks. Authenticated location state is a fixture; production Clerk keys reject localhost. Local development also surfaced the existing GlobalEffects card-animation hydration warning; that unchanged global animation is outside this visual patch. No member login, message or content write was performed.

Production build passed with the prescribed 4 GB Node heap, including localization validation, TypeScript and static-page generation.

The App development task acknowledged the shared-component coordination and will take the checked source for subsequent app work. Production publication requires the operator's separate request.

Screenshots, browser results and logs are retained outside Git in `/srv/cinegenius/handoffs/20261113-directory-background-arrow/`.
