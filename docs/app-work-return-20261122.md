# Work → Community/Smart: repeated request diagnosis

Prepared against d8b72d7375aedbc581ac807011bc0969d77a765e on 22 November 2026.
The combined correction is now published in a0d872320e7bb94dedf64b105d549a4c948e66cb
and installed with native 2204. Physical start/transition acceptance remains open.
The earlier source-only, Desktop-blocked and uninstalled checkpoints below are
historical; see the actual completion evidence at the end.

## Reproduced cause in the server-delivered app component

NativeSmartLanding revalidates on focus, pageshow and cinegenius:app-resume.
Its previous 500 ms debounce allowed spaced lifecycle events to abort a still
running request and start another one. Each retry invalidates the displayed
result scope; results stay unavailable until the final request completes.

The regression drives the real component's effects and deferred fetch responses
with controlled hooks/events. After an initial successful load, it sends focus,
native resume 750 ms later, and pageshow another 750 ms later. Before: three
return requests, with earlier ones aborted; after: one return request. Including
the initial load, the test observes four versus two calls. This is a deterministic
reproduction, not a measured network latency or physical iPhone trace.

## Prepared correction

Keep the current permission request for duplicate signals within one visit.
Clear its handle on completion so retry still works. A real blur, pagehide,
hidden document or native-workspace-presented event retires the old request.
The next foreground entry then performs a fresh check. Cancelled scheduled work
does not start another fetch. Late cancelled replies cannot restore old results.

This does not cache authorization, retain unchecked private rows, change card
design, replace the native shell or skip the current server rights checks.
No new interface copy or translation keys.

## Evidence and boundaries

- Baseline against the unchanged source: 1 of the 6 new tests passes; 5 fail,
  including the repeated-request and retirement cases.
- Prepared source: all 6 new lifecycle cases pass.
- Related suite: 54 cases pass across resume, 17-locale landing rendering,
  discovery contract, request races, native entry and navigation gestures.
- ESLint for the changed component passes. Catalog verification passes for
  all 17 catalogs / 11,319 keys / zero source literals requiring review.
- Full project TypeScript check passes without emitting files; no Next/iOS build.
- Native sources and physical rendering are owned by the local APP task.
  Its report says build 2026112202 was installed/launched after a seven-folder
  backup, with 132 persistent files compared and zero differences. This server
  task inspected that report; it did not repeat the device operation.

The local APP checkpoint now reports the source fix merged with its own refresh,
24px status region and numeric height placeholder. Do not reapply this older
standalone two-file patch over the frozen combined source. Publication and
physical Work-return measurement remain outstanding; the isolated server patch
alone never established a complete native performance fix.

The persistent header/dock/Genie shell and the operator's newer two-column
website-style cards are covered by the approved collage. This diagnosis does
not independently authorize a server deployment or the team-channel migration.


## Coordination on 22 November 2026

Markus expressly requested coordination here: “ja stimme dich mit app usw ab”.
The patch, exact commit, test evidence and remaining limitations were sent to:

- Local APP / Xcode: `01a1d38d-d672-7941-8033-30d87821d882` on host `local`.
  Owns merging the two-file fix into its pending Smart/layout and native shell
  changes, combined verification and the authorized device workflow.
- WEB CODEX: `01a1d43f-7699-7452-b2f3-3691699f6613` on the server.
  Retains the ordinary website and coordinates shared server source/release
  changes; do not introduce a competing Work-return implementation.

Direct approval evidence inspected in local APP: user message
`01a2030e-81d7-7832-88d9-ac50144ce002`, “die collage ist gut so”. This fulfills
that design-review condition; additional floor-plan editor requests and the
unfinished team-chat server contract keep their own scope. The old blanket
collage hold in the initial handoff receipt is historical.

Both messages were successfully delivered. Delivery alone does not prove source
integration or installation. The independent team migration remains explicitly
not applicable; no whole-branch merge into main. Source fix is `2d6985c4`;
the transferable two-file patch and checks are under
`/srv/cinegenius/handoffs/20261122-app-team-contract-smart-return/`.


## Later production baseline

WEB completed its separate authorized Dispo-only release at
`57d7658ff50bf3115f47e7b254c3210ac3c3a717`, descended from the d8b72d73 base.
APP checked the receipt, fetched origin/main and inspected the six changed files.
No Smart-return, UI or team-channel source is part of that release. Preserve the
new Genie prompt selection on the next merge; do not overwrite it with this
branch's older engine files. That Dispo-only release did not publish the return fix; it was subsequently included in a0d87232.


## Historical candidate 2026112203 — not installed, superseded by startup scope

Source: local APP task `01a1d38d-d672-7941-8033-30d87821d882` and its visible
candidate/checkpoint command outputs. The server read those outputs; it did not
copy or independently verify the candidate binary or private native sources.

- Native build and signing pass after two real-module compiler fixes. Reported
  frozen inputs: 376; public resources: 45; native catalogs: 9 × 1876 keys.
- Our return patch is merged with local refresh/layout preservation; 35 focused
  tests pass. Same-foreground events share one request; real interruption does
  not preserve unchecked private rows. Numeric height preservation protects
  scroll position without retaining private cards for display.
- The native same-Smart destination sends one app-resume before its bounded
  readiness probe; it waits for the actual native Smart ready marker plus two
  animation frames. No reported 2.5s readiness deadlock in the prepared flow.
- Shared header, Work icon and Genie are locally consistent across Work and
  Community. The body/main-versus-wrapper CSS defect was reproduced with a
  negative control; local report gives 12/12 padding after removing the old rule.
- Reported checks: 177 web, 113 mobile plus focused follow-ups; browser suites
  28 Smart / 40 directories / 8 ordinary website / 4 actual DOM structure cases.
  These suites may overlap. They are not physical iPhone acceptance tests.

Local source-control checkpoint: 29 web files frozen on d8b72d73, no new commit,
push or UI production build. GitHub Desktop twice returned cgWindowNotFound
while Markus was away. Preserve the required Mac workflow; do not replace it
with terminal Git or overwrite the local frozen files from this server branch.
On the next reconciliation retain published 57d7658f and its focused/medium
Genie selection. Then record the combined commit/release, fresh phone backup,
installation of the final matching candidate and real device verification separately.

Installed device remains 2202; its 132-file preservation proof does not turn its
failed UX acceptance into a pass. Team-channel SQL was not adopted or applied;
name/team Dispo selection is not implemented. Editor/import/solar-position
extensions are still separate previews, not native editor code.


## Desktop access restored; expanded startup scope targets 2204

Local APP confirms GitHub Desktop available after Markus reported “git hub ist da”.
It reports UI commit2225503 merged with published57d7658f as ed334e8. These are
local source-control reports, not commits independently fetched here; no push
or new production publication is confirmed at this checkpoint.

Markus subsequently requested a sustainable startup correction and explicitly
selected restoring the last used area after authentication. Local APP reports
25 checked/frozen startup web files: a minimal session API, actual Clerk/layout/
Smart/Shots readiness, no native reveal delays, and no data fetching by the cold
Dashboard intermediary. The final native build now reports success for a single startup cover without
a fixed wait or chooser, account-scoped areas, fail-closed retry and respected
deep links.

The complete native candidate2204 is now reported built, signed and frozen.
Do not install the older2203 for this expanded scope. Installed build remains2202. Local APP continues the authorized
complete build, Desktop push, guarded release, fresh backup and installation.
No new production release, installation or physical latency measurement is
claimed here. Team/editor work remains outside this release scope.


## Signed 2204 checkpoint; Desktop window disappeared again

The local APP reports a complete successful signed device build and immutable
package, followed by an independent local audit: exact25 web files plus13
protected files,27 expected Git changes,10 native sources,376 build inputs and
80 package files; code signing passed. Reported passing suites:126 mobile,
114 startup,7 Dashboard,350 auth checks and8 browser boot cases. Suites may
overlap. These reports are not a new physical iPhone test and were not rerun here.

During the subsequent Desktop commit the previously visible window disappeared
again (cgWindowNotFound). Local APP has already asked Markus to unlock the Mac
and show GitHub Desktop; do not duplicate that request from this server chat.
No new Git write, push, deployment, fresh backup or installation followed this
failure. A paired connected iPhone read alone does not establish any of them.
Continue from local work/app-startup-20261122/CHECKPOINT.safe.json after the
window becomes available. No parallel release or2203 installation.


## Actual release and installation completed — physical UX pending

The local APP completed Desktop commit/push and one guarded deployment of
**a0d872320e7bb94dedf64b105d549a4c948e66cb**. This server fetched origin/main,
verified ancestry from 57d7658f and inspected the visible local release/installer
outputs. UI commit 2225503b, merge ed334e83 and final startup a0d87232 retain the
published focused/medium Dispo selection. The team prototype migration and its
test file are absent from the deployed commit.

Release output: dpl_HUh4tANfSQZ7VFi6V1MkMKSeHnSi READY, exact canonical
www.cinegenius.co alias, 0 provider calls. Local production-release.safe.json SHA256
reported by its read command: 82522aa8382e6838776dbb563185b86717f8efca82bd3d2150d88e9ec8a2558f.
Full Next/TypeScript build, 4 live access checks and 39 assets passed per local APP.
No independent second deployment or live-provider comparison was run here.

After confirmed device unlock, all 7 persistent folders were freshly backed up
(169 files). Build 2026112204 was installed and launched; actual installed build
number verified. 139 Documents/Application Support files were byte-identical
before first launch, 0 differences. This comparison covers 139 working files, not
all 169 backup files. No reset, uninstall or temporary Genie config. The server
read the successful installer output; it did not repeat the physical operation.

Source of the real evidence is local work/app-startup-20261122/
production-release.safe.json, ui-install.safe.json and CHECKPOINT.safe.json.
The user is already asked in local APP to cold-restart after Work/Smart and test
restored area, Work/Smart/Projects, header, Genie and jumps. That result is still
pending. Installation/data preservation does not establish no jank or measured
physical latency. Do not ask the same question again from this server chat.
