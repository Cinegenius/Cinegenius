# Profile artwork — 17 November 2026

Markus accepted the twenty previews and delegated the first assortment. Implementation starts from website commit 6d8c8a6. It is not a production release until the guarded release completes after a new release request. The prior avatar/cover deferral is superseded for implementation.

## Selection and behavior

`lib/profile-art.ts` is the shared catalog: twelve avatars (four masculine, four feminine, four neutral presentations) and twelve covers (water, moon, sun, earth, sky, cold, heat, mountains, valley, forest, desert, polar). Everyone can choose every item. No gender or pronoun inference, ranking or identity verification follows a selection.

`initializeSetupProfileArt` suggests one avatar for a new personal profile, derived from the random authenticated account ID without using personal attributes. The suggestion is stable across reloads and distributed across all twelve designs. Existing profiles, legacy uploaded draft photos, explicitly chosen URLs and intentional empty choices take precedence. There is no backfill or automatic rotation. The cover remains optional and unselected until chosen.

The existing optional profile-image step now offers a collapsed gallery and an always-available custom upload. Review shows the chosen artwork. Editing uses the same picker and existing explicit profile Save/recovery flow. Cover selection appears where the existing profile design supports a cover; talent profiles retain their existing portrait/gallery hero. Company logos and offer images are independent and never inherit a person avatar.

## Website/native contract

- Private `/api/onboarding` `quickStart.profileAvatarUrl` and `quickStart.profileCoverUrl` are optional strings. Preserve absent versus empty: absent means untouched; empty explicitly removes the image. Keep these fields when saving resumed drafts. No public profile is created by reading a draft or selecting an image.
- Final explicit profile save uses existing `/api/profile` `avatar_url` and `cover_image_url`. Static preset references are relative `/profile-art/v1/*.webp` URLs. Resolve against the website origin in native image loaders; preserve the relative value when saving. Clearing writes `null` through the existing account-scoped API.
- Personal custom uploads continue through `/api/upload`, `storeProtectedMedia` and `/api/media/...`, without changing original ownership or permissions. No database schema change is required for presets.
- Changing locale does not remount setup; account changes do. Late uploads from an unmounted account cannot start a subsequent draft save. An upload completed while someone types merges into the current draft rather than its earlier snapshot.
- Shared choice labels and the short explanation are in `ProfileArt` in all seventeen catalogs. No live translation service runs on navigation.
- Collapsed pickers mount no image list. All 24 compressed static assets together are about 350 KB. Repository-owned version directories share a bounded image-optimizer pattern; private API images remain forbidden. Preset paths do not qualify for the uploaded-photo community registry.

## Artwork preservation

`design/profile-art/2026-11-17/catalog.json` records the chosen studies and all forty source SVG hashes. All twenty pairs remain editable in that archive. The original overview and detail sheets remain in `/srv/cinegenius/research/20261117-twenty-styles/`. Future catalogs may replace choices, but must retain previously served files and URLs so member selections survive.

## Validation and boundaries

Tests cover stable and varied initial selection, resumed/legacy drafts, explicit removal, existing-photo preservation, independent provider/listing images, all locale labels, source recovery hashes, account-scoped profile API round trips and rejection of guests. Browser checks exercise the real shared picker and initialization helper on an isolated local page at 320, 768 and 1366 CSS px, including all seventeen languages at 320 px, touch sizes, loaded images, busy state, keyboard operation and preserving nearby input. This is not an authenticated production onboarding session or an actual native/iPhone test. APP Entwicklung receives the contract and reviewed commit separately; delivery must be confirmed before claiming the app is updated.

The unrelated existing Next.js security advisory is not addressed by this artwork feature.
