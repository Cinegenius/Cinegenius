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

## Follow-up: direct swipe tracking and proportional momentum

The initial version above was released as `5aced9132233a72a385e8eac55735fcfd73ae515`. A subsequent user request asked for more immediate movement during finger contact and continuously variable speed. This follow-up is local, not yet deployed.

- Horizontal intent now starts at 6 px for touch/pen and 4 px for mouse; ordinary small tap jitter remains pending and vertical/diagonal intent retains scrolling.
- The rotor follows the current horizontal displacement directly, including reversals, at one turn per rendered logo width. The old fixed 0.9 degrees per pixel is removed.
- Release speed uses time-based smoothing, independent of pointer-event frequency. Momentum and easing duration derive from actual angular velocity rather than two fixed turn counts. Slow gestures settle gently; faster gestures coast faster/further. Speed and duration remain bounded (maximum 2.4 seconds), ending frontally. Both faces and stationary metadata are unchanged.
- Changed implementation: `components/HomeCompanyPartners.tsx`, `lib/company-logo-motion.ts`; regression coverage: `lib/company-logo-motion.test.mjs`.

Passed: 13 targeted motion/homepage tests, production build including types and six-language i18n validation, scoped ESLint and diff whitespace validation. The touch-handler integration test invokes the actual component handlers with simulated touch pointer events: the rotor changes before pointer-up, reverses immediately and only schedules coasting after release. Slow/medium/fast release momentum and different event frequencies are covered.

Browser verification used the actual component with fictitious local companies: positive and negative drags ran independently at 1280 px and 390 px; metadata remained stationary; all rotors settled frontally; no drag opened a link; ordinary click opened the exact company route; simulated reduced-motion preference disabled rotation/hints; vertical dragging and scrolling retained the page; document width equaled client width. No unexpected browser errors (the intentionally missing fixture image is a static placeholder). Screenshot: `home-company-logos-direct-swipe.png` in the task visualization folder.

The phone-width browser uses mouse input. There is still no physical iPhone/Android touch test, so real-device touch/pinch behavior is not claimed as verified. No product copy, database, media, permissions or other site surfaces were changed.

## Follow-up: actual touch capture cancellation shown in IMG_8154

The user's 10.8-second phone video shows horizontal finger swipes over several loaded logos with no sustained rotation. It exposed a touch-specific gap that mouse-only verification did not cover.

Touch has implicit capture on the initially hit child. The old `onLostPointerCapture` handler treated the bubbling event from that child during transfer to the logo as loss of the logo's own gesture, and reset both the angle and active gesture. This sequence follows [the Pointer Events capture rules](https://www.w3.org/TR/pointerevents/#implicit-pointer-capture). The regression test was first run against the released implementation: expected `rotateY(12deg)`, actual empty transform immediately after child capture loss. This is a demonstrated code defect consistent with the video; the phone itself was not instrumented.

Correction is limited to the homepage component and its CSS: the rotor's visual children no longer participate in hit testing, keeping the stable outer logo as the gesture target. Capture-loss cleanup only applies to a loss by that actual outer element and the matching active pointer ID. Genuine cancellation still resets cleanly; releasing a completed gesture does not cancel its momentum.

Verification: the 13 targeted motion/homepage tests pass, including child-to-logo capture transfer, unrelated pointer loss, actual own-capture loss, reversal and release momentum. Production build/type check, six-language validation and scoped lint pass. In the local browser fixture, an explicit test-only control captures the native active pointer on a child before production handlers transfer it to the logo. The browser emitted both real capture-loss events, while Alpha and Beta continued rotating in opposite directions; metadata stayed fixed, each settled frontally, ordinary click opened the correct company, vertical drag did not open a company and simulated reduced motion remained static. DOM hit testing returned the outer logo for all logo centres. No product test controls or data were added.

The captured browser sequence is faithful pointer-capture simulation with mouse hardware, not a physical iPhone test. A real iPhone recheck remains necessary before claiming that every touch-browser behaviour is verified. Evidence: `home-company-logo-touch-transfer-fixed.png` in the task visualization folder. No database or translation changes are required.
