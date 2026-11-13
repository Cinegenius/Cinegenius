# CineGenius mobile preview

First development increment, 13 November 2026. This is an isolated Capacitor 8.6.2
package with real iOS and Android projects. It loads the existing CineGenius site,
including its server-rendered routes, shared design, nine languages and Clerk
account flows. There is no second backend or duplicated product UI.

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
- No wildcard navigation, native HTTP/cookie overrides, extra plugins, new service
  credentials, permissions for sensors, background upload or public media caches.
  External top-level links use Capacitor's system-browser behavior. Cross-domain
  auth handoffs, MFA and return links still require dedicated signed-in testing.
- Native files are versioned; generated web assets/config, dependencies, signing
  keys, build products and SDK paths are ignored. The wrapper JAR is build tooling.
- New social/media requirements are recorded in
  [`docs/app-product-flows.md`](../docs/app-product-flows.md); they are not yet
  implemented by this first preview.

## Why this is explicitly a preview

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

`npm test` exercises origin restrictions and unchanged cookie/HTTP behavior.
From the repository root, run `npm run check:i18n` for all nine catalogs.
Browser rendering checks are separate from iOS simulator and Android build checks;
none of those alone establishes physical-device or authenticated-flow compatibility.

## Scope of this app task

After the explicitly requested current website release, this chat works on the
app only. Future app changes reach the public website only after a new explicit
request from Markus. Keep app development and website publication separate;
see [the recorded decision](../docs/app-product-flows.md#arbeitsbereich-dieses-app-chats).
