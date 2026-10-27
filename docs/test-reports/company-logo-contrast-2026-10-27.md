# Company logo contrast — 27 October 2026

## Cause and implementation

`CompanyLogo` previously rendered a transparent canvas directly on each surrounding dark surface. This made the black props.co mark difficult to see; a few independent search, dashboard and provider previews also cropped logos like photos.

- `components/CompanyLogo.tsx` now supplies a quiet, reserved light/dark surface, full-image `contain` fitting and modest padding. Files, colors and opacity are unchanged. Failed/missing logos keep a localized placeholder.
- `components/CompanyLogoBackgroundSelect.tsx` and `lib/company-logo.ts` centralize auto/light/dark. Auto deliberately uses a deterministic light default, rather than guessing from a company's name or applying client-side color analysis. White transparent marks can select dark.
- `app/company-setup/page.tsx` previews immediately, includes the option in its existing private draft and saves it with the company. The existing authenticated company API validates the enum and keeps company editing permissions. Older clients that omit the option preserve a saved setting.
- Company reads and shared renderers carry the setting through the directory, company header, homepage cards, profile memberships, search results/global search, account dashboards/admin company previews and listing-provider cards.
- Community logo thumbnails and their photo view use the same surface, with captions kept off the logo. Ordinary photos/covers retain their existing rendering. The extra lookup is bounded to visible company-logo IDs, public companies only, and runs alongside existing like reads.
- New labels, help and error messages are in all six catalogs: de/en/es/it/cs/hu. The navigation logo is unchanged.

## Actual checks

- 647 automated tests passed, including actual company POST handler validation, default/create/update/omitted-setting behavior, denied writes for signed-out and unauthorized callers, unchanged image reference and a PGlite migration persistence/constraint test.
- All six localized radio selectors rendered under next-intl in the regression test. Translation, TypeScript and design checks passed. Targeted lint had no errors (three existing raw-image warnings remain in the company editor).
- Browser preview used the real public props.co and AMALIA files without modifying company records. Tested black/transparent and white wordmarks, colored square/portrait test SVGs and missing-logo placeholder. Original aspect ratios and `contain` fitting were checked.
- Actual company editor component was exercised with an own local test record and local fixture storage: dark selection changed the preview immediately, Save sent the setting and retained the same logo URL, and reopening the editor restored dark.
- Desktop and a 388 CSS px embedded mobile viewport were visually inspected. Mobile document scrollWidth was 383 px; all logos remained contained with reserved 144/96 px surfaces. Radio controls wrapped and remained usable. This was a browser simulation, not a physical iPhone test.
- Screenshots: `/private/tmp/cinegenius-logo-desktop-preview.jpg` and `/private/tmp/cinegenius-logo-mobile-preview.jpg`.

## Release status / limits

The additive migration was applied to the linked Cinegenius `main · PRODUCTION` database on 27 October 2026 before publishing dependent application queries. The SQL Editor verification returned `logo_background`, NOT NULL, default `'auto'`, the auto/light/dark check constraint, nine companies and zero invalid values. No images or membership permissions were modified. The guarded production release and subsequent public-browser smoke check are performed after this report is committed. A real owner setting change after a fresh login and physical-device testing remain unverified; the persistence proof above used own local data.
