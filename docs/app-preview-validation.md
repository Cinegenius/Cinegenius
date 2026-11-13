# CineGenius mobile preview — validation, 13 November 2026

This increment starts a development preview, adds the shared KI destination,
replaces the homepage rail arrows with position dots, and applies the approved
full-page directory image. It does not publish the website or an app-store build.
The confirmed future media, story, scanner and solar-planning requirements are in
[app-product-flows.md](app-product-flows.md); those new functions are not implemented
by this preview.

## Server checks

- Full production-mode Next build and TypeScript check passed with a 4 GB Node
  heap. Localization check passed for all nine catalogs (7,454 keys).
- 99 focused homepage/backdrop/navigation/Genie/access tests passed. The 76
  Locations and Projects heading tests passed after their fixtures were updated
  to render the real new directory wrapper. Other unchanged directory assertions
  passed in the broader directory run. Shared design checks passed.
- Changed UI lint: no new errors. Eight existing warnings remain in the checked
  files. The existing `Date.now()` purity finding in the News server page also
  remains; this change only wraps its existing content and replaces its backdrop.
- The new mobile package's three origin/configuration tests passed.
- Android Debug build and APK signature verification passed. Release task guard
  rejected a release build as intended. No Android runtime/device test is claimed.

## Browser checks

The production-mode preview listens only on `127.0.0.1:3012`. Isolated, signed-out
Playwright contexts route the CineGenius host's GET/HEAD requests to that private
preview so the existing production Clerk public key can initialize on its configured
origin. No DNS, Clerk configuration or production website was changed. The contexts
have no account session; write requests to CineGenius are blocked. No form was
submitted, email sent or AI generation requested.

- Chromium: KI page, exactly five bottom links with KI in the middle, 44 px touch
  targets, no horizontal overflow at 320/390/768/1366 px, localized guest Genie
  dialog, Escape/focus return and unique menu links with News reachable — all nine
  languages passed.
- Chromium: Crew, marketplace, News, Locations, companies, Projects and all-projects
  views passed at 320/768/1366 px. The main image loads, remains fixed on scroll,
  uses the expected left-to-right crop and the homepage's 72% overlay. Cards and
  filters keep their own surfaces. Mobile screenshots were visually inspected.
- Real homepage rails: bounded centered dots, 44 px targets, click, keyboard,
  scroll-position tracking and end-of-rail active indication passed. Homepage
  background source/position is unchanged by this patch.
- WebKit: KI guest dialog/close, all six directory backgrounds at
  320/768/1366 px and homepage dot navigation passed. Chromium touch emulation
  also moved the real homepage rail by swiping. These are browser simulations.
- Browser Back from Projects returns to KI; direct signed-out `/dashboard` visit
  redirects to the same host's sign-in form.
- The local connection-error page passed in Chromium, Firefox and WebKit across
  all nine locales at 320 px (27 cases): correct text, no overflow, touch targets,
  one language bundle, saved-language precedence and explicit retry. Retry used a
  controlled response fixture; this is not an authenticated native offline test.

Background prefetch requests can be canceled when these browser contexts navigate
or close. The proxy harness handles that lifecycle separately from the assertions.
WebKit on this Linux host lacks working direct HTTPS support. For its rendering
checks, public HTTPS GET/HEAD responses were forwarded through Playwright's
certificate-validating request transport. This is a rendering/input check, not
verification of the Linux WebKit network stack or native iOS authentication.
WebKit also cannot fulfill redirected prefetch responses through this harness;
no successful protected-route test is claimed from that browser run.

## Native iOS checks

Xcode 27.2 built the Debug app successfully and launched it on the iPhone 17 /
iOS 26.5 simulator. The generated SceneDelegate now selects the custom controller.
A reproducible cold-launch status-bar overlap was fixed by placing the WKWebView
inside a native safe-area container. The Mac-built Swift source and public
before/after images were transferred with SHA-256 verification.

The real public homepage, Locations, marketplace and menu loaded. Empty email and
password fields were focused and the software keyboard shown without submitting
anything. The iOS preview currently loads the published website, so these native
checks do **not** claim to test the new un-published KI/dot/background changes.

The iPad A16 / iPadOS 26.5 simulator also built and launched successfully;
portrait and landscape homepage views kept the header below the status bar.
After an incremental device switch, the local Debug bundle needed ad hoc signing
again; both the local and installed copies then passed strict signature checks.
Native Back was not conclusively demonstrated through remote gestures, and no
native offline fixture was executed. These remain open checks. Physical devices,
account login/logout/MFA, private uploads, account switching and native scanner
measurements are not verified here. See `mac-review/MAC-REVIEW-final.md`.

Detailed logs and public screenshots are retained on the server under
`/srv/cinegenius/handoffs/app-preview-20261113/`, including `checks/` and `mac-review/`.

## Release integration

On the user’s explicit publication request, the approved UI changes were merged
with current `origin/main` (`7bc244d`). The existing project list layout, public
project query, map controls, geographic sorting, Genie branding/welcome, and all
newer catalogs were retained. Only the shared directory background and KI entry
are applied to those newer views. The optional auth draft in the original server
checkout remains separate. The integration suite validated 292 selected cases after refreshing the
marketplace fixture for the already existing geography dependencies; five
geographic-order cases also passed. All nine catalogs now have 7,780 keys.
Release validation and the guarded deployment receipt
are stored under the same handoff directory’s `release/` folder.
