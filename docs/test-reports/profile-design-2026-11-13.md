# Profile and discovery design — 13 November 2026

## Result

- Existing and new generic person profiles automatically keep the photographic header when a cover is available, and use a compact finished identity panel when it is absent. A second upload is not required. Original media references and focal settings are preserved.
- Company affiliations use a compact horizontal card with an uncropped logo, localized category and public role. Private membership titles remain excluded. Company permissions and publication rules are unchanged.
- Contact buttons use short visible labels (German: “Hinzufügen” and “Kontakt”), descriptive accessible names and a restrained shared lime accent. All nine catalogs are updated. Contact state, API guards and navigation remain unchanged.
- Desktop primary navigation is 14 CSS px, rising to 16 CSS px on wide screens. The existing seven header destinations and five mobile destinations remain unchanged.
- The six homepage discovery cards follow their content height. The former Jobs/Projects split card now links directly to Jobs. Projects is removed from this discovery card; its separate lower-page and menu destinations remain available.
- Optional organization content is resolved alongside existing parallel server loads before passing section/null to the profile. A visually empty asynchronous slot cannot retain the empty details layout.

## Verification

- Full regression suite: 3,104/3,104 passed before the final organization-slot correction.
- Focused profile, company, contacts, homepage and navigation suite: 136/136 passed.
- Final organization-slot correction: 28/28 affected tests passed, including resolved null/content and pending lookups.
- TypeScript, scoped ESLint, shared design checks, translation checks and whitespace checks passed. Translation checks cover nine catalogs with 7,442 keys.
- Native Safari inspection used isolated fixtures built from real components, catalogs, styles and local fonts. The homepage discovery section was extracted from its actual source. Fixtures used fictitious identities and local images; external connections and mutations were blocked.
- Inspected 390 CSS px German profiles with/without cover and with company logo/fallback; a 320 CSS px Swedish profile with a long name and no portrait; 1,366 CSS px Swedish signed-out navigation; and 1,366 CSS px German discovery cards. Observed no horizontal overflow or profile actions below 44 CSS px in the measured fixtures. Company logo remained fully visible. Discovery cards displayed Jobs without Projects.
- Automatic header selection and translated trait/company rendering are additionally covered across all nine locales.

## Limits

These are browser width simulations, not physical phone or native-app tests. No real contact request, message, booking, upload or production data mutation was performed. Existing authentication, moderation and media access controls were not modified. Deployment identity and public live checks are recorded separately in the release manifest.
