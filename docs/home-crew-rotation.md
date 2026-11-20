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
