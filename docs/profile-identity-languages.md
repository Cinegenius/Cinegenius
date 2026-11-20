# Optional profile identity and expanded languages

Markus approved identity and language work on 16–17 November 2026. The latest occupation decision restores the compact shared standard and adds an optional owner-selected wording preference; see [the current contract](occupation-form-preference.md). Earlier neutralization and full-pair instructions below are historical. Artwork approval and its current scope are recorded in [profile-art.md](profile-art.md), which supersedes the earlier preset deferral. Existing member uploads remain preserved.

## Profile contract

`/api/profile` accepts optional `pronouns` (null or text, maximum 60 Unicode characters, no control characters/angle brackets) and `show_pronouns` (boolean, default false). Omitted keys preserve existing values. Writes must fail if the dependent schema is absent, never silently discard identity fields. Existing account authorization, private draft recovery and publication rules apply. Pronouns are not mandatory for profile completeness, ranking or discovery and are never inferred from a name or picture.

Public projection strips pronouns unless display is explicitly enabled within the current profile audience. Public profile pages read the display choice fresh after the visibility check, outside the ordinary profile cache, so withdrawal takes effect immediately. Ghost and other profile privacy choices continue to apply. The privacy notice describes this optional processing and removal.

Migration `20261116223941_profile_pronouns.sql` was applied and verified: all 205 profiles retained, no existing value enabled; anon/authenticated have no direct column access, the server service role has access. Receipt: `/srv/cinegenius/handoffs/20261117-profile-identity/database.json`. This is a schema change, not proof of website publication.

## Languages

Existing: de, en, es, it, cs, hu, nl, nl-BE, sv. Additions: fr, pl, pt-PT, zh-Hans, ja, ko, ru, uk. At the original language-expansion verification, all seventeen catalogs contained 8,068 keys; subsequent feature namespaces are documented with their changes. The eight new catalogs were generated in an explicitly guarded staged build using the existing authorized OpenAI account, checked against the source hash, then reviewed for interpolation, auth/recovery wording, taxonomy lookup and layout. Invalid structured fragments and translated example addresses were repaired. Only UI strings and usage totals were exported; no key, account data or member text was exported. Temporary public draft placeholders are removed from this feature release. Machine-generated wording can still need native-speaker editorial improvements; key parity alone is not a linguistic certification.

Manual language choice takes priority over browser language and persists across sign-in/out. Regional Portuguese falls back to the explicitly labeled Portugal catalog. Simplified Chinese aliases resolve to zh-Hans; traditional Chinese is not falsely advertised as supported. Shared locale resolution applies to authentication, interface, country display, Genie and application-generated mail. Provider-owned security/billing email originals retain their existing separate configuration; the website language expansion does not claim to translate those templates. Only the selected catalog and the German fallback load; no per-visit translation requests. Stable taxonomy IDs and member-created content remain unchanged.

Occupation search normalization retains Unicode letters and script-specific marks, including Japanese voicing and Korean syllables. Empty normalized search terms cannot match everything. The same displayed-occupation-to-canonical-ID regression runs in all seventeen languages; existing German/English aliases and stored role IDs remain intact.

German legal originals remain authoritative. Automated translations are not legally reviewed documents. The optional-pronoun disclosure was checked against the existing privacy flow and the transparency/data-minimization principles in GDPR Articles 5, 12–13: https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de . No blanket legal-compliance claim.

Listing freshness also needs `20261117000500_profile_language_expansion.sql`: extends only accepted provider locales in two guarded functions and one constraint. Original function hashes, rights, security attributes, OIDs, retries and frozen deliveries are checked; no worker is enabled or preference backfilled by the migration. Applied and verified with unchanged counts; receipt: `/srv/cinegenius/handoffs/20261117-profile-identity/language-database.json`.

## App coordination and validation

### Spanish film terminology — 20 November 2026

Following operator-supplied feedback from a colleague in Mexico, the shared `es`
catalog uses **Crew** for film personnel and the Crew directory, including search,
Smart, onboarding, profiles, credits and generated welcome copy. **Equipo** refers
to equipment in marketplace labels. Company/support teams may still be called
`equipo`; do not globally replace that word. Preserve this distinction during
future AI-assisted catalog preparation and editorial reviews. The shared Spanish
catalog also serves visitors in Mexico; this is not a separate es-MX locale or
a complete regional language review.

Interface labels remain versioned catalogs, not per-visit AI translations. Public
content translation is a separate, enabled feature documented in
`docs/content-translations.md`, with a verified production release recorded in
`/srv/cinegenius/handoffs/20261119-translation-country-release/receipt.json`.
This terminology correction does not rewrite member content, change the runtime
translation provider, retrain a model or activate additional API requests.
Native-owned Spanish bundles require the same terminology through APP Entwicklung;
shared web/native-web views receive the catalog correction on publication.

The subsequent Spanish company-editor screenshot exposed a separate wiring bug:
company setup and details used raw catalogue labels despite available translations.
Setup, selection chips, detail views and the onboarding review now resolve these
labels through the existing taxonomy translator. Category search includes translated
examples while retaining canonical German aliases. Catering choices add seventeen
previously missing catalogue labels across all seventeen locales; only displayed
labels change, never saved selections, category IDs or member-written text.
Regression coverage exercises the actual label resolvers in every locale and the
rendered Spanish catering controls, including canonical values after selection.
This is component/catalogue verification, not a real iPhone or linguistic review
by native speakers in every language. Publication remains a separate step.

The additional Spanish screenshots of `/inserat?group=jobs` exposed the same
raw-label path in the job department chooser. Its display labels now use the
existing translations; its IDs and submitted categories remain canonical.
Location indoor/outdoor buttons also reuse existing translated labels. The chooser
regression covers all seventeen locales and preserves the category values for jobs,
marketplace, animals and locations. This is not certification of every legacy form:
the older vehicle subtype/fuel/licence selectors still contain raw option text and
need a separate complete catalogue mapping before claiming full form coverage.

APP Entwicklung must use the same optional fields, visibility contract, stable taxonomy IDs and locale tags. The original native preset deferral is superseded by the current scope in docs/profile-art.md. Existing native sources and device behavior are separate from this website change.

Browser simulations cover phone/tablet/laptop widths. They do not certify an actual iPhone, Xcode build or native language switching. APP Entwicklung messaging transport was unavailable; record the final source/test/publication handoff locally and do not claim delivery until acknowledged.

The 20 paired visual studies are at `/srv/cinegenius/research/20261117-twenty-styles/overview.png` with four enlarged detail sheets. Preview only; no art assets or preset controls are included in this release.

## Verification record — 17 November 2026

- Targeted regression coverage: 1,077 cases across 29 test files. The initial 1,046-case run exposed a UTF-8 byte-count assertion, a stale taxonomy fixture and a real non-Latin occupation-search defect. All failing cases passed targeted rechecks after correction. An additional 30 occupation cases and the Unicode normalization case passed after a separate fixture correction. This is scoped coverage, not a claim that the full repository suite ran.
- Browser: 102 successful checks (17 languages × 3 phone/tablet/laptop identity-field and language-refresh checks, plus 17 × sign-in/sign-up/Crew route checks). Switching language preserves entered pronouns and the explicit visibility choice. An additional 24 checks cover all eight new languages before switching at 320, 768 and 1,366 CSS pixels, including overflow, reachable controls and 44px input/label targets. Screenshots were reviewed at narrow French and Japanese widths.
- Public authentication checks verify initial email/password forms and route layout, not actual account creation, provider delivery or a signed-in native session. Production Clerk origin restrictions remain in force on localhost. The temporary component fixture is removed before release.
- `check:i18n` passes with 17 catalogs and zero newly admitted hard-coded strings. Shared design checks and the changed-file lint check pass. The existing profile-editor lint baseline (four errors/four warnings) is unchanged; a full lint pass is not claimed.
- The existing Next.js 16.4.3 dependency security advisory remains outside this identity/language change and is not reported as fixed. Native speech, scanner/offline bundles and physical-device behavior still need the separate APP Entwicklung implementation and validation.
- Production build, final source commit and actual deployment outcome are recorded separately in `/srv/cinegenius/handoffs/20261117-profile-identity/`; schema application alone is never called a website release.


## Historical full-pair correction — superseded later on 17 November 2026

The user reported that occupational choices had become masculine-only or been replaced with activities. At this earlier stage, full masculine/feminine pairs replaced the blanket neutralization across the 962 existing German choices in 25 departments. The user subsequently rejected that expanded default. This full-pair display requirement is superseded by the compact-standard and optional-preference contract in [occupation-form-preference.md](occupation-form-preference.md); the alias and qualification safeguards remain applicable. No gender is inferred or selected for a member, pronouns remain optional and private by default, and no stored occupation, canonical role ID, department ID or member-written text is migrated.

Examples include Oberbeleuchter / Oberbeleuchterin, Kameramann / Kamerafrau, Setkoch / Setköchin and Schnittmodelleur / Schnittdirektrice. Best Boy Electric / Best Girl Electric and the separate Grip and Rigging specializations retain their existing single choice IDs. Stuntman/Stuntwoman and Stuntfrau are exact search aliases of Stunt Performer. No additional physician aliases are created for paramedic occupations. The inherited Set-Arzt / Medic / Set-Arzt legacy aliases remain compatible; this correction does not add an Arzt/Ärztin choice or redesign medical qualifications.

The curated German alias inventory covers every existing choice, including entries whose established neutral display stays unchanged. It is search data, not a parallel translation catalog. New aliases cannot convert generic departments into occupations or redirect a literal saved canonical title to another role. Display resolution accepts exact curated feminine/masculine aliases, uses a department when available, and leaves unknown text unchanged; ambiguous occupations never gain a guessed department. Both Taxonomy.roles and FilmAnimals.roles use the same nine animal-profession labels.

The foreign-language review is bounded to Best Boy/Best Girl, occupation hints, selected activity-to-profession regressions and all nine animal occupations in each of the sixteen other languages. It does not claim a new native editorial review of all 962 titles in every language. Existing seventeen-language catalogs, draft language choices, authentication, optional identity fields and the approved avatar/cover assortment remain in place. Current artwork approval is recorded in docs/profile-art.md; the earlier deferred-artwork record above is historical.

Regression checks cover the complete 962-choice identity/display matrix, full female and male aliases across trades, irregular terms, canonical-title priority, department ambiguity, separate Electric/Grip/Rigging roles, shared public display and both animal namespaces. The release record lists actual executed tests, browser simulations and remaining physical-device limits separately; this documentation does not imply publication.
