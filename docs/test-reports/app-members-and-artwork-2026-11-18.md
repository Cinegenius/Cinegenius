# App source reconciliation: exclusive artwork and members privacy

Base: `f8c3bccba57886fab9c3167e55ff7b49bd9db880`. Integrates the reviewed
artwork-only net change from `a83decd` to live `2a4dac4`, then prepared
`e96edbb6e6f0094d223be13833cf234de755f486`. The dependency manifest and evidence
are in `/srv/cinegenius/handoffs/20261118-app-members-privacy/`.

The exclusive picker, reservations, atomic save, explicit permanent deletion and
replenishment backend are already live according to WEB's fresh deployment and
read-only database receipt. Seven artwork migrations are already applied; this
integration applies none. The mixed 21 motif pairs and `members` visibility were
initially prepared only. WEB subsequently published them in `6f5ec38` after
explicit approval and applied `20261118205822_member_profile_visibility.sql`.
The matching backend prerequisite is now fulfilled. Remote-content preview
continues to load published Web; this is not a new native build or installation.

App's compact/large-photo preference, missing-schema error, private media and
Secure-cookie handling are preserved alongside atomic artwork saves. The App
privacy validator now accepts members. Logging out during a privacy save now ends
the loading state. A failed atomic artwork/layout save retains the lease and does
not claim the picture or silently drop the layout. Existing native sources (123
files), Smart sources (73 checked files), and all old locale values are unchanged.
42 normalized artwork files and eight migration sources match WEB exactly.

Validation: 486 distinct targeted functional cases, 37 mobile source/contract
checks, 136 browser cases (98 privacy/legacy-picker, 38 exclusive-picker/layout),
17 catalogs with 11,294 keys and shared design checks passed. Browser cases use
actual components in Chromium and Linux WebKit with synthetic authentication,
API records and image stand-ins; they cover all locales, narrow layouts, retry,
lease expiry, account changes and explicit deletion. No real account or iPhone
was tested. Native resources were not regenerated or installed.

The final full production build passed (exit 0), including TypeScript and 160
generated pages. The preceding run had been interrupted during TypeScript (143);
the final log supersedes that incomplete result. The build reports unavailable
homepage recommendations; this does not establish an authenticated homepage test.
Two diagnostics in the unchanged upstream `use-exclusive-profile-art.ts` hook
and existing unrelated component diagnostics remain; lint is not clean. See
external logs for the exact comparison.
No new dependency beyond upstream's pinned Next/eslint-config-next 16.4.6 was added.

WEB independently reproduced the pending-save logout issue and accepted the same
loading-state correction in prepared `6f5ec38a8f4df537a77885285f2bf053875fa785`.
WEB reports five browser cases plus locale/design checks; these are separate
from the App checks above. The fix is already in App `0189398`; no duplicate
source import is needed. That package is now published by WEB.

## Live reconciliation, 18 November 2026

WEB release `6f5ec38a8f4df537a77885285f2bf053875fa785`, deployment
`dpl_ChvU9TVAHxD26HwPoNebNFv45a15`, is recorded in
`/srv/cinegenius/research/20261118-profile-art-mixed-release/receipt.json`.
WEB verified eleven rolled-back database permission cases and all 42 public
image responses. These remain WEB evidence, separate from App's earlier tests.

App independently compared all 42 local artwork hashes with the published
manifest and matched its migration hash with the release receipt. Signed-out
GET checks of `/api/profile-art` and `/api/user-settings` return 401 with
`private, no-store`; `/dashboard` redirects to same-host `/sign-in`. No runtime
source or translation changed in this reconciliation, so the existing passing
build and App tests remain applicable; they were not rerun as new device evidence.
See `live-reconciliation.json` beside the App evidence. Authenticated live browser,
iPhone/Xcode build, installation and physical gestures remain unverified.

No deployment, production migration, production content write, paid model request
or device installation was performed by APP. The existing Smart work remains preserved
and paused. Its historical Web/App requirements do not lift the later pause.
