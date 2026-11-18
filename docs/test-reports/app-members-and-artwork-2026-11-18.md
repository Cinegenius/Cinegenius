# App source reconciliation: exclusive artwork and members privacy

Base: `f8c3bccba57886fab9c3167e55ff7b49bd9db880`. Integrates the reviewed
artwork-only net change from `a83decd` to live `2a4dac4`, then prepared
`e96edbb6e6f0094d223be13833cf234de755f486`. The dependency manifest and evidence
are in `/srv/cinegenius/handoffs/20261118-app-members-privacy/`.

The exclusive picker, reservations, atomic save, explicit permanent deletion and
replenishment backend are already live according to WEB's fresh deployment and
read-only database receipt. Seven artwork migrations are already applied; this
integration applies none. The mixed 21 motif pairs and `members` visibility remain
prepared only. `20261118205822_member_profile_visibility.sql` is not applied.
Do not activate members controls in an independently bundled client before the
matching backend release. Remote-content preview continues to load published Web.

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

The full build compiled successfully but its TypeScript stage was interrupted
(exit 143); this is not a passing full build. Two diagnostics in the unchanged
upstream `use-exclusive-profile-art.ts` hook and existing unrelated component
diagnostics remain; lint is not clean. See external logs for the exact comparison.
No new dependency beyond upstream's pinned Next/eslint-config-next 16.4.6 was added.

No deployment, production migration, production content write, paid model request
or device installation was performed. Smart work is kept separate from this
artwork integration; newer explicit Smart instructions govern subsequent work.
