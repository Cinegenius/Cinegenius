# CineGenius mobile preview

Development preview started 13 November 2026. This is an isolated Capacitor 8.6.2
package with real iOS and Android projects. It loads the existing CineGenius site,
including its server-rendered routes, shared design, nine languages and Clerk
account flows. There is no second backend or duplicated product UI.

Markus reaffirmed on 14 November 2026 that web and native features are developed
in all nine existing languages from the start: de, en, es, it, cs, hu, nl, nl-BE
and sv. This includes guidance, validation, errors and safety/moderation prompts.
Use the existing catalogs and native resource generator in the same change;
preserve the manual language choice and leave member-written content and names
unchanged. Catalog completeness alone does not verify the translated device UI.

## Run

Requires Node 24+, Xcode on macOS for iOS, and Java 21 / Android SDK 36 for Android.
Run from this directory:

```sh
npm ci
npm run prepare:preview
npm run sync
npm run open:ios
# or: npm run open:android
```

The default origin is `https://www.cinegenius.co/`. This uses the existing live
site: actions after signing in would affect real accounts and content. Initial
checks must remain signed out and must not submit registration, messages or posts.
No website deployment is required to run this preview.

For a local web server, prepare an explicit origin and sync again:

```sh
npm run prepare:preview -- --url http://localhost:3010
npm run sync
```

An iOS simulator uses its Mac's localhost. The server's private preview therefore
requires an already configured SSH forwarding connection; do not expose it on the
public network. Android Emulator's equivalent host is `http://10.0.2.2:3010`.
These development origins are the only HTTP exceptions. Do not put credentials,
tokens, private routes or arbitrary hosts into the configuration.

Android debug build (with Java/SDK configured):

```sh
cd android
./gradlew --no-daemon --max-workers=2 -Dorg.gradle.jvmargs=-Xmx1536m assembleDebug
```

On cinegenius-server, prefix that Gradle command with `cinegenius-app-tools`.
On the Mac, retain the existing GitHub Desktop source-control workflow. The
canonical app source is the server branch; build copies are not replacement sources.

## Behavior and boundaries

- Separate identity `co.cinegenius.app.preview`, display name CineGenius Preview.
- iOS places the WebView inside the native safe area with layout constraints,
  avoiding a status-bar overlap on cold launch without hard-coded offsets or
  doubled scroll insets. Rotation follows the same constraints.
- iOS native Back/Forward gestures and Android real-history Back; no sentinel
  entries, fake history or additional product navigation bars.
- Local connection-failure page with an explicit retry to the configured home
  origin. Retrying replaces that page. It does not promise recovery of unsaved
  input or unfinished uploads. Existing server-confirmed private recovery remains
  the web application's responsibility.
- Offline copy comes from `MobilePreview` in the existing nine message catalogs;
  the existing shared locale resolver is compiled for the local page. Only the
  selected local translation file loads. Native hosts forward the site's public
  `cg_locale` preference to the error page; session cookies are never forwarded.
- No wildcard navigation, native HTTP/cookie overrides, new service credentials,
  background upload or public media caches. The iOS workplace uses Apple's native
  RoomPlan, camera permission and device-owner authentication as described below.
  External top-level links use Capacitor's system-browser behavior. Cross-domain
  auth handoffs, MFA and return links still require dedicated signed-in testing.
- Native files are versioned; generated web assets/config, dependencies, signing
  keys, build products and SDK paths are ignored. The wrapper JAR is build tooling.
- New social/media requirements are recorded in
  [`docs/app-product-flows.md`](../docs/app-product-flows.md); they are not yet
  implemented by this first preview.

## Native workplace and floor plans

The iOS-only **Arbeitsplatz → Locations → Grundrisse** area adds a new RoomPlan
scanner for supported LiDAR devices, including the intended iPhone 15 Pro. Select
the **CineGenius Arbeitsplatz** Xcode scheme to open it directly, or use the app
icon's quick action. The bundled app-only menu adapter also opens it from the
existing tools row in the public menu. The five bottom links remain unchanged.
The adapter recognizes the current Work label and the previous KI/AI labels
for compatibility with older documents. Historical label
tokens are used only for recognition; all displayed native text continues to
come from `NativeRoomScanner`. Other disabled menu items stay unchanged.

Plans stay in protected local storage, independent of the CineGenius account and
excluded from backups. Opening the private library requires device-owner
authentication. Sharing PDF/available USDZ files and deleting plans are explicit
actions. Example plans are labelled throughout and do not establish real scan
accuracy. All UI and permission text is generated from the existing nine message
catalogs by `prepare:preview`; run `sync` after changes.

See [the scanner's design and test boundaries](../docs/native-workplace-room-scanner.md).
Native core tests run on macOS with:

```sh
swift test --package-path ios/RoomScannerCore
```

For a free direct iPhone test, use the existing Apple Account's Personal Team in
Xcode, connect and trust the device, and enable Developer Mode when requested.
TestFlight requires paid Apple Developer Program membership and a reviewed
release architecture; the current non-Debug build guard remains in place.

## Why this is explicitly a preview

The iOS web viewport uses the whole window. The bundled `app-viewport.js` adapter
applies `app-viewport.css` only to the configured main-frame origin, in WebKit's
isolated client world. It keeps the public header, content, menus and controls
clear of the device's safe areas, while backgrounds reach the screen edges.
The shared bottom bar and public menu already handle their own insets; do not
add a second native inset. `prepare:preview` generates this resource and `sync`
copies it into Xcode. Without the bundled adapter the native container falls
back to its previous safe-area bounds. No published web source is modified.

The header adapter follows the shared 4rem/6rem header rules. Review it whenever
the shared header layout changes. Its browser layout checks use modeled safe
areas; an Xcode build and real WebKit/keyboard/rotation check remain necessary.
The sign-in start path and persistent WebKit session store are retained.

The shared `app-presentation.css` hides only the website's
`data-home-app-notice` inside the installed preview. iOS includes it in the
viewport adapter; Android installs the same presentation script before the
first document via AndroidX WebKit. Older WebView providers use guarded
page-commit/load callbacks. Ordinary website visits retain the announcement.

Both native shells send the existing `cinegenius:app-resume` browser event only
after a genuine background-to-foreground cycle. iOS uses the scene callbacks;
Android uses stop/resume and ignores configuration replacement. Initial launch,
internal navigation and brief inactive/paused interruptions do not send it.
The bundled `app-resume.js` rechecks the exact main-frame origin and carries no
payload. Genie restores its launcher using its existing visit-only state;
no new persistence, API request or analytics is added by the native bridge.
Verify these lifecycle transitions on real iPhone/iPad/Android devices before
claiming native coverage. Browser event injection is only an integration check.

The current Next application needs server cookies, Proxy, dynamic routes and APIs.
It cannot simply be statically exported into an app without replacing those flows.
Capacitor documents `server.url` as a **development** facility, not a production
distribution configuration. Therefore iOS non-Debug and Android Release builds
are deliberately blocked. This increment establishes a reproducible test harness
for the real UI; it is not an App Store/TestFlight release or the final packaging
architecture. Choose and verify that architecture before removing either guard.

Before distribution: real account login/logout/MFA, session/account switching,
keyboard and safe-area behavior, interrupted forms/uploads, external-link return,
private media revocation, real devices, Android runtime checks, accessibility,
native permissions, deep links and store requirements still need verification.
Use the working iOS 26.5 simulator environment for initial runs; unrelated iOS
27.2 simulator problems are recorded in the Mac setup report.

References:
- [Capacitor configuration](https://capacitorjs.com/docs/config)
- Next's installed `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- [App flows and privacy](../docs/app-product-flows.md)

## Checks

### Regional news and language preferences

The remote homepage and News directory use the shared `lib/news-region*` logic.
An explicit News URL country wins, followed by the current guest/account's
manual country cookie. Automatic uses the current profile country, then the
coarse request country, otherwise all countries. Keep those preferences in the
existing web cookie store; do not mirror them into a device-wide native setting
or request GPS permission. Country filtering does not translate original posts.

UI language remains `cg_locale`, then a supported browser/device language, then
the request-country fallback where unambiguous. `prepare:preview` packages the
same locale resolver for offline rendering. Offline has no request geography;
it keeps the manual/browser priorities without guessing a country. The existing
workplace menu passes the rendered document language to the native screen.
No news-country or account information is sent through the native message bridge.

Regenerate local resources and sync after merging the shared resolver. Preserve
newer Mac-only native source and `NativeRoomScanner` keys when reconciling catalogs.
WEB CODEX published regional-news commit `a36bc59` (including Work and the Genie
controls/app announcement) on 14 November 2026 after Markus's explicit release
request. The default remote app preview now loads that website version. The
app-only presentation and resume scripts still require an updated native bundle;
a website release does not install them on an existing iPhone. Browser checks
with these scripts do not prove WKWebView persistence, native lifecycle or device
Back. Release evidence: `/srv/cinegenius/audits/20261114-regional-news/release.md`.

`npm test` exercises origin restrictions and unchanged cookie/HTTP behavior.
From the repository root, run `npm run check:i18n` for all nine catalogs.
Browser rendering checks are separate from iOS simulator and Android build checks;
none of those alone establishes physical-device or authenticated-flow compatibility.

## Scope of this app task

After the explicitly requested current website release, this chat works on the
app only. Future app changes reach the public website only after a new explicit
request from Markus. Keep app development and website publication separate;
see [the recorded decision](../docs/app-product-flows.md#arbeitsbereich-dieses-app-chats).

## Current app-only extension (14 November 2026)

The new draft starts at `/sign-in`, restores valid WebKit sessions and binds
workplace rooms to existing locations owned by the signed-in account. The native
editor adds two-finger pan/pinch, an object/utility catalog, dimensions, notes,
undo/redo and PDF annotations. The original scan remains unchanged.
The earlier account-independent archive description applies to v1 only; those
files remain untouched. See `../docs/native-workplace-room-scanner.md` for current
behavior and the current Mac build/device evidence. The earlier
`../docs/test-reports/native-floorplan-editor-2026-11-14.md` records server checks
before that update. A normal iPhone restart and reuse of an existing session are
verified; fresh sign-in, full-screen web layout and editor gestures still need
separate device checks. Never uninstall the current app to sync.

## Native Genie voice bridge

`../docs/native-voice-bridge.md` defines the shared `CineGeniusVoice` v1 contract.
The native shells use OS speech recognition and device speech synthesis. They
return text to the existing Genie UI; no AI key, project data or raw audio file
crosses this bridge. WEB owns sending/search navigation and explicit action
confirmation. Native audio stops after 30 seconds or on cancellation, navigation,
backgrounding or interruption. Recognition may use the operating system's speech
service when device recognition is unavailable; the web UI must disclose this.

Run `npm test` for adapter/lifecycle/packaging tests. `tests/voice.browser.mjs`
checks trusted browser input with mocked native transports, not a microphone;
provide Playwright via `CINEGENIUS_PLAYWRIGHT_PATH` if it is installed externally.
Android checks: `./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug`.
iOS still requires Xcode compilation and actual device speech/permission tests.
Regenerate resources and sync on the Mac after carefully merging its newer
Recce/workplace files and native catalog keys. Never overwrite or uninstall the
existing app or saved plans. This bridge does not implement shared project-plan
synchronization, nor does its server validation prove iPhone login or full-screen
rendering. No website release is part of this change.

The app development branch also includes reviewed WEB commit `26b47a2` and the
integration correction that starts spoken search replies after result navigation.
This website feature is still unpublished: the default remote preview URL does
not yet display its new voice controls. Use an explicitly configured private
preview to test the combined source; generating a native bundle is not a website
release. Newer Mac Recce/workplace changes and native translations still need a
targeted merge. Handoff: `/srv/cinegenius/handoffs/20261114-app-web-voice/`.
