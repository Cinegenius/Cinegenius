# Contact actions, 13 November 2026

Accepted contacts now have a direct message link to the existing recipient-aware
inbox. Removal is a small secondary link and opens a named confirmation using the
shared native dialog. Only explicit confirmation invokes the existing,
account-bound contact deletion. Requests and invitations retain their existing
actions.

The contact identity occupies a separate row on narrow screens; names and roles
wrap. All controls retain at least 44×44 CSS px touch areas. The seven new labels
and statuses are translated in all nine supported catalogs. No messaging API,
contact permissions, authentication, header, navigation, database, or publication
rules change.

## Verification

- The contact-card, dashboard-contact-controller, existing message-navigation and
  contact-connection API tests pass. They cover the selected recipient, no
  mutation before confirmation, cancel, duplicate submission, failure/retry,
  server acknowledgement, stale account responses and unmount handling.
- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` passes.
- `npm run check:i18n` passes: nine catalogs, 7,451 keys and no new source literals.
- `npm run check:design` and `git diff --check` pass.
- `ContactCard.tsx` passes ESLint with zero errors or warnings. The dashboard's
  existing 24 errors and six warnings have the same diagnostic signatures as
  the source at `9b2cdad`; this change does not clear that existing lint debt.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` passes, including the
  production TypeScript check and generation of all 155 static pages. An earlier
  non-interactive build was interrupted; the terminal-backed retry completed
  successfully.

Chromium 158.0.8127.18 runs locally on the server with the operator-approved
browser libraries. The browser fixture imports the actual contact card,
`MessagingDialog`, `MediaImage`, `BottomNav`, `Genie`, application styles and
language catalogs. Synthetic identities and contact callbacks replace live
accounts and mutations; navigation uses ordinary anchors with the actual target
URLs. No external requests or live contact changes occur.

All 45 combinations of nine locales and 320, 390, 768, 1280 and 1440 CSS px pass
the layout and confirmation checks. The browser also verifies named confirmation,
cancel, Escape, native modal focus isolation and focus return, retry after a
failed removal, double-tap protection, focus after success, recipient URL and
real browser Back without extra history entries, a simulated 34 px bottom safe
area, clearance from the real bottom navigation/Genie, and a short viewport.
No runtime console errors or unexpected requests were observed.

Browser checks and screenshots are saved privately on the server in
`/srv/cinegenius/handoffs/20261113-contacts-actions/`. The fixture builder can be
rerun from that directory, followed by its check script, using the browser
library paths recorded in
`/home/cinegenius/.local/share/cinegenius-browser/installation.json`.

These are browser simulations and isolated component checks. They do not claim
physical iPhone/Android or native-app testing, an authenticated production
end-to-end send/deletion, or a production release.
