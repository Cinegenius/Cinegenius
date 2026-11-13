# Complete header wordmark — 13 November 2026

The operator rejected hiding the CineGenius wordmark on narrow signed-in headers. This follow-up completely removes the mark-only Logo prop and its responsive hiding rule from the preceding 27e03d1 release. The complete CineGenius text remains beside the chevron in every viewport and session state.

Only necessary spacing changes were made below 480 CSS px: existing 8 px header gutters, zero group gaps and reduced language-button inner spacing. Existing logo typography and chevron sizes are retained. Globe, flag, portrait, account menu, existing visible controls and 44×44 CSS px touch areas remain. Desktop geometry and all account/photo/privacy behavior are unchanged. The permanent wordmark requirement is recorded in AGENTS.md and the shared design rules.

## Verification

- 173/173 focused tests passed: navbar actions, admin navigation, authentication prefetch, site navigation, avatar persistence, registration/wordmark contract, localization, language switching and inbox locale handling.
- TypeScript, scoped ESLint for Navbar/Logo/LanguageSwitcher, shared design checks, translation checks (nine catalogs, 7,442 keys) and whitespace checks passed. No unnecessary full-suite rerun was performed for this spacing-only correction.
- Native Safari ran an enhanced actual-component fixture matrix: 320/360/390/480/768/1280/1440 requested iframe widths × nine locales × guest/own account without photo/own account with synthetic saved photo. **189/189 passed, zero reported findings.**
- Wordmark checks use actual rendered Cine/Genius text nodes, Range rectangles, ancestor visibility/opacity/clipping and link/viewport bounds. An aria-label alone cannot pass. The matrix additionally checks overflow, target collisions, visible header targets of at least 44×44 CSS px and loaded photos. The fixture reports client width separately because Safari scrollbars may consume 5 px.
- Selected visual inspection confirmed complete wordmark and portrait at 320 px German, 360 px Swedish and 390 px German. At 390 px the existing notification control, globe and flag were visible alongside the portrait; clicking the portrait opened the shared account menu without covering the header wordmark.

## Scope and limits

The fixture uses real components, CSS, catalogs and MediaImage with an isolated Next/Image adapter, fictitious identities and local portraits; external connections and writes are blocked. These are browser viewport tests, not physical phone, VoiceOver or native WebView certification. Production wordmark/photo visibility and deployment identity are checked after release and recorded in the external release manifest. No profile data, authentication settings, navigation destinations, cards or database schema were changed.
