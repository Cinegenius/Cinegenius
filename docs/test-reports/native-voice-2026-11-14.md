# Native Genie speech bridge — 14 November 2026

App branch `codex/cinegenius-mobile`, based on `8918456` with published web
baseline `a36bc59`. This change adds native OS speech recognition and system
speech synthesis, with the shared contract in `docs/native-voice-bridge.md`.
The website composer, authenticated Genie endpoints and confirmed actions remain
owned by WEB CODEX. No website release, real project edits, paid API calls or
physical-device installation took place in this change.

## Completed server checks

- `cd mobile && npm test`: 36 tests passed. Includes trusted origin/main-frame
  boundaries, gesture requirement, final versus partial results, stale document
  and request replies, cancellation on background/navigation, detached transports,
  timeouts, malformed messages, bounded speech, all nine locales, permission
  resource generation and the unchanged sign-in start path.
- `mobile/tests/voice.browser.mjs`: eight Chromium interaction checks passed
  with mocked iOS/Android message transports and actual browser clicks. Automatic
  capture was rejected; explicit capture, final response, cancellation and route
  changes worked. This fixture makes no backend or audio-service requests.
- Android `:app:testDebugUnitTest :app:assembleDebug :app:lintDebug`: passed,
  including eight Java tests (five speech command tests and three origin tests).
  Lint reports zero errors and 26 remaining warnings in existing shell resources,
  dependency metadata and the existing presentation feature check; none is in
  the new NativeVoice source. Debug APK built, not installed on a device.
- `npm run check:i18n`: nine catalogs, 7,982 keys, zero new source literals for
  review. Both iOS permission descriptions are present in all nine generated
  resources; the English fallback matches the shared catalog.
- `git diff --check` passed; Info.plist parsed successfully. The new Swift source
  is registered in the Xcode project; source review is not Swift compilation.

## Required native and integrated checks

Xcode/Apple SDKs are unavailable on this Linux host. Merge the targeted patch into
the Mac's newer Recce/workplace source without overwriting its changes or saved
plans, regenerate resources, then build with Xcode. Test on the actual iPhone:
first permission grant, denial, cancelled permission prompt, microphone stop,
30-second cap, text accuracy, interruption by phone/audio routes, app background,
navigation, Genie close, account/language switch and local spoken replies.
Repeat the relevant checks on Android. Speech services and installed voices may
not support every catalog language or offline operation; show an honest error.

WEB must verify the contract with its final composer: existing unsent draft is
preserved, explicit finish/send behavior works, no native-denial fallback starts
another recorder, and account/language cancellation rejects late results. Shared
project schedule changes remain unimplemented pending an authorized server model.

The earlier full-screen app correction and persistent sign-in configuration are
preserved. Historical modeled browser inset checks are in
`/srv/cinegenius/handoffs/20261114-app-web-viewport/`. Fresh iPhone sign-in and the
reported margins on normal CineGenius pages still require the updated native
bundle and real device verification; none of these speech tests establishes that.

Current handoff and Android log:
`/srv/cinegenius/handoffs/20261114-native-voice/`.
