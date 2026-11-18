# Prepared personal-art picker

`components/ExclusiveProfileArtPicker.tsx` is a controlled, currently unmounted
renderer. Its `ExclusiveProfileArt` namespace is included in all 17 catalogs.
The existing `ProfileArtPicker` and all current forms remain unchanged.

`confirmedChoice` means a server-confirmed **draft** lease, never a saved profile.
`savedChoice` is the actual persisted image and stays separately reachable during
pending requests, failures and expiry. Rendering/opening the picker has no side
effects. Images remain optional. Upload/removal controls stay in the parent form.

Before mounting this component, the owning form must bind its whole state to the
authenticated account, kind and draft; validate current ready inventory and media
references; reject obsolete responses after restore/account changes; bound and
reconcile requests; and atomically commit reservations with an explicit profile
save. A child remount alone cannot sanitize stale parent state. Existing v1 art
is shared legacy decoration, never exclusive inventory.

The separate reservation, producer, storage and public-reader packages are not
activated by this component. No endpoint, account data, timer, lease token or
generation action is embedded in it.

Reviewed upstream candidate: component SHA-256
`7fbebde3f38386a7e860a8879fa4745c18d7a42a454b8a62ca8df0b02475a867`.
Upstream isolated verification reported 394 browser assertions and 272 actual ICU
format operations, with image/i18n/icon adapters. That is not an authenticated
parent/API test, native-device verification or a production release.
