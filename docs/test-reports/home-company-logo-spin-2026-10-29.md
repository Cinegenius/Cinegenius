# Homepage company-logo interaction — 2026-10-29

## Scope and behavior

Only the homepage's existing company selection uses the new `HomeCompanyPartners` client component. The server still selects the same six published companies and supplies the same public links, logo references and labels. No database, API, upload, logo file, company data or other company surface changed.

- Reuses `CompanyLogo` and `MediaImage` unchanged, including containment and checked-media delivery. The same source appears on two backface-hidden faces; the rear face is rotated 180 degrees so lettering remains readable rather than mirrored. Existing logo canvas/backgrounds and 96/112 px heights are retained.
- Only the logo rotor moves. The homepage card no longer participates in the shared `card-hover` tilt, which would otherwise move the name and metadata as well. Other cards and shared hover rules are untouched.
- Clear horizontal intent (8 px mouse / 12 px touch, with horizontal dominance) starts a spin. Direction and bounded release speed influence the end angle and duration. Motion decelerates to a multiple of 360 degrees, then resets to a frontal transform; release animation lasts 1.1–2.3 seconds.
- Ordinary anchors and keyboard activation remain intact. Drag-generated clicks are blocked only for the originating company and a brief interval; a new pointer action resets that guard. Vertical dragging is also protected against an accidental final mouse click, without preventing default vertical scrolling. `touch-action: pan-y pinch-zoom` preserves native vertical gestures and zoom.
- One loaded, sufficiently visible logo demonstrates a 1.4-second turn, at most once in the tab session. Intersection observation excludes the fixed-navigation margins. Pointer, focus, keyboard or wheel interaction stops/skips the demo. Session storage is guarded; if storage is blocked, in-memory suppression still works during the current page session. No continuous automatic rotation.
- Missing and failed logos remain static. Reduced-motion preference disables demonstration, drag rotation and motion hints, including when the preference changes while a spin is running. RAF, observer and preference listeners are cleaned up on unmount.
- Two concise gesture hints are translated in de/en/es/it/cs/hu. CSS selects the touch or fine-pointer wording; company/member-written names remain unchanged.

## Changed files

- `app/page.tsx`: wire only the existing company grid into the new component.
- `components/HomeCompanyPartners.tsx` and `.module.css`: scoped interaction and 3D presentation.
- `lib/company-logo-motion.ts` and `.test.mjs`: gesture/animation/click policy and regression checks.
- `lib/homepage-avatar.test.mjs`: update its existing homepage component fixture.
- Six existing message catalogs: gesture hints only.

## Verification

Local browser fixture used the actual new component, `CompanyLogo`, `MediaImage`, Next 16.4.3 router and next-intl. Companies and non-CineGenius logos were fictitious local test data; no production content was edited. The fixture and its diagnostic controls live outside the repository.

Actually observed in the browser:

- First reveal starts exactly one visible Alpha logo; it returns frontal. Back navigation, reload and subsequent scrolling in that session do not start another demo.
- A fresh-session demo stops immediately on a deliberate vertical pointer gesture: diagnostic changed from one active animation to zero, all transforms cleared, URL unchanged.
- Horizontal drags in both directions spin only the chosen logo. Two logos ran independently at the same time; the remaining rotors and metadata positions stayed unchanged. Rear-side Beta wordmark remained readable in the captured rotating view.
- Normal click opens the exact Alpha company route. Enter opens the exact Beta company route. No navigation occurs after the final horizontal or vertical drag.
- Reduced-motion preference was simulated at the browser API boundary by an explicit local fixture control: hint hidden, all transforms clear, drag produces no rotation, and keyboard navigation remains functional. This was not an OS setting change or real-device test.
- 1280 px desktop and 390 px phone-width views checked. Phone-width drag and vertical wheel/scroll remained usable; document scroll width equaled client width (385 px excluding the scrollbar). All six locale hints rendered in that narrow view without horizontal overflow. Fine-pointer wording is expected in this desktop-hosted viewport simulation; real coarse-pointer devices select the touch wording.
- Missing and intentionally broken test logos displayed the existing static placeholder; the broken-file fixture intentionally requests a missing local SVG.

Automated checks: seven new motion tests, three existing homepage integration tests; full suite 821 tests passed. Production build, TypeScript, scoped ESLint, six-catalog i18n validation and shared design checks passed. Browser screenshots are in the task visualization folder.

## Limitations / release state

No physical iPhone/Safari or Android/Chrome touch test was available. Touch direction thresholds and native-scroll CSS policy were tested; the viewport simulation uses mouse input and does not prove a real touch fling or pinch gesture. This change is local and has not been deployed. No dependency or database migration is required.
