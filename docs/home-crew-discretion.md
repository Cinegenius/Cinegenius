# Homepage Crew · 21 November 2026

Status: published on 21 November 2026 at 16:12 Europe/Berlin. Website/API commit
`5cafc814b92f5ab9ab58c3c7936cfb7374c40535`; production deployment
`dpl_7oepNowLC69PEfv3VwLotR9gzGu8` is READY and verified through the actual
`www.cinegenius.co` alias. Native adoption/device testing remain separate.

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

Migration `20261121145336_home_crew_visibility.sql` was applied and verified before
publishing the dependent API/UI. It adds one column to the existing service-only
settings table; it neither changes RLS/grants nor publishes records. Defaults, a
false round-trip and rejection of null were verified using a synthetic row that
was rolled back. Existing settings fingerprints, counts, RLS and grants
were unchanged. The production REST service recognizes the new field.

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

## Production acceptance

Four read-only production browser cases passed: WebKit at 390 px (German),
320 px (Spanish), 768 px (Hungarian), and Chromium at 1366 px (German). All
rendered the heading Crew and ten profile cards without registration badges or
horizontal overflow. No page errors were reported. Signed-out settings returned
401/no-store and profile setup redirected to same-host sign-in. Actual account
save/recovery was tested with controlled services before release; no real member
setting was changed for acceptance. The guarded release began from clean main
exactly at origin/main and completed successfully.

Two settled follow-up browser captures confirmed that the visible Crew images
loaded successfully on phone and desktop, with no failing media responses.
