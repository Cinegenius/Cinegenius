# Shared navigation and News, 12 November 2026

## Follow-up: direct Locations and Firmen links

The later user correction removes Mehr from the mobile bottom bar and appends
Locations and Firmen. The seven mobile destinations are Crew, Marktplatz,
Nachrichten, News, Mein Bereich, Locations, Firmen, consistently on public and
personal pages. The existing header and its menu remain available. Both surfaces
derive destinations from the same model, with separate active-state projection
for the new mobile links.

Touch targets retain a 44px minimum in each direction (seven adjacent targets
need 308px). Labels wrap within the existing 64px bar; language-aware hyphenation
preserves readable words. The account label wraps at its word boundary. Extreme
widths scroll inside the bar rather than shrinking targets or widening the page.
All nine catalog labels are reused. No migration or member-data change is needed.

Verification: TypeScript, scoped lint, design and translation checks passed;
131 affected navigation/header/message-shell tests passed. Safari at 320px with
the real shell and synthetic data showed all seven destinations, correct direct
Locations/Firmen navigation and retained header-menu open/Escape/focus behavior.
The original broader review below remains applicable; no new physical-device
or native-WebView check was performed.

## Result

The initial requested order was Crew, Marktplatz, Nachrichten, News, Mein Bereich,
Mehr. Desktop and mobile consume `lib/site-navigation.ts`; AppChrome mounts one
mobile bottom bar across public and personal areas. The account row is desktop
only. Locations, Jobs, Firmen, Projects and Organizations remain in the shared
Mehr menu, alongside existing account, help and support destinations.

News has a homepage discovery shortcut and a short localized section heading.
The Organizations subsection and destinations remain available. Existing colors,
cards, imagery and typography are preserved. Future AI tools can be grouped in
Mehr when implemented; no empty tools route or fictional scanner was added.

The native modal menu supports Escape, backdrop dismissal and scrollable content.
Opening it does not insert browser-history entries. Route/query changes, Back,
account changes and sign-out dismiss it. A synchronous pre-navigation event closes
the native top layer before the existing private-draft guard takes focus. Sign-out
uses the existing guarded Clerk action, not a second logout implementation.
Header account controls now consistently use the required stable account icon.

Mobile clearance is centralized at 64px + border + safe-area inset, shared with
message lists, browsing, consent, support controls and Genie. Open mobile chats
retain the existing focused composer layout without the global bottom bar.
Unread counts reuse the existing account-scoped store; no new poller was added.
No migration, content backfill or changes to member records are involved.

## Verification

- TypeScript and scoped lint completed without errors.
- All nine locale catalogs pass: 7,434 keys and no unreviewed source literals.
- Design checks pass for the shared six-item model, single mobile owner and
  preserved menu destinations.
- Navigation regressions execute the real components in all nine languages,
  including guest/admin scope, unread isolation, active query tabs, dismissal,
  draft-guard handoff and sign-out reuse. The messages shell test imports actual
  AppChrome, Navbar, BottomNav and PersonalAreaNavigation.

- Full regression suite: 2,999/2,999 passed before the final responsive/focus
  refinements. The affected navigation/header/messaging tests were rerun after
  those refinements: 157/157 passed.
- Safari with the actual shared shell and synthetic data: 320px/390px mobile
  and 1024px desktop states checked, including German and Hungarian, signed-in
  and guest transitions, six visible slots, unread isolation, focused chat,
  actual history Back, native More dismissal and focus return. The draft guard
  was exercised with an intentionally failing save: it became visible above
  the closed menu, and Continue editing preserved the typed test input.
- The visual review found and fixed a clipped narrow header and broken word
  wrapping. Small headers now prioritize the logo, notifications, language and
  menu; search remains directly available in More. The redundant account icon
  returns from 420px. Notification targets are at least 44px.

The fixture imports the real navigation and draft guard but uses synthetic
accounts, API responses and browse content. No real messages were sent, no
member data changed, and no physical device or native WebView was tested.
Production publication follows the guarded release process after the reviewed
commit is saved and pushed through GitHub Desktop.

## Reference patterns

Apple's [tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
informed stable destinations; the final six positions follow the user's explicit
choice. [Kleinanzeigen's message help](https://hilfe.kleinanzeigen.de/hc/de/articles/17144629890972-Ich-habe-eine-E-Mail-geschrieben-bekomme-aber-keine-Antwort-Kam-diese-an)
supports keeping messages directly accessible. These are design references, not
dependencies or claims of identical interfaces.
