# Shared personal profile appearance

The owner can choose **Kompakt** (`compact`) or **Großes Bild** (`large-photo`)
at the start of profile setup and later in the profile editor. Both choices are
available to every personal profession and provider type. The large presentation
uses the approved floating identity card. This preference changes presentation,
not the person's occupations, profile types, casting attributes or permissions.

## Shared Web / native contract

- `profiles.profile_layout` is nullable text, constrained to `compact` or
  `large-photo`. `NULL` preserves the previous automatic presentation for an
  existing profile until its owner chooses; there is no backfill or database
  default. New website profile drafts suggest `compact` when the column exists.
- Authenticated `GET /api/profile` returns the additive `profile.profile_layout`
  field. A legacy `NULL`/missing value means no explicit choice, not `compact`.
  The public profile reads this presentation only after its existing visibility
  check. Profile-layout choices grant no additional audience or media access.
- Authenticated `POST /api/profile` and `PATCH /api/profile` accept exactly these
  two strings. An omitted field preserves the stored choice, including for older
  app versions. A supplied null, unknown string or non-string is rejected with
  HTTP 400. The owner comes from authentication, not a supplied `user_id`.
- `X-Profile-Account` continues to reject a stale account with HTTP 409. A missing
  session is rejected by the existing authentication gate.
- Before the migration is available, GET lists `profile_layout` in
  `unavailableFields`, including for accounts without a profile. A write carrying
  a layout receives HTTP 503 and `code: "PROFILE_LAYOUT_UNAVAILABLE"`. It must
  not be silently dropped or presented as saved. Other compatible edits remain
  available. Native clients should disable selection when this capability is
  missing and retain any unsaved choice for retry.
- Selection itself changes only the form and private recoverable draft.
  Explicit Save/Continue through the existing save flow persists it. Setup uses
  `quickStart.profileLayout`; editing uses `profileEditorDraft.profileLayout`
  and the existing private recovery API. Older drafts without it keep the loaded
  preference. Recovery and pending requests remain scoped to the current account.

## Presentation and media

`ProfileLayoutPicker` is a shared, labelled two-radio choice with keyboard support
and 44px or larger targets. `ProfileLayoutHeader` applies only to explicit
choices. The existing specialist body remains available below it: actor casting
facts, model measurements, crew details, biography, credits, galleries and video
links are not replaced by a generic profile body.

Large presentation uses the existing cover, falling back to the existing
portrait. It preserves cover position/brightness and portrait focal settings.
Compact presentation keeps the portrait and identity panel. No image is required;
missing or failed hero media produces a finished compact panel while retaining
the requested preference and stored media. A model's first gallery image remains
in the gallery when it has no portrait. Casting-field keys use stable field IDs,
so identical translated labels cannot collide during a layout change.

Images continue through `MediaImage` / `ProfileCardPhoto` and the existing
permission-checked references. No image is regenerated, copied, assigned a new
owner or moved to public storage. Existing generated-art paths are unchanged.
Exclusive artwork pools and company motifs are separate future work.

All seven new `ProfileLayout` strings are included in the seventeen website
catalogs. Load the requested language through the existing next-intl pipeline.
Native clients use the same stored preference and translated meaning; this does
not establish complete native UI language coverage or a device-tested release.

## Migration and release boundary

`supabase/migrations/20261118002930_profile_layout_choice.sql` adds only the
nullable field, its check constraint, a descriptive comment and the PostgREST
schema reload notice. Existing rows, RLS policies and grants are preserved.

The migration must be explicitly applied and verified before a dependent release.
This source handoff does **not** apply it or publish the website/app. Use the
normal clean-main guarded deployment procedure only after a release request.

## Verification scope

API tests execute the actual profile handlers with isolated authenticated/data
fixtures, including round-trips, omitted fields, invalid choices, stale accounts,
missing migration and unchanged professional/media data. A local PGlite database
executes the migration and verifies legacy rows, the constraint and retained RLS.
Editor hydration, private setup recovery, occupation, photo/crop, onboarding and
related profile regression checks are included.

Browser fixtures render the actual picker and public profile components with
synthetic accounts, data and images, plus freshly generated project CSS. The
framework routing/auth wrappers and external media are isolated. They cover both
choices, legacy presentation, all profile types, all seventeen languages, small
screens, keyboard selection, photo dialogs and unavailable/missing media. This
is not a real authenticated full-site, production database or native-device test.
The exact completed counts, source commit, evidence paths and remaining checks
are recorded in the dated source handoff.

The previously observed Next.js security stop remains a separate release blocker;
it must not be bypassed to publish this feature. Existing profile-editor lint
diagnostics are distinguished from regressions in the handoff.
