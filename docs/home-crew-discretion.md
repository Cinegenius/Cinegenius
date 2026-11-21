# Homepage Crew · 21 November 2026

Status: implemented on the website branch, not published. Migration and native
adoption are not claimed as complete.

Markus replaces the former first-24-hours preference: the homepage title is
exactly **Crew**. Eligible profiles rotate every 15 minutes on a new request,
without using registration dates. The existing rail, card design, region-first
ranking and permission checks stay in place. An already open rail does not move
on a timer. The thin candidate index no longer reads registration dates.

## Optional appearance

- `user_settings.show_in_home_crew`: non-null boolean, default `true` for existing
  behavior. Absence of a settings row retains the default; an unavailable lookup
  does not return the Crew selection.
- Own-account `GET/PATCH /api/user-settings` includes this field. PATCH requires a
  real boolean and checks any supplied `accountId`. A different account cannot
  change the preference. Reads/writes are private and uncached.
- Initial profile setup shows the switch with the optional profile details and
  final review. `quickStart.showInHomeCrew` stays in the existing private draft.
  The preference must be confirmed before a profile is created or updated. A
  failure stops completion, retains input and permits retry.
- Existing members can change it in **Settings → Privacy**. Ghost and narrower
  profile audiences still take precedence; this switch cannot make a private
  profile public.
- The preference applies specifically to the homepage Crew rail. It does not
  hide the public directory/profile, personal offers or eligible uploads in the
  separate photo-discovery section. The UI names the Crew selection explicitly.
- Candidate batches are checked again before serialization. Excluded candidates
  are replaced with other eligible profiles; the first 10 fetched profiles are
  not simply filtered down to an empty rail.

## Release and native contract

Apply and verify `20261121145336_home_crew_visibility.sql` before publishing the
dependent API/UI. It adds one column to the existing service-only settings table;
it neither changes RLS/grants nor publishes records. Verify defaults, a false
round-trip, and that general profile privacy remains unchanged. No schema change
has been applied to production for this draft.

Native clients should use the same API and account identity checks, preserve the
pending choice through setup interruption, and stop profile publication if its
save cannot be confirmed. Unknown/missing fields are unavailable, not a saved
choice. The website handoff does not prove native implementation or device tests.

## Verification

93 targeted cases cover rotation, public-profile permissions, initial setup,
private recovery, own-account settings, schema defaults and homepage rendering.
The revised streaming suite passes 17/17 cases; the final avatar/serialization
suite passes 25/25, including absence of registration dates. Existing Crew card
markup remains unchanged.

21 controlled browser cases cover 17 languages at 320 px plus 390/768/1366 px,
save/reload, failure/retry, account changes and the actual setup component. Setup
does not create a profile if the preference save fails, and retains the opt-out
through draft recovery. Auth, transport and media selection were controlled;
these are not native device or live-service tests. Catalog/design checks pass.
Two existing privacy-component hook lint errors and two existing setup-hook
warnings were confirmed against the unchanged base; there are no new findings.
Build logs, screenshots and the precise release status are recorded in
`/srv/cinegenius/handoffs/20261121-home-crew-discretion/receipt.json`.
