# Header account photos — 13 November 2026

The operator explicitly requested the round account photo on phones, tablets and desktop, superseding the earlier icon-only header rule. WEB CODEX prepared a seven-file patch against 136e5f6; its SHA256 was verified as 2a70c2d6159a1859c00c82b32db3d09525ad4f64ecf92d17a7e0320413551955 before applying only that patch. Other server drafts were excluded.

## Behavior

- Read the active account's saved CineGenius photo through the existing permission-checked profile endpoint with no-store and a bounded, abortable request. Render with MediaImage, no shared optimizer and no referrer. No profile, upload, auth-provider or database schema changes.
- Discard foreign-account responses/events and stale requests. Gate identity text as well as images to matching authentication/user identities. Close and scope the dropdown on account/session changes. An explicit missing/removed saved photo shows the stable account icon; an existing own Clerk image can be a temporary fallback before a profile response.
- Both portrait buttons open the same account dropdown. The dropdown remains scrollable; it uses one readable column below 480 CSS px and two above. Existing destinations, sign-out draft protection, message/notification badges, larger desktop navigation and the five mobile destinations remain intact.
- Signed-in headers below 480 CSS px use the existing brand mark without the wordmark so all controls retain their touch areas. Guest sign-in/registration entry points remain visible.

## Checks

- Final full regression: 3,112/3,112 passed. An earlier run exposed an obsolete test forbidding header photos; its contract was updated to the operator's new account-bound photo requirement. No production protections were relaxed to satisfy it.
- 151 focused authentication/navigation/avatar/media tests passed after the privacy corrections. A further 18 navbar/registration tests and scoped ESLint passed after the menu-column layout adjustment.
- TypeScript, shared design checks, nine-catalog localization checks (7,442 keys) and git diff --check passed.
- Native Safari ran a local, actual-component matrix across 320, 360, 390, 480, 768, 1280 and 1440 CSS px, all nine locales and guest/own-account-without-photo/own-account-with-photo: **189/189 passed**, zero reported header overflow, target overlap or visible header targets below 44×44 CSS px. Synthetic photos loaded in photo cases. The final later menu-column adjustment does not alter header geometry; its mobile menu was separately inspected.
- Selected native Safari inspection: German 390 CSS px photo and opened one-column account menu; a menu destination opened and dismissed the dropdown; Swedish 1440 CSS px photo/navigation; Flemish 320 CSS px image failure correctly showing the icon. All selected measured states had zero header overflow/target overlap/undersized targets.
- Fixtures use real Navbar, Logo, MediaImage, styles and catalogs with a Next/Image adapter, fictitious accounts and locally authored portraits. External connections and writes were blocked. Unit interaction tests cover image removal/error/replacement, wrong-account events, late responses, auth/user mismatch, account/session transitions, menu dismissal and Escape focus.

## Limits

Browser width simulations do not establish physical iOS/Android, software-keyboard, VoiceOver or native WebView behavior. No real profile edits or account switches were performed. Actual signed-in production photo appearance is checked separately after deployment where the existing authorized session permits; deployment identity and live findings belong to the external release manifest.
