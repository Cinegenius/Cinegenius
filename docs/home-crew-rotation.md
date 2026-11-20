# Homepage Crew rotation

20 November 2026 — prepared, not published.

Markus chose one day of priority for new members. The existing “Die Crew” rail
keeps its layout and ten-card limit. Profiles created less than 24 hours ago
come first, newest first. Remaining places use a deterministic mixed order
that changes every 15 minutes on a new server render. An already open rail
does not jump or reshuffle. Profile edits do not renew the new-member window.

The server reads paginated IDs and creation dates instead of restricting the
pool to the newest 300 profiles. It fetches card details in batches of 32 and
applies fresh public visibility, field privacy and person eligibility before
serializing any card. Hidden/Ghost/member-only profiles cannot enter this
public homepage rail. No per-user search history or new database state is saved.
Queries share an eight-second timeout; failures use the existing homepage retry
state, not an apparent successful empty result. The thin candidate scan still
scales with profile count; this is not a production load benchmark.

Verification: 48 targeted selection, privacy, avatar and homepage streaming
tests passed; TypeScript, shared design checks and all 17 language catalogs
passed. ESLint has zero errors and one existing unused-import warning in the
homepage. Card-render AST hashes are unchanged from the base revision. No new
interface copy, native device test or production release is included.

This changes the website homepage only. Native directory ordering and the app
release hold remain unchanged. Country-first discovery is a separate pending
change and is not implemented by this rotation.

## App source integration — 20 November 2026

WEB commit `f6b45be5557b65e741e8b0962e04b147558b90cd` is imported unchanged
as `05c8b2f4` on `codex/app-home-crew-rotation-20261120`, based on the checked
app map-count commit `38d87bb4`. This affects the shared `/` page if reached
inside the app, not its native Smart landing or Crew directory ranking.
The separate map-count branch and frozen UI follow-up remain unchanged.

APP reran the 48 homepage checks and 13 native discovery checks: all 61 passed.
The actual `HomeCrew` render function, rail component/styles, native cards,
themes, discovery ordering, navigation and privacy helpers match the previous
app source. All 17 language catalogs are byte-identical; no new interface
copy, schema, endpoint, timer or native package is introduced. Shared design
checks pass. Lint reports no errors and the existing unused homepage import.

The full build passed with exit code 0 in 191.64 seconds, including TypeScript
and the 17-catalog check. This isolated checkout has no production credentials;
unavailable recommendations/project reads in the build log are not live-data
verification. Build status, source hashes and logs are recorded at
`/srv/cinegenius/handoffs/20261120-app-home-crew-rotation/receipt.json`.
Tests use synthetic query data and rendered components. This integration adds
no browser/device, real database, 15-minute device observation or production
load benchmark. The 17-locale catalog check is distinct from the older
homepage flow fixtures, some of which exercise nine locales. No release,
installation, Push or Shots activation was performed; the app release hold
remains in force.
