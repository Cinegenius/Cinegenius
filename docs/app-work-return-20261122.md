# Work → Community/Smart: repeated request diagnosis

Prepared against d8b72d7375aedbc581ac807011bc0969d77a765e on 22 November 2026.
Not deployed, not installed and not a claim that the iPhone transition is fixed.
The operator's requested collage review remains required before the next native
build, release or installation.

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

The proposed persistent header/dock/Genie shell and the operator's newer
two-column website-style cards belong to the collage review. No new build or
production publication is authorized by this diagnosis.
