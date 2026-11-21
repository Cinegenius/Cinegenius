# News source-conflict correction · 21 November 2026

## Incident and current status

The Sheffield DocFest MeetMarket item
`d85db590-b423-51b8-8a9d-171e5eaeab87` was reversibly hidden by NEWS after its
independent reviewer inserted a disputed entry-fee tax claim. The initial
candidate deliberately omitted the fee and recorded the disagreement in
`rightsNote`. `publisher.verify()` discarded that note and `confirmationUrls`,
so its reviewer was given only the main source. Exact save/readback checks proved
that the generated text was saved; they did not prove factual agreement.

The official entry page and application guidelines disagree about VAT. The
sources and original candidate remain in the private handoff. No deletion,
duplicate, machine-rights expansion or automatic restoration is permitted.

## Correction

- Research and independent review must declare `sourceConflicts` explicitly.
  Any unresolved conflict, missing declaration or malformed value blocks the
  controller before product/media activity, irrespective of a `publish` verdict.
- All supplied confirmation URLs are bounded and checked against the source
  group's existing approved domains. They and the untruncated rights note reach
  the independent reviewer. Up to seven distinct sources are fetched with three
  concurrent requests using the existing size, timeout and public-source guards.
  Unavailable confirmations remain explicit; forbidden sources stop the review.
- The reviewer must hold when required evidence cannot be verified within its
  browsing budget. Rewriting the prose is not a resolution of conflicting facts.
- Older private candidates require fresh research. Never assume no conflicts by
  adding empty declarations, deleting earlier caveats or resetting held ledgers.
  Existing drafts, original media, stable IDs and all moderation restrictions stay.

These checks prevent loss of declared conflicts; they do not guarantee an AI
will discover every possible contradiction. Editorial review remains necessary.

## Verification and installation

75 isolated runtime tests pass, including the actual fee-reintroduction failure,
both declaration gates, missing legacy metadata, unavailable/forbidden
confirmations, normal publication and retry/moderation protections. All product
calls are fake in those tests.

A separate **real review-only** adversarial check supplied the original warnings
and freshly fetched sources while simulating a researcher missing the structured
conflict. The reviewer returned `hold` and identified the incompatible VAT claims.
It made no product calls. Receipts:
`/srv/cinegenius/handoffs/20261121-news-source-conflicts/`.

This change is a reviewed runtime source update, not a website deployment.
NEWS owns controlled runtime installation under both existing locks. Install
`source_conflicts.py`, `research.py`, `publisher.py` and `review-policy.txt`
together, verify source hashes, preserve all state/markers and record actual
installation before calling it active. At preparation, direct chat delivery to
NEWS failed; the shared handoff is durable but is not proof of delivery/install.

## Existing correction path for the same article

`/organization-dashboard` already allows an actual organization owner or active
organization admin to edit the existing entry. Site-admin status alone does not
grant content editing. The form loads the current entry and `updated_at`, retains
its canonical media and place fields, and sends a revision-checked PATCH to
`/api/organizations/entries`. Saving a hidden item keeps it hidden; explicit
submission changes it to `submitted`. Re-read the stored text, sources, country,
media and moderation state before ordinary human admin approval with the new
revision and explicit reviewed flag. Preserve the entry ID and original source.

The scoped machine token cannot use that member workflow and cannot overwrite a
hidden item; that restriction remains correct. A logged-in authorized owner/admin
session has not been exercised for this correction here. The article therefore
remains hidden, with its corrected private candidate retained for that workflow.
Do not simulate human approval or use a privileged database write as a shortcut.
