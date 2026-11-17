# Compact occupation labels and optional wording

Latest operator decision, 17 November 2026: return to the previous compact shared
standard and make the newly built masculine/feminine/neutral forms an optional
owner choice. This supersedes the earlier blanket neutralization and the later
full-pair default. German standard labels can use established asterisks/slashes,
such as Oberbeleuchter*in; a long full pair is no longer mandatory by default.

## Shared Web/app contract

- `crew.occupationForm` accepts `standard | masculine | feminine | neutral`.
  Absence means standard. The API rejects invalid explicitly supplied values.
- Explicit `standard` clears the override. An omitted preference, an older crew
  writer or `crew: null` preserves a previously saved nonstandard preference.
  Explicit `occupationForm: null` is invalid and is not a reset request.
- The choice belongs to the profile owner and affects only display. Do not infer
  it from a name, photo, avatar, pronoun or casting attribute. A viewer's own
  preference must never change another person's displayed profession.
- Keep existing role/department IDs, positions, main/additional occupation,
  handwritten titles, artwork and media permissions. No data migration or bulk
  profile rewrite is required. Unknown custom text stays exactly as stored.
- Search all localized forms and existing aliases and resolve the same stable
  role ID. Best Boy and Best Girl Electric/Grip/Rigging are representations of
  their existing distinct specializations, not additional selectable roles.
- Use precise professional titles and explicit curated catalog records. Where a
  title is invariant in a language, variants can coincide. The neutral choice
  may use an established epicene/international title or a local compact inclusive
  form; never invent a qualification, leadership position or runtime grammar.
- The enabled language list remains de, en, es, it, cs, hu, nl, nl-BE, sv, fr, pl,
  pt-PT, zh-Hans, ja, ko, ru and uk. Only the current catalog and defined fallback
  load. Both Taxonomy and FilmAnimals role namespaces stay consistent.

## Creating, editing and recovering

The shared optional selector appears with occupation selection in the first-time
assistant, guided setup and the existing profile occupation editor. It has four
choices, a neutral surface, a visible label and help text, and a minimum 44px
select target. Its default is standard and it never blocks completion.

Older drafts without a choice retain the default. A resumed explicit choice,
including standard, wins over hydration from the current profile. An explicit
change invalidates only the completed personal-profile setup step so that the
next save persists it. Other completed offers/companies retain their state.
Provider-only setup omits crew updates and preserves any existing preference.
Private recovery and current-account isolation continue to apply.

Profile responses expose the saved preference with the existing profile contract;
public readers carry only what is needed to format that person's occupations.
Native clients must implement the same optional enum and omission/reset behavior,
rather than introducing gender inference or separate role IDs.

## Verification scope

The final scoped run passed 183/183 cases across seven profile/setup/search test
files after all seventeen catalogs were merged. It exercises real selector and
primary-role components in every enabled locale, stable selection/removal,
explicit resets, account hydration, private draft resume and provider-only
preservation. Actual search expressions and picker adapters cover profile
editing, quick setup and guided setup, including variant queries and unchanged
canonical IDs. The log is
`/srv/cinegenius/research/occupation-form-preference-20261117/ui-final-tests.log`.

The run also exposed and fixed an existing guided-draft issue: removing one
department must not re-add it when a shared selected title remains explicitly
bound to another department. The binding survives private draft resume; older
drafts missing a binding can still infer their matching groups. Catalog-wide
identity checks belong to the final release checks, and translated records are
not a native editorial certification.

The selector's minimum target, neutral colors, wrapping copy, 16px input text and
full-width shrinking are checked in source. Code review is not a physical-device
or native-app test. Actual browser/device verification, build and publication
outcomes are recorded separately by the release task.
