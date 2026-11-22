# Work → Community/Smart: repeated request diagnosis

Prepared against d8b72d7375aedbc581ac807011bc0969d77a765e on 22 November 2026.
Not deployed, not installed and not a claim that the iPhone transition is fixed.
The earlier collage hold was subsequently checked against the local APP user
message: the shared design is approved. Actual integration, release and device
verification still require their respective evidence; see coordination below.

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

Still required: merge this small lifecycle change with the local task's pending
Smart layout/revalidation changes, verify the final combined component, and
measure Work return on the installed candidate after approval. Inspect native
WebView reuse, presentation/dismissal, layout restoration and real foreground
events. Current result replacement can still create a visible empty interval;
this patch prevents repeated network restarts, not every source of delay.

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
