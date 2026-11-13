# Genie visibility and brief signed-in welcome — 13 November 2026

## Scope and authorization

The operator explicitly requested a more recognizable AI assistant and a brief
welcome after sign-in, then approved the handoff to Codex2 with “Ja, prüfen und
veröffentlichen”. Base: `b73187e600278cc313550ddfcb9935f26ef874b1`.
The 15-file handoff patch and every base/result SHA-256 were checked before
application. Thirteen files remain identical to that handoff; only the new
welcome component and its tests received the two review fixes below.

The existing launcher gains a restrained brand accent and a localized AI label.
The welcome waits 1.5 seconds after an eligible loaded session and a closed
cookie notice, lasts 8 seconds, pauses while hovered/focused and is deduplicated
per session/tab. Explicit dismissal returns focus; timeout does not move focus.
It neither opens the chat nor sends an AI request. The existing lazy chat and
location-map icon mode remain. All nine catalogs include the new labels.

Header, complete wordmark, profile photo, public/account navigation, backend,
authentication rules and database are unchanged. The daily checker stays paused.

## Review fixes

- Native open dialogs and editable elements, including inherited/plaintext-only
  editors, prevent or dismiss a welcome without inspecting entered values.
- An interrupted welcome is discarded when the launcher is unavailable; quickly
  closing a message chat cannot revive the same announcement.

## Local verification

- 96 targeted tests passed: Genie client, viewport/interactions, welcome lifecycle,
  conversation/writing client, application chrome and analytics consent.
- TypeScript noEmit, scoped ESLint, design check and diff check passed.
- Localization check: 9 catalogs, 7,444 keys, no new unreviewed source literals.
- No changed backend, proxy, header, logo or language-switcher files versus base.

## Safari verification

The isolated fixture imports the actual Genie, welcome, lazy panel, header,
MediaImage, bottom navigation, CSS and catalogs. Identity/service adapters use
synthetic local data. External connections are blocked and no real account,
message, database or AI-provider writes occur.

The first 131-case run passed 130 cases. Its sole failure was a fixture bridge
that did not dispatch updated message-chat state. After fixing that fixture-only
bridge, four targeted cases passed: suppress/re-enable, session change, and
320/390px layouts with a simulated 34px bottom safe area. Product code was not
changed for the harness issue.

Coverage includes guest/signed-in rendering in all nine languages at
320/390/768/1024/1280/1440 CSS px; cookie/loading/input/editor/native-dialog and
hidden-tab priority; blocked storage; route and session changes; real 1.5s/8s
timers; map icon mode; and doubled Genie text in all nine languages. Measured
checks found no clipped targets, horizontal overflow or sub-44px controls.
The full wordmark and synthetic profile photo remained visible.

Native Safari interaction and visual review at 320px with 34px simulated safe
area confirmed readable welcome/AI label, a 12px welcome-to-launcher gap and an
8px launcher-to-bottom-navigation gap (99px navigation). Focusing the welcome
paused its timeout. Escape closed it and returned focus to the launcher; an
explicit click opened the real panel, and Escape closed that panel with focus
return. The request counter remained zero throughout, including chat opening.

These are browser-width, text-size and safe-area simulations, not physical
iPhone/Android or native-app tests. Clerk session changes and unavailable
storage are simulated locally; no real account was signed out or reset.

## Release procedure and live evidence

Commit/push through GitHub Desktop, verify clean main equals origin/main, then
publish only through `npm run deploy:production`. The production build and actual
live check follow this pre-release report; their deployment/commit evidence is
recorded separately on the release host. Static resource presence alone must not
be represented as proof of signed-in welcome behavior.
