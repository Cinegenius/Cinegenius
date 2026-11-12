# Header and mobile navigation, 12 November 2026

## Result

The desktop header uses Crew, Locations, Marketplace, Jobs, Companies, News and
More, in that order. A separate 44px message action shows the current account's
unread chat count. The account menu owns personal destinations; all twelve
existing account links, the public profile and authorized admin link remain
reachable. Desktop More contains the remaining public destinations and help,
without repeating the six direct directory links or personal account section.

The user's subsequent mobile correction supersedes the earlier seven-link bar:
its five remaining destinations are Crew, Marketplace, News, Locations and
Companies. Messages is now a direct action in the compact header. Personal
navigation remains available through that header's menu. At very narrow widths
the notification bell is available through the menu; from 360px it is also shown
in the header. Search remains available in the compact menu. Existing direct
sign-in and registration links remain outside the collapsed menu.

The notification bell now opts out of chat summaries, chat notification rows and
chat unread totals. Its mark-all action acknowledges only the displayed unread
notification IDs, preserving chat notifications and actual message read receipts.
The component's default behavior remains compatible for other consumers. The
bottom bar no longer subscribes to an unused unread-count store.

## Design and behavior

- Existing colors, fonts, logo, imagery and card styles are reused.
- Desktop navigation begins at 1280px; narrower layouts use the compact header.
- Small header actions and desktop links have at least 44px targets. The logo
  target is now 44px high. Long labels retain their localized names.
- Search occupies the same compact slot across homepage and directory routes.
- The account menu is bounded by viewport height and can scroll. Desktop More
  fits its shorter contents; the compact sheet retains its scrollable layout.
- Real route changes, menu focus restoration, private-form guards, sign-out
  behavior and server-checked account/admin access remain in place.
- No new placeholder AI destination, database migration or user-content change.

## Executed verification

- Full regression suite after the structural changes: 3,071/3,071 passed.
- Focused navigation, header actions, notification separation, auth entry and
  admin-menu tests: 119/119 passed, including all nine supported catalogs.
- TypeScript, scoped ESLint, design checks and translation checks passed
  (9 catalogs, 7,440 keys, no unreviewed source literals).
- Native Safari review used the actual product components, catalogs, design CSS
  and local fonts inside an isolated local iframe. External requests and form
  submissions were blocked; account and unread data were simulated.
- Reviewed German at 320px signed in, Swedish at 390px signed in with simulated
  24px bottom padding, German at 1366px signed in, Swedish at laptop width signed
  out and Hungarian at 320px signed out. The Hungarian check exposed a clipped
  menu button; reduced narrow-screen gutters/gaps corrected it, and the same
  view was rechecked with no reported header overflow. All five bottom labels
  were visible in the Swedish review.
- Opened the desktop account menu and compact personal menu, inspected More's
  remaining destinations, and verified Escape restored focus from More. Browser
  width simulations and simulated padding are not a physical phone, mobile
  software-keyboard or native-app test. Cross-locale rendering tests supplement
  these selected visual reviews; no claim is made of nine physical-device runs.

Production publication and post-release checks are recorded in the private
release manifest after the clean GitHub Desktop commit and guarded deployment.
